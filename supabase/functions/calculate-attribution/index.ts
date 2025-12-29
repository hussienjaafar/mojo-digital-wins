import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

/**
 * Calculate Attribution
 * 
 * Enhanced multi-touch attribution (40-20-40 model) with:
 * - Refcode-based matching for deterministic attribution
 * - Email-based touchpoint matching for probabilistic attribution
 * - Better batch processing to handle large transaction volumes
 * - Support for both organic and paid channels
 */

interface AttributionResult {
  transaction_id: string;
  organization_id: string;
  donor_email: string | null;
  first_touch_channel: string;
  first_touch_campaign: string | null;
  first_touch_weight: number;
  last_touch_channel: string;
  last_touch_campaign: string | null;
  last_touch_weight: number;
  middle_touches: Array<{
    channel: string;
    campaign: string | null;
    utm_source: string | null;
    utm_medium: string | null;
    occurred_at: string;
    weight: number;
  }>;
  middle_touches_weight: number;
  total_touchpoints: number;
  attribution_method: string; // 'refcode' | 'touchpoint' | 'organic'
  attribution_calculated_at: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const { 
      organization_id, 
      days_back = 30, 
      batch_size = 200,
      force_recalculate = false 
    } = body;

    console.log(`[ATTRIBUTION] Starting for org ${organization_id || 'all'}, days_back=${days_back}, force=${force_recalculate}`);

    const cutoffDate = new Date(Date.now() - days_back * 24 * 60 * 60 * 1000).toISOString();
    
    // Build transaction query
    let txQuery = supabase
      .from('actblue_transactions')
      .select('id, transaction_id, organization_id, donor_email, transaction_date, refcode, refcode2, refcode_custom, source_campaign, amount, net_amount')
      .gte('transaction_date', cutoffDate)
      .neq('transaction_type', 'refund')
      .order('transaction_date', { ascending: false });

    if (organization_id) {
      txQuery = txQuery.eq('organization_id', organization_id);
    }

    const { data: transactions, error: txError } = await txQuery.limit(1000);

    if (txError) throw txError;

    console.log(`[ATTRIBUTION] Processing ${transactions?.length || 0} transactions`);

    let attributionsCreated = 0;
    let attributionsSkipped = 0;
    let refcodeMatches = 0;
    let touchpointMatches = 0;
    let organicMatches = 0;

