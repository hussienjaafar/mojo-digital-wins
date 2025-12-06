import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    console.log('[AGGREGATE CREATIVE METRICS] Starting aggregation...');

    // Get all creatives that need metrics aggregation
    let query = supabase
      .from('meta_creative_insights')
      .select('id, campaign_id, organization_id, impressions, clicks, spend, conversions, conversion_value');

    if (organization_id) {
      query = query.eq('organization_id', organization_id);
    }

    const { data: creatives, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Error fetching creatives: ${fetchError.message}`);
    }

    if (!creatives || creatives.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No creatives found to aggregate',
          processed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[AGGREGATE] Found ${creatives.length} creatives to process`);

    let successCount = 0;
    let updatedCount = 0;

    // Group by organization and campaign for efficient querying
    const campaignMetrics: Record<string, { impressions: number; clicks: number; spend: number; conversions: number; conversionValue: number }> = {};

    // Fetch aggregated metrics for each unique campaign
    const uniqueCampaigns = [...new Set(creatives.map(c => `${c.organization_id}:${c.campaign_id}`))];
    
    for (const key of uniqueCampaigns) {
      const [orgId, campaignId] = key.split(':');
      
      const { data: metrics, error: metricsError } = await supabase
        .from('meta_ad_metrics')
        .select('impressions, clicks, spend, conversions, conversion_value')
        .eq('organization_id', orgId)
        .eq('campaign_id', campaignId);

      if (metricsError) {
        console.error(`[AGGREGATE] Error fetching metrics for campaign ${campaignId}:`, metricsError);
        continue;
      }

      if (metrics && metrics.length > 0) {
        campaignMetrics[key] = {
          impressions: metrics.reduce((sum, m) => sum + (m.impressions || 0), 0),
          clicks: metrics.reduce((sum, m) => sum + (m.clicks || 0), 0),
          spend: metrics.reduce((sum, m) => sum + (m.spend || 0), 0),
          conversions: metrics.reduce((sum, m) => sum + (m.conversions || 0), 0),
          conversionValue: metrics.reduce((sum, m) => sum + (m.conversion_value || 0), 0),
        };
      }
    }

    console.log(`[AGGREGATE] Found metrics for ${Object.keys(campaignMetrics).length} campaigns`);

    // Update creatives with aggregated metrics
    for (const creative of creatives) {
      const key = `${creative.organization_id}:${creative.campaign_id}`;
      const metrics = campaignMetrics[key];

      if (!metrics) {
        successCount++;
        continue;
      }

      // Only update if aggregated metrics are higher than current
      const shouldUpdate = 
        metrics.impressions > (creative.impressions || 0) ||
        metrics.spend > (creative.spend || 0);

      if (shouldUpdate) {
        // Calculate derived metrics
        const ctr = metrics.impressions > 0 ? metrics.clicks / metrics.impressions : 0;
        const roas = metrics.spend > 0 ? metrics.conversionValue / metrics.spend : 0;

        const { error: updateError } = await supabase
          .from('meta_creative_insights')
          .update({
            impressions: metrics.impressions,
            clicks: metrics.clicks,
            spend: metrics.spend,
            conversions: metrics.conversions,
            conversion_value: metrics.conversionValue,
            ctr: ctr,
            roas: roas,
          })
          .eq('id', creative.id);

        if (updateError) {
          console.error(`[AGGREGATE] Error updating creative ${creative.id}:`, updateError);
        } else {
          updatedCount++;
          console.log(`[AGGREGATE] Updated creative ${creative.id}: impressions ${creative.impressions || 0} -> ${metrics.impressions}`);
        }
      }
      successCount++;
    }

    console.log(`[AGGREGATE] Complete: ${successCount} processed, ${updatedCount} updated`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: successCount,
        updated: updatedCount,
        campaignsWithMetrics: Object.keys(campaignMetrics).length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AGGREGATE CREATIVE METRICS] Error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
