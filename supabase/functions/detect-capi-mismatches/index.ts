import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

interface MismatchResult {
  event_id: string;
  transaction_id: string;
  transaction_donor: string | null;
  touchpoint_donor: string | null;
  incorrect_fbc: string;
  correct_fbc: string | null;
  status: 'correctable' | 'uncorrectable' | 'valid';
  mismatch_reason: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate: require cron secret or admin JWT
    const cronSecret = req.headers.get('x-cron-secret');
    const expectedCronSecret = Deno.env.get('CRON_SECRET');
    
    let isAuthorized = cronSecret && expectedCronSecret && cronSecret === expectedCronSecret;
    
    if (!isAuthorized) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
          global: { headers: { Authorization: `Bearer ${token}` } }
        });
        const { data: { user } } = await userClient.auth.getUser();
        if (user) {
          const { data: hasRole } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
          isAuthorized = !!hasRole;
        }
      }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json().catch(() => ({}));
    const organizationId = body.organization_id;
    const dryRun = body.dry_run !== false; // Default to dry run for safety
    const limit = body.limit || 100;

    console.log('[MISMATCH] Starting detection', { organizationId, dryRun, limit });

    // Find events with full fbc (length > 50) that aren't superseded
    const { data: events, error: eventsError } = await supabase
      .from('meta_conversion_events')
      .select('id, event_id, source_id, fbc, status, organization_id, user_data_hashed')
      .eq('organization_id', organizationId)
      .not('fbc', 'is', null)
      .not('status', 'eq', 'superseded')
      .not('status', 'eq', 'misattributed')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (eventsError) {
      throw new Error(`Failed to fetch events: ${eventsError.message}`);
    }

    // Filter to events with full fbc
    const fullFbcEvents = (events || []).filter(e => e.fbc && e.fbc.length > 50);
    console.log('[MISMATCH] Found events with full fbc:', fullFbcEvents.length);

    const results: MismatchResult[] = [];
    let mismatchCount = 0;
    let correctableCount = 0;

    for (const event of fullFbcEvents) {
      // Get the transaction to find donor email
      const { data: transaction } = await supabase
        .from('actblue_transactions')
        .select('donor_email, transaction_id')
        .eq('transaction_id', event.source_id)
        .eq('organization_id', event.organization_id)
        .maybeSingle();

      if (!transaction) {
        console.log('[MISMATCH] No transaction found for event:', event.event_id);
        continue;
      }

      const txDonorEmail = transaction.donor_email?.toLowerCase();

      // Find the touchpoint that has this exact fbc
      const { data: matchingTouchpoint } = await supabase
        .from('attribution_touchpoints')
        .select('id, donor_email, metadata')
        .eq('organization_id', event.organization_id)
        .filter('metadata->>fbclid', 'eq', event.fbc)
        .maybeSingle();

      if (!matchingTouchpoint) {
        // No touchpoint found with this fbc - can't validate ownership
        results.push({
          event_id: event.event_id,
          transaction_id: event.source_id,
          transaction_donor: txDonorEmail || null,
          touchpoint_donor: null,
          incorrect_fbc: event.fbc,
          correct_fbc: null,
          status: 'valid', // Can't prove it's wrong
          mismatch_reason: 'no_touchpoint_found'
        });
        continue;
      }

      const tpDonorEmail = matchingTouchpoint.donor_email?.toLowerCase();

      // Check if emails match
      if (tpDonorEmail && txDonorEmail && tpDonorEmail !== txDonorEmail) {
        // MISMATCH DETECTED: The fbc belongs to a different donor!
        mismatchCount++;

        // Try to find the CORRECT fbclid for this transaction's donor
        let correctFbc: string | null = null;
        
        const { data: correctTouchpoint } = await supabase
          .from('attribution_touchpoints')
          .select('metadata')
          .eq('organization_id', event.organization_id)
          .eq('donor_email', txDonorEmail)
          .not('metadata', 'is', null)
          .order('occurred_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (correctTouchpoint?.metadata) {
          const meta = correctTouchpoint.metadata as any;
          if (meta.fbclid && meta.fbclid.length > 50) {
            correctFbc = meta.fbclid;
            correctableCount++;
          }
        }

        const result: MismatchResult = {
          event_id: event.event_id,
          transaction_id: event.source_id,
          transaction_donor: txDonorEmail,
          touchpoint_donor: tpDonorEmail,
          incorrect_fbc: event.fbc,
          correct_fbc: correctFbc,
          status: correctFbc ? 'correctable' : 'uncorrectable',
          mismatch_reason: 'email_mismatch'
        };

        results.push(result);

        // If not dry run and correctable, mark original as misattributed
        if (!dryRun && correctFbc) {
          await supabase
            .from('meta_conversion_events')
            .update({ 
              status: 'misattributed',
              metadata: {
                ...(event as any).metadata,
                misattribution_detected_at: new Date().toISOString(),
                incorrect_fbc: event.fbc,
                correct_fbc: correctFbc,
                transaction_donor: txDonorEmail,
                touchpoint_donor: tpDonorEmail
              }
            })
            .eq('id', event.id);

          console.log('[MISMATCH] Marked event as misattributed:', event.event_id);
        }
      } else if (!tpDonorEmail) {
        // Touchpoint has no email - can't validate but flagging for review
        results.push({
          event_id: event.event_id,
          transaction_id: event.source_id,
          transaction_donor: txDonorEmail || null,
          touchpoint_donor: null,
          incorrect_fbc: event.fbc,
          correct_fbc: null,
          status: 'valid', // Unverifiable, treat as valid
          mismatch_reason: 'touchpoint_no_email'
        });
      } else {
        // Emails match - valid attribution
        results.push({
          event_id: event.event_id,
          transaction_id: event.source_id,
          transaction_donor: txDonorEmail || null,
          touchpoint_donor: tpDonorEmail,
          incorrect_fbc: event.fbc,
          correct_fbc: null,
          status: 'valid',
          mismatch_reason: 'none'
        });
      }
    }

    const summary = {
      total_checked: fullFbcEvents.length,
      mismatches_detected: mismatchCount,
      correctable: correctableCount,
      uncorrectable: mismatchCount - correctableCount,
      dry_run: dryRun,
      organization_id: organizationId
    };

    console.log('[MISMATCH] Detection complete:', summary);

    return new Response(JSON.stringify({
      success: true,
      summary,
      results: results.filter(r => r.status !== 'valid'), // Only return mismatches
      all_results: results // Include all for debugging
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[MISMATCH] Error:', errorMessage);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
