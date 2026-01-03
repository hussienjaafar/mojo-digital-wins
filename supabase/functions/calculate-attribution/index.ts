import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret, x-scheduled-job',
};

/**
 * ================================================================================
 * CALCULATE ATTRIBUTION - SIMPLIFIED (Refcode-only)
 * ================================================================================
 * 
 * This function calculates attribution using ONLY deterministic refcode matching.
 * 
 * REMOVED:
 * - Email-based touchpoint matching (touchpoints table was all "other" type)
 * - Multi-touch 40-20-40 model (we don't have the data for true multi-touch)
 * 
 * KEPT:
 * - refcode_mappings lookup for deterministic attribution
 * - source_campaign field as fallback
 * - Organic classification for unattributed donations
 * 
 * OUTPUT: Writes to transaction_attribution table
 * NOTE: This table is DEPRECATED - campaign_attribution is the source of truth
 * ================================================================================
 */

interface RefcodeMapping {
  id: string;
  organization_id: string;
  refcode: string;
  platform: string;
  campaign_id: string | null;
  campaign_name: string | null;
  ad_id: string | null;
  ad_name: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
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

    console.log(`[CALC-ATTR] Starting for org ${organization_id || 'all'}, days_back=${days_back}`);

    const cutoffDate = new Date(Date.now() - days_back * 24 * 60 * 60 * 1000).toISOString();
    
    // Load refcode mappings for deterministic matching
    const { data: allRefcodeMappings, error: mappingsError } = await supabase
      .from('refcode_mappings')
      .select('*');
    
    if (mappingsError) {
      console.error('[CALC-ATTR] Error loading refcode_mappings:', mappingsError);
    }

    // Create lookup map for O(1) lookups
    const refcodeLookup = new Map<string, RefcodeMapping>();
    if (allRefcodeMappings) {
      for (const mapping of allRefcodeMappings) {
        const key = `${mapping.organization_id}:${mapping.refcode}`;
        refcodeLookup.set(key, mapping);
      }
      console.log(`[CALC-ATTR] Loaded ${allRefcodeMappings.length} refcode mappings`);
    }

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

    const { data: transactions, error: txError } = await txQuery.limit(2000);

    if (txError) throw txError;

    console.log(`[CALC-ATTR] Processing ${transactions?.length || 0} transactions`);

    let attributionsCreated = 0;
    let attributionsSkipped = 0;
    let refcodeMatches = 0;
    let sourceCampaignMatches = 0;
    let organicMatches = 0;

    // Get existing attributions if not force recalculating
    const existingTransactionIds = new Set<string>();
    if (!force_recalculate && transactions && transactions.length > 0) {
      const txIds = transactions.map(t => t.transaction_id);
      const { data: existingAttrs } = await supabase
        .from('transaction_attribution')
        .select('transaction_id')
        .in('transaction_id', txIds);
      
      if (existingAttrs) {
        for (const attr of existingAttrs) {
          existingTransactionIds.add(attr.transaction_id);
        }
      }
    }

    // Process in batches
    for (let i = 0; i < (transactions?.length || 0); i += batch_size) {
      const batch = transactions!.slice(i, i + batch_size);
      const attributions: any[] = [];

      for (const transaction of batch) {
        // Check if attribution already exists
        if (!force_recalculate && existingTransactionIds.has(transaction.transaction_id)) {
          attributionsSkipped++;
          continue;
        }

        // Strategy 1: Refcode-based attribution (deterministic)
        const refcodes = [
          transaction.refcode,
          transaction.refcode2,
          transaction.refcode_custom
        ].filter(Boolean);
        
        let attributionMethod = 'organic';
        let matchedMapping: RefcodeMapping | null = null;

        for (const refcode of refcodes) {
          if (refcode) {
            const key = `${transaction.organization_id}:${refcode}`;
            const mapping = refcodeLookup.get(key);
            if (mapping) {
              matchedMapping = mapping;
              attributionMethod = 'refcode';
              refcodeMatches++;
              break;
            }
          }
        }

        // Strategy 2: source_campaign field (if no refcode match)
        if (!matchedMapping && transaction.source_campaign) {
          attributionMethod = 'source_campaign';
          sourceCampaignMatches++;
        }

        // Build attribution record
        if (matchedMapping) {
          attributions.push({
            transaction_id: transaction.transaction_id,
            organization_id: transaction.organization_id,
            donor_email: transaction.donor_email,
            first_touch_channel: matchedMapping.platform || 'paid',
            first_touch_campaign: matchedMapping.campaign_id || matchedMapping.campaign_name,
            first_touch_weight: 1.0,
            last_touch_channel: matchedMapping.platform || 'paid',
            last_touch_campaign: matchedMapping.campaign_id || matchedMapping.campaign_name,
            last_touch_weight: 0,
            middle_touches: [],
            middle_touches_weight: 0,
            total_touchpoints: 1,
            attribution_method: attributionMethod,
            attribution_calculated_at: new Date().toISOString(),
          });
        } else if (transaction.source_campaign) {
          attributions.push({
            transaction_id: transaction.transaction_id,
            organization_id: transaction.organization_id,
            donor_email: transaction.donor_email,
            first_touch_channel: 'source_campaign',
            first_touch_campaign: transaction.source_campaign,
            first_touch_weight: 1.0,
            last_touch_channel: 'source_campaign',
            last_touch_campaign: transaction.source_campaign,
            last_touch_weight: 0,
            middle_touches: [],
            middle_touches_weight: 0,
            total_touchpoints: 1,
            attribution_method: attributionMethod,
            attribution_calculated_at: new Date().toISOString(),
          });
        } else {
          // No match - mark as organic
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
        }
      }

      // Upsert batch
      if (attributions.length > 0) {
        const { error: upsertError } = await supabase
          .from('transaction_attribution')
          .upsert(attributions, { onConflict: 'transaction_id' });

        if (upsertError) {
          console.error(`[CALC-ATTR] Batch upsert error:`, upsertError);
        } else {
          attributionsCreated += attributions.length;
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[CALC-ATTR] Complete. Created ${attributionsCreated}, skipped ${attributionsSkipped} in ${duration}ms`);
    console.log(`[CALC-ATTR] Methods: refcode=${refcodeMatches}, source_campaign=${sourceCampaignMatches}, organic=${organicMatches}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        attributions_created: attributionsCreated,
        attributions_skipped: attributionsSkipped,
        total_transactions: transactions?.length || 0,
        refcode_mappings_loaded: refcodeLookup.size,
        duration_ms: duration,
        breakdown: {
          refcode: refcodeMatches,
          source_campaign: sourceCampaignMatches,
          organic: organicMatches,
        },
        // NOTE: This table is deprecated, campaign_attribution is the source of truth
        deprecation_notice: 'transaction_attribution table is deprecated. Use campaign_attribution for refcode->campaign mappings.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CALC-ATTR] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