    // Process in batches
    for (let i = 0; i < (transactions?.length || 0); i += batch_size) {
      const batch = transactions!.slice(i, i + batch_size);
      const attributions: AttributionResult[] = [];

      for (const transaction of batch) {
        // Check if attribution already exists (unless force recalculate)
        if (!force_recalculate) {
          const { data: existingAttribution } = await supabase
            .from('transaction_attribution')
            .select('id')
            .eq('transaction_id', transaction.transaction_id)
            .maybeSingle();

          if (existingAttribution) {
            attributionsSkipped++;
            continue;
          }
        }

        // Strategy 1: Try refcode-based attribution first (deterministic)
        const refcode = transaction.refcode || transaction.refcode2 || transaction.refcode_custom;
        let attributionMethod = 'organic';
        let touchpoints: any[] = [];

        if (refcode) {
          // Check if refcode maps to a campaign
          const { data: refcodeMapping } = await supabase
            .from('campaign_attribution')
            .select('*')
            .eq('organization_id', transaction.organization_id)
            .eq('refcode', refcode)
            .maybeSingle();

          if (refcodeMapping) {
            // Create synthetic touchpoint from refcode mapping
            touchpoints = [{
              touchpoint_type: refcodeMapping.utm_source || 'refcode',
              campaign_id: refcodeMapping.switchboard_campaign_id || refcodeMapping.meta_campaign_id,
              utm_source: refcodeMapping.utm_source,
              utm_medium: refcodeMapping.utm_medium,
              utm_campaign: refcodeMapping.utm_campaign,
              occurred_at: transaction.transaction_date, // Use transaction date as proxy
            }];
            attributionMethod = 'refcode';
            refcodeMatches++;
          }
        }

        // Strategy 2: If no refcode match, try email-based touchpoint matching
        if (touchpoints.length === 0 && transaction.donor_email) {
          const { data: emailTouchpoints, error: touchpointsError } = await supabase
            .from('attribution_touchpoints')
            .select('*')
            .eq('donor_email', transaction.donor_email)
            .eq('organization_id', transaction.organization_id)
            .lte('occurred_at', transaction.transaction_date)
            .gte('occurred_at', new Date(new Date(transaction.transaction_date).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Look back 30 days from transaction
            .order('occurred_at', { ascending: true });

          if (!touchpointsError && emailTouchpoints && emailTouchpoints.length > 0) {
            touchpoints = emailTouchpoints;
            attributionMethod = 'touchpoint';
            touchpointMatches++;
          }
        }

        // Strategy 3: Check source_campaign field
        if (touchpoints.length === 0 && transaction.source_campaign) {
          touchpoints = [{
            touchpoint_type: 'source_campaign',
            campaign_id: transaction.source_campaign,
            utm_source: null,
            utm_medium: null,
            occurred_at: transaction.transaction_date,
          }];
          attributionMethod = 'source_campaign';
        }

        // Build attribution record
        if (touchpoints.length === 0) {
          // No touchpoints found - mark as direct/organic
          organicMatches++;
          attributions.push({
            transaction_id: transaction.transaction_id,
            organization_id: transaction.organization_id,
            donor_email: transaction.donor_email,
            first_touch_channel: 'organic',
            first_touch_campaign: null,
            first_touch_weight: 1.0,
            last_touch_channel: 'organic',
            last_touch_campaign: null,
            last_touch_weight: 0,
            middle_touches: [],
            middle_touches_weight: 0,
            total_touchpoints: 0,
            attribution_method: 'organic',
            attribution_calculated_at: new Date().toISOString(),
          });
        } else {
          // Multi-touch attribution: 40-20-40 model
          const firstTouch = touchpoints[0];
          const lastTouch = touchpoints[touchpoints.length - 1];
          const middleTouches = touchpoints.length > 2 ? touchpoints.slice(1, -1) : [];
          
          attributions.push({
            transaction_id: transaction.transaction_id,
            organization_id: transaction.organization_id,
            donor_email: transaction.donor_email,
            first_touch_channel: firstTouch.touchpoint_type,
            first_touch_campaign: firstTouch.campaign_id,
            first_touch_weight: 0.4,
            last_touch_channel: lastTouch.touchpoint_type,
            last_touch_campaign: lastTouch.campaign_id,
            last_touch_weight: touchpoints.length > 1 ? 0.4 : 0.6,
            middle_touches: middleTouches.map(tp => ({
              channel: tp.touchpoint_type,
              campaign: tp.campaign_id,
              utm_source: tp.utm_source,
              utm_medium: tp.utm_medium,
              occurred_at: tp.occurred_at,
              weight: middleTouches.length > 0 ? 0.2 / middleTouches.length : 0
            })),
            middle_touches_weight: middleTouches.length > 0 ? 0.2 : 0,
            total_touchpoints: touchpoints.length,
            attribution_method: attributionMethod,
            attribution_calculated_at: new Date().toISOString(),
          });
        }
      }

      // Upsert batch
      if (attributions.length > 0) {
        const { error: upsertError } = await supabase
          .from('transaction_attribution')
          .upsert(attributions, { onConflict: 'transaction_id' });

        if (upsertError) {
          console.error(`[ATTRIBUTION] Batch upsert error:`, upsertError);
        } else {
          attributionsCreated += attributions.length;
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[ATTRIBUTION] Complete. Created ${attributionsCreated}, skipped ${attributionsSkipped} in ${duration}ms`);
    console.log(`[ATTRIBUTION] Methods: refcode=${refcodeMatches}, touchpoint=${touchpointMatches}, organic=${organicMatches}`);

    // Update processing checkpoint
    try {
      await supabase.rpc('update_processing_checkpoint', {
        p_function_name: 'calculate-attribution',
        p_records_processed: attributionsCreated,
        p_checkpoint_data: {
          organization_id,
          refcode_matches: refcodeMatches,
          touchpoint_matches: touchpointMatches,
          organic_matches: organicMatches,
        },
      });
    } catch (_) { /* ignore */ }

    return new Response(
      JSON.stringify({ 
        success: true, 
        attributions_created: attributionsCreated,
        attributions_skipped: attributionsSkipped,
        total_transactions: transactions?.length || 0,
        duration_ms: duration,
        breakdown: {
          refcode: refcodeMatches,
          touchpoint: touchpointMatches,
          organic: organicMatches,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ATTRIBUTION] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
