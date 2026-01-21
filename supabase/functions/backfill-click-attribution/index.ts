import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

/**
 * Backfill Click Attribution
 * 
 * Matches historical ActBlue transactions to attribution_touchpoints to recover
 * full Facebook Click IDs that were previously truncated in refcode2.
 * 
 * Priority-based matching:
 * 1. Email + Time Proximity (HIGH confidence) - Same email, within 30 min before donation
 * 2. Refcode + Time Proximity (MEDIUM confidence) - Same refcode, within 30 min before donation
 * 3. Truncated Prefix + Time Proximity (LOW confidence) - Touchpoint fbclid starts with truncated refcode2
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

interface MatchResult {
  transaction_id: string;
  matched_fbclid: string | null;
  match_confidence: 'high' | 'medium' | 'low' | 'none';
  match_method: string;
  touchpoint_id: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Auth check: require cron secret or admin JWT
  const cronSecret = req.headers.get('x-cron-secret');
  const expectedSecret = Deno.env.get('CRON_SECRET');
  
  if (!cronSecret || cronSecret !== expectedSecret) {
    // Fallback to JWT auth
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  try {
    const body = await req.json().catch(() => ({}));
    const {
      organization_id,
      limit = 500,
      time_window_minutes = 30,
      dry_run = false,
    } = body;

    if (!organization_id) {
      return new Response(JSON.stringify({ error: 'organization_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[BACKFILL] Starting click attribution backfill:', {
      organization_id,
      limit,
      time_window_minutes,
      dry_run,
    });

    // Fetch transactions with truncated/missing fbclid
    // These have refcode2 starting with fb_ but fbclid is either null, short, or matches refcode2
    const { data: transactions, error: txError } = await supabase
      .from('actblue_transactions')
      .select('id, transaction_id, donor_email, refcode, refcode2, fbclid, created_at, transaction_date')
      .eq('organization_id', organization_id)
      .like('refcode2', 'fb_%')
      .or('fbclid.is.null,fbclid.lt.50')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (txError) {
      console.error('[BACKFILL] Error fetching transactions:', txError);
      throw txError;
    }

    if (!transactions || transactions.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No transactions need backfill',
        processed: 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[BACKFILL] Found ${transactions.length} transactions to process`);

    // Fetch recent touchpoints for this org with fbclid in metadata
    const { data: touchpoints, error: tpError } = await supabase
      .from('attribution_touchpoints')
      .select('id, donor_email, refcode, metadata, occurred_at')
      .eq('organization_id', organization_id)
      .not('metadata', 'is', null)
      .order('occurred_at', { ascending: false })
      .limit(5000);

    if (tpError) {
      console.error('[BACKFILL] Error fetching touchpoints:', tpError);
      throw tpError;
    }

    // Filter touchpoints that have fbclid
    const touchpointsWithFbclid = (touchpoints || []).filter(tp => {
      const meta = tp.metadata as any;
      return meta?.fbclid && typeof meta.fbclid === 'string' && meta.fbclid.length > 50;
    });

    console.log(`[BACKFILL] Found ${touchpointsWithFbclid.length} touchpoints with full fbclid`);

    const results: MatchResult[] = [];
    const updates: { id: string; fbclid: string; match_confidence: string }[] = [];

    for (const tx of transactions) {
      const txDate = new Date(tx.transaction_date || tx.created_at);
      const windowStart = new Date(txDate.getTime() - time_window_minutes * 60 * 1000);
      
      let matchResult: MatchResult = {
        transaction_id: tx.transaction_id,
        matched_fbclid: null,
        match_confidence: 'none',
        match_method: 'none',
        touchpoint_id: null,
      };

      // 1. HIGH CONFIDENCE: Email + Time match
      if (tx.donor_email) {
        const emailMatches = touchpointsWithFbclid.filter(tp => {
          const tpDate = new Date(tp.occurred_at);
          return (
            tp.donor_email?.toLowerCase() === tx.donor_email?.toLowerCase() &&
            tpDate >= windowStart &&
            tpDate <= txDate
          );
        });

        if (emailMatches.length > 0) {
          // Pick the closest one to donation time
          const closest = emailMatches.reduce((prev, curr) => {
            const prevDiff = Math.abs(txDate.getTime() - new Date(prev.occurred_at).getTime());
            const currDiff = Math.abs(txDate.getTime() - new Date(curr.occurred_at).getTime());
            return currDiff < prevDiff ? curr : prev;
          });

          const meta = closest.metadata as any;
          matchResult = {
            transaction_id: tx.transaction_id,
            matched_fbclid: meta.fbclid,
            match_confidence: 'high',
            match_method: 'email_time',
            touchpoint_id: closest.id,
          };
        }
      }

      // 2. MEDIUM CONFIDENCE: Refcode + Time match
      if (matchResult.match_confidence === 'none' && tx.refcode) {
        const refcodeMatches = touchpointsWithFbclid.filter(tp => {
          const tpDate = new Date(tp.occurred_at);
          return (
            tp.refcode === tx.refcode &&
            tpDate >= windowStart &&
            tpDate <= txDate
          );
        });

        if (refcodeMatches.length > 0) {
          const closest = refcodeMatches.reduce((prev, curr) => {
            const prevDiff = Math.abs(txDate.getTime() - new Date(prev.occurred_at).getTime());
            const currDiff = Math.abs(txDate.getTime() - new Date(curr.occurred_at).getTime());
            return currDiff < prevDiff ? curr : prev;
          });

          const meta = closest.metadata as any;
          matchResult = {
            transaction_id: tx.transaction_id,
            matched_fbclid: meta.fbclid,
            match_confidence: 'medium',
            match_method: 'refcode_time',
            touchpoint_id: closest.id,
          };
        }
      }

      // 3. LOW CONFIDENCE: Truncated prefix match
      if (matchResult.match_confidence === 'none' && tx.refcode2?.startsWith('fb_')) {
        const truncatedPart = tx.refcode2.substring(3); // Remove 'fb_' prefix
        
        // Try to match by prefix OR by _aem_ suffix
        const prefixMatches = touchpointsWithFbclid.filter(tp => {
          const tpDate = new Date(tp.occurred_at);
          if (tpDate < windowStart || tpDate > txDate) return false;
          
          const meta = tp.metadata as any;
          const fullFbclid = meta.fbclid as string;
          
          // Check if the truncated part matches the start of the fbclid (legacy)
          if (fullFbclid.startsWith(truncatedPart)) return true;
          
          // Check if the truncated part matches the _aem_ suffix (new format)
          const aemIndex = fullFbclid.lastIndexOf('_aem_');
          if (aemIndex !== -1) {
            const suffix = fullFbclid.substring(aemIndex + 5);
            if (suffix === truncatedPart) return true;
          }
          
          // Check last N chars match
          if (fullFbclid.slice(-truncatedPart.length) === truncatedPart) return true;
          
          return false;
        });

        if (prefixMatches.length > 0) {
          const closest = prefixMatches.reduce((prev, curr) => {
            const prevDiff = Math.abs(txDate.getTime() - new Date(prev.occurred_at).getTime());
            const currDiff = Math.abs(txDate.getTime() - new Date(curr.occurred_at).getTime());
            return currDiff < prevDiff ? curr : prev;
          });

          const meta = closest.metadata as any;
          matchResult = {
            transaction_id: tx.transaction_id,
            matched_fbclid: meta.fbclid,
            match_confidence: 'low',
            match_method: 'prefix_time',
            touchpoint_id: closest.id,
          };
        }
      }

      results.push(matchResult);

      if (matchResult.matched_fbclid && matchResult.match_confidence !== 'none') {
        updates.push({
          id: tx.id,
          fbclid: matchResult.matched_fbclid,
          match_confidence: matchResult.match_confidence,
        });
      }
    }

    // Apply updates if not dry run
    let updateCount = 0;
    if (!dry_run && updates.length > 0) {
      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('actblue_transactions')
          .update({ 
            fbclid: update.fbclid,
            // Store match info in click_id field as backup
            click_id: update.fbclid.substring(0, 100),
          })
          .eq('id', update.id);

        if (updateError) {
          console.error(`[BACKFILL] Error updating tx ${update.id}:`, updateError);
        } else {
          updateCount++;
        }
      }
    }

    // Calculate summary stats
    const summary = {
      total_processed: transactions.length,
      matched_high: results.filter(r => r.match_confidence === 'high').length,
      matched_medium: results.filter(r => r.match_confidence === 'medium').length,
      matched_low: results.filter(r => r.match_confidence === 'low').length,
      unmatched: results.filter(r => r.match_confidence === 'none').length,
      updates_applied: dry_run ? 0 : updateCount,
    };

    console.log('[BACKFILL] Completed:', summary);

    return new Response(JSON.stringify({
      success: true,
      dry_run,
      summary,
      sample_matches: results.slice(0, 10),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[BACKFILL] Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
