import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

/**
 * Resend CAPI events with corrected full fbclid
 * 
 * For historical events that were sent with truncated fbc (≤50 chars),
 * this function finds the full fbclid from actblue_transactions.fbclid
 * and creates corrected events to send to Meta.
 * 
 * Uses same event_id for Meta deduplication - Meta will use the latest data.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Auth check: cron secret or admin JWT
    const cronSecret = req.headers.get('x-cron-secret');
    const expectedCronSecret = Deno.env.get('CRON_SECRET');
    let isAuthed = cronSecret && expectedCronSecret && cronSecret === expectedCronSecret;

    if (!isAuthed) {
      const authHeader = req.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
          global: { headers: { Authorization: `Bearer ${token}` } }
        });
        const { data: { user } } = await userClient.auth.getUser();
        if (user) {
          const { data: hasRole } = await supabase.rpc('has_role', { 
            _user_id: user.id, 
            _role: 'admin' 
          });
          isAuthed = hasRole === true;
        }
      }
    }

    if (!isAuthed) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json().catch(() => ({}));
    const { 
      organization_id, 
      dry_run = true,
      limit = 100 
    } = body;

    if (!organization_id) {
      return new Response(JSON.stringify({ error: 'organization_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[RESEND-CAPI] Starting with:', { organization_id, dry_run, limit });

    // Find events with truncated fbc (sent status, fbc length ≤ 50)
    // Join with actblue_transactions to find full fbclid
    const { data: truncatedEvents, error: queryError } = await supabase
      .from('meta_conversion_events')
      .select(`
        id, 
        event_id, 
        event_name,
        event_time,
        event_source_url,
        source_id, 
        fbc, 
        fbp,
        user_data_hashed,
        custom_data,
        pixel_id,
        refcode,
        external_id,
        dedupe_key,
        match_score,
        match_quality,
        is_enrichment_only,
        status
      `)
      .eq('organization_id', organization_id)
      .in('status', ['sent', 'delivered'])
      .order('created_at', { ascending: false })
      .limit(limit * 2); // Fetch extra since we'll filter

    if (queryError) {
      console.error('[RESEND-CAPI] Query error:', queryError);
      throw queryError;
    }

    // Filter to events with truncated fbc (client-side since SQL length() is complex)
    const eventsWithTruncatedFbc = (truncatedEvents || []).filter(e => {
      const fbcLen = e.fbc?.length || 0;
      return fbcLen > 0 && fbcLen <= 50;
    }).slice(0, limit);

    console.log('[RESEND-CAPI] Found events with truncated fbc:', eventsWithTruncatedFbc.length);

    if (eventsWithTruncatedFbc.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No events with truncated fbc found',
        corrected: 0,
        dry_run
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get source_ids to lookup full fbclid
    const sourceIds = eventsWithTruncatedFbc.map(e => e.source_id).filter(Boolean);
    
    // Lookup full fbclid from actblue_transactions
    const { data: transactions, error: txError } = await supabase
      .from('actblue_transactions')
      .select('transaction_id, fbclid')
      .eq('organization_id', organization_id)
      .in('transaction_id', sourceIds);

    if (txError) {
      console.error('[RESEND-CAPI] Transaction lookup error:', txError);
      throw txError;
    }

    // Build lookup map: transaction_id -> full fbclid (only if > 50 chars)
    const fullFbclidMap = new Map<string, string>();
    for (const tx of transactions || []) {
      if (tx.fbclid && tx.fbclid.length > 50) {
        fullFbclidMap.set(tx.transaction_id, tx.fbclid);
      }
    }

    console.log('[RESEND-CAPI] Found full fbclid for transactions:', fullFbclidMap.size);

    // Also check attribution_touchpoints for any we missed
    // Match by _aem_ suffix pattern
    for (const event of eventsWithTruncatedFbc) {
      if (fullFbclidMap.has(event.source_id)) continue;
      
      const truncatedPart = event.fbc || '';
      if (!truncatedPart) continue;

      // Try to find matching touchpoint by suffix
      const { data: touchpoints } = await supabase
        .from('attribution_touchpoints')
        .select('metadata')
        .eq('organization_id', organization_id)
        .not('metadata', 'is', null)
        .limit(50);

      for (const tp of touchpoints || []) {
        const meta = tp.metadata as any;
        const fullFbclid = meta?.fbclid as string;
        
        if (!fullFbclid || fullFbclid.length <= 50) continue;

        // Check various match patterns
        const isMatch = 
          fullFbclid.startsWith(truncatedPart) ||
          fullFbclid.endsWith(truncatedPart) ||
          fullFbclid.includes(`_aem_${truncatedPart}`) ||
          fullFbclid.slice(-truncatedPart.length) === truncatedPart;

        if (isMatch) {
          fullFbclidMap.set(event.source_id, fullFbclid);
          console.log('[RESEND-CAPI] Recovered fbclid from touchpoint:', {
            sourceId: event.source_id,
            truncated: truncatedPart.substring(0, 20),
            fullLength: fullFbclid.length
          });
          break;
        }
      }
    }

    const results: any[] = [];
    let correctedCount = 0;
    let skippedCount = 0;

    for (const event of eventsWithTruncatedFbc) {
      const fullFbclid = fullFbclidMap.get(event.source_id);
      
      if (!fullFbclid) {
        skippedCount++;
        results.push({
          event_id: event.event_id,
          source_id: event.source_id,
          status: 'skipped',
          reason: 'No full fbclid found'
        });
        continue;
      }

      // Fix event_id format if it was wrong in the original
      // For enrichment mode, event_id should be raw lineitem_id (source_id) to match ActBlue pixel
      const correctedEventId = event.is_enrichment_only && event.event_id.startsWith('actblue_')
        ? event.source_id  // Use raw lineitem_id for enrichment mode
        : event.event_id;
      
      if (correctedEventId !== event.event_id) {
        console.log('[RESEND-CAPI] Correcting event_id format:', {
          old: event.event_id,
          new: correctedEventId,
          reason: 'enrichment mode requires raw lineitem_id'
        });
      }

      // Create corrected event (or preview)
      const correctedEventData = {
        organization_id,
        pixel_id: event.pixel_id,
        event_id: correctedEventId, // Corrected event_id for proper Meta deduplication
        event_name: event.event_name,
        event_time: event.event_time,
        event_source_url: event.event_source_url,
        user_data_hashed: event.user_data_hashed,
        custom_data: event.custom_data,
        refcode: event.refcode,
        fbp: event.fbp,
        fbc: fullFbclid, // CORRECTED: Full fbclid
        external_id: event.external_id,
        dedupe_key: `${event.dedupe_key}_corrected`, // New dedupe key so it's not skipped
        source_type: 'enrichment_resend',
        source_id: event.source_id,
        match_score: Math.min((event.match_score || 0) + 50, 200), // Boost score for having full fbc
        match_quality: 'excellent', // Full fbc = excellent match
        is_enrichment_only: event.is_enrichment_only,
        status: 'pending',
        retry_count: 0,
        max_attempts: 5,
        next_retry_at: new Date().toISOString(),
      };

      if (!dry_run) {
        // Insert corrected event
        const { error: insertError } = await supabase
          .from('meta_conversion_events')
          .insert(correctedEventData);

        if (insertError) {
          console.error('[RESEND-CAPI] Insert error:', insertError);
          results.push({
            event_id: event.event_id,
            source_id: event.source_id,
            status: 'error',
            error: insertError.message
          });
          continue;
        }

        // Mark original as superseded
        await supabase
          .from('meta_conversion_events')
          .update({ 
            status: 'superseded',
            last_error: `Superseded by corrected event with full fbclid (${fullFbclid.length} chars)`
          })
          .eq('id', event.id);
      }

      correctedCount++;
      results.push({
        event_id: event.event_id,
        source_id: event.source_id,
        status: dry_run ? 'would_correct' : 'corrected',
        truncated_fbc_length: event.fbc?.length,
        full_fbclid_length: fullFbclid.length,
        preview: dry_run ? {
          old_fbc: event.fbc?.substring(0, 20) + '...',
          new_fbc: fullFbclid.substring(0, 20) + '...' + fullFbclid.slice(-20)
        } : undefined
      });
    }

    console.log('[RESEND-CAPI] Complete:', { correctedCount, skippedCount, dry_run });

    return new Response(JSON.stringify({
      success: true,
      dry_run,
      corrected: correctedCount,
      skipped: skippedCount,
      total_checked: eventsWithTruncatedFbc.length,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[RESEND-CAPI] Error:', message);
    return new Response(JSON.stringify({ 
      success: false, 
      error: message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
