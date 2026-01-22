import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Aggregate Variation Metrics
 * 
 * Distributes parent ad metrics to variations when Meta's asset-level breakdown API
 * returns empty data. This provides estimated performance data for variation analysis.
 * 
 * Priority:
 * 1. Use actual asset-level breakdown data from Meta (if available)
 * 2. Fall back to proportional distribution from parent ad metrics
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const { organization_id } = body;

    console.log('[AGGREGATE VARIATION METRICS] Starting...', { organization_id });

    // Find variations with zero/null metrics
    let variationsQuery = supabase
      .from('meta_creative_variations')
      .select('id, ad_id, asset_type, asset_index, organization_id, impressions, clicks, spend')
      .or('impressions.is.null,impressions.eq.0');

    if (organization_id) {
      variationsQuery = variationsQuery.eq('organization_id', organization_id);
    }

    const { data: variations, error: fetchError } = await variationsQuery;

    if (fetchError) {
      throw new Error(`Error fetching variations: ${fetchError.message}`);
    }

    if (!variations || variations.length === 0) {
      console.log('[AGGREGATE VARIATION] No variations with missing metrics found');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No variations need aggregation',
          processed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[AGGREGATE VARIATION] Found ${variations.length} variations with missing metrics`);

    // Group variations by ad_id and asset_type
    const variationGroups: Record<string, typeof variations> = {};
    for (const v of variations) {
      const key = `${v.organization_id}:${v.ad_id}:${v.asset_type}`;
      if (!variationGroups[key]) {
        variationGroups[key] = [];
      }
      variationGroups[key].push(v);
    }

    let updatedCount = 0;
    let skippedNoParent = 0;

    // Process each group
    for (const [key, groupVariations] of Object.entries(variationGroups)) {
      const [orgId, adId, assetType] = key.split(':');
      
      // Get parent ad metrics from meta_creative_insights
      const { data: parentAd, error: parentError } = await supabase
        .from('meta_creative_insights')
        .select('impressions, clicks, spend, conversions, conversion_value, ctr, roas')
        .eq('organization_id', orgId)
        .eq('ad_id', adId)
        .single();

      if (parentError || !parentAd) {
        console.log(`[AGGREGATE VARIATION] No parent ad found for ${adId}`);
        skippedNoParent += groupVariations.length;
        continue;
      }

      // Skip if parent has no data either
      if (!parentAd.impressions && !parentAd.spend) {
        console.log(`[AGGREGATE VARIATION] Parent ad ${adId} has no metrics to distribute`);
        skippedNoParent += groupVariations.length;
        continue;
      }

      // Distribute metrics evenly among variations in this group
      const divisor = groupVariations.length;
      const distributedMetrics = {
        impressions: Math.floor((parentAd.impressions || 0) / divisor),
        clicks: Math.floor((parentAd.clicks || 0) / divisor),
        spend: (parentAd.spend || 0) / divisor,
        conversions: Math.floor((parentAd.conversions || 0) / divisor),
        conversion_value: (parentAd.conversion_value || 0) / divisor,
        is_estimated: true, // Mark as estimated data
      };

      // Calculate derived metrics
      const ctr = distributedMetrics.impressions > 0 
        ? distributedMetrics.clicks / distributedMetrics.impressions 
        : null;
      const linkCtr = ctr; // Use same value as fallback
      const roas = distributedMetrics.spend > 0 
        ? distributedMetrics.conversion_value / distributedMetrics.spend 
        : null;

      console.log(`[AGGREGATE VARIATION] Distributing to ${divisor} ${assetType} variations for ad ${adId}: ${distributedMetrics.impressions} imp each`);

      // Update each variation in the group
      for (let i = 0; i < groupVariations.length; i++) {
        const variation = groupVariations[i];
        
        const { error: updateError } = await supabase
          .from('meta_creative_variations')
          .update({
            impressions: distributedMetrics.impressions,
            clicks: distributedMetrics.clicks,
            spend: distributedMetrics.spend,
            conversions: distributedMetrics.conversions,
            conversion_value: distributedMetrics.conversion_value,
            ctr,
            link_clicks: distributedMetrics.clicks, // Fallback
            link_ctr: linkCtr,
            roas,
            is_estimated: true,
            performance_rank: i + 1, // Assign rank by position (will be re-ranked if actual data comes)
            synced_at: new Date().toISOString(),
          })
          .eq('id', variation.id);

        if (!updateError) {
          updatedCount++;
        } else {
          console.error(`[AGGREGATE VARIATION] Error updating variation ${variation.id}:`, updateError);
        }
      }
    }

    console.log(`[AGGREGATE VARIATION] Complete: ${updatedCount} updated, ${skippedNoParent} skipped (no parent data)`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: variations.length,
        updated: updatedCount,
        skipped_no_parent: skippedNoParent,
        groups_processed: Object.keys(variationGroups).length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AGGREGATE VARIATION METRICS] Error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
