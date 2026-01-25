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

    console.log('[AGGREGATE CREATIVE METRICS] Starting aggregation...', { organization_id });

    // Get all creatives that need metrics aggregation (zero or null metrics)
    let query = supabase
      .from('meta_creative_insights')
      .select('id, campaign_id, ad_id, organization_id, impressions, clicks, link_clicks, spend, conversions, conversion_value, ctr, link_ctr, roas');

    if (organization_id) {
      query = query.eq('organization_id', organization_id);
    }

    // Focus on creatives with missing/zero metrics
    query = query.or('impressions.is.null,impressions.eq.0');

    const { data: creatives, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Error fetching creatives: ${fetchError.message}`);
    }

    if (!creatives || creatives.length === 0) {
      console.log('[AGGREGATE] No creatives with missing metrics found');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No creatives need aggregation',
          processed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[AGGREGATE] Found ${creatives.length} creatives with missing metrics`);

    let successCount = 0;
    let updatedCount = 0;
    let adLevelMatches = 0;
    let campaignLevelFallbacks = 0;

    // Process each creative
    for (const creative of creatives) {
      try {
        let metricsFound = false;
        let aggregatedMetrics = {
          impressions: 0,
          clicks: 0,
          linkClicks: 0,
          spend: 0,
          conversions: 0,
          conversionValue: 0,
          metaRoas: null as number | null,
        };

        // PRIORITY 1: Try ad-level match from meta_ad_metrics_daily (most accurate)
        if (creative.ad_id) {
          const { data: adMetrics, error: adError } = await supabase
            .from('meta_ad_metrics_daily')
            .select('impressions, clicks, link_clicks, spend, conversions, conversion_value, meta_roas')
            .eq('organization_id', creative.organization_id)
            .eq('ad_id', creative.ad_id);

          if (!adError && adMetrics && adMetrics.length > 0) {
            // Calculate weighted average for meta_roas (weight by spend)
            const totalSpend = adMetrics.reduce((sum, m) => sum + (m.spend || 0), 0);
            let weightedRoas: number | null = null;
            if (totalSpend > 0) {
              const roasSum = adMetrics.reduce((sum, m) => {
                if (m.meta_roas && m.spend) {
                  return sum + (m.meta_roas * m.spend);
                }
                return sum;
              }, 0);
              weightedRoas = roasSum / totalSpend;
            }

            aggregatedMetrics = {
              impressions: adMetrics.reduce((sum, m) => sum + (m.impressions || 0), 0),
              clicks: adMetrics.reduce((sum, m) => sum + (m.clicks || 0), 0),
              linkClicks: adMetrics.reduce((sum, m) => sum + (m.link_clicks || 0), 0),
              spend: totalSpend,
              conversions: adMetrics.reduce((sum, m) => sum + (m.conversions || 0), 0),
              conversionValue: adMetrics.reduce((sum, m) => sum + (m.conversion_value || 0), 0),
              metaRoas: weightedRoas,
            };
            metricsFound = aggregatedMetrics.impressions > 0 || aggregatedMetrics.spend > 0;
            if (metricsFound) {
              adLevelMatches++;
              console.log(`[AGGREGATE] Ad-level match for ad ${creative.ad_id}: ${aggregatedMetrics.impressions} imp, ${aggregatedMetrics.linkClicks} link clicks`);
            }
          }
        }

        // PRIORITY 2: Fall back to campaign-level metrics with distribution
        if (!metricsFound && creative.campaign_id) {
          const { data: campaignMetrics, error: campError } = await supabase
            .from('meta_ad_metrics')
            .select('impressions, clicks, link_clicks, spend, conversions, conversion_value')
            .eq('organization_id', creative.organization_id)
            .eq('campaign_id', creative.campaign_id);

          if (!campError && campaignMetrics && campaignMetrics.length > 0) {
            const totalCampaignMetrics = {
              impressions: campaignMetrics.reduce((sum, m) => sum + (m.impressions || 0), 0),
              clicks: campaignMetrics.reduce((sum, m) => sum + (m.clicks || 0), 0),
              linkClicks: campaignMetrics.reduce((sum, m) => sum + (m.link_clicks || 0), 0),
              spend: campaignMetrics.reduce((sum, m) => sum + (m.spend || 0), 0),
              conversions: campaignMetrics.reduce((sum, m) => sum + (m.conversions || 0), 0),
              conversionValue: campaignMetrics.reduce((sum, m) => sum + (m.conversion_value || 0), 0),
            };

            // Count creatives in this campaign to distribute metrics
            const { count: creativeCount } = await supabase
              .from('meta_creative_insights')
              .select('id', { count: 'exact', head: true })
              .eq('organization_id', creative.organization_id)
              .eq('campaign_id', creative.campaign_id);

            const divisor = creativeCount || 1;

            // Distribute campaign metrics evenly among creatives (estimation)
            aggregatedMetrics = {
              impressions: Math.floor(totalCampaignMetrics.impressions / divisor),
              clicks: Math.floor(totalCampaignMetrics.clicks / divisor),
              linkClicks: Math.floor(totalCampaignMetrics.linkClicks / divisor),
              spend: totalCampaignMetrics.spend / divisor,
              conversions: Math.floor(totalCampaignMetrics.conversions / divisor),
              conversionValue: totalCampaignMetrics.conversionValue / divisor,
              metaRoas: null, // Can't get accurate ROAS from campaign-level fallback
            };

            metricsFound = aggregatedMetrics.impressions > 0 || aggregatedMetrics.spend > 0;
            if (metricsFound) {
              campaignLevelFallbacks++;
              console.log(`[AGGREGATE] Campaign-level fallback for creative ${creative.id}: ${aggregatedMetrics.impressions} imp, ${aggregatedMetrics.linkClicks} link clicks (1/${divisor} of campaign)`);
            }
          }
        }

        // Update creative if we found metrics
        if (metricsFound) {
          // Calculate Link CTR (outbound clicks / impressions) - the accurate metric for conversion tracking
          const linkCtr = aggregatedMetrics.impressions > 0 
            ? aggregatedMetrics.linkClicks / aggregatedMetrics.impressions 
            : 0;
          
          // Prefer Meta's attributed ROAS if available, otherwise calculate from conversion value
          const roas = aggregatedMetrics.metaRoas 
            ?? (aggregatedMetrics.spend > 0 
              ? aggregatedMetrics.conversionValue / aggregatedMetrics.spend 
              : 0);

          const { error: updateError } = await supabase
            .from('meta_creative_insights')
            .update({
              impressions: aggregatedMetrics.impressions,
              clicks: aggregatedMetrics.clicks,
              link_clicks: aggregatedMetrics.linkClicks,
              spend: aggregatedMetrics.spend,
              conversions: aggregatedMetrics.conversions,
              conversion_value: aggregatedMetrics.conversionValue,
              ctr: linkCtr, // Use Link CTR as primary CTR metric
              link_ctr: linkCtr,
              roas: roas,
            })
            .eq('id', creative.id);

          if (updateError) {
            console.error(`[AGGREGATE] Error updating creative ${creative.id}:`, updateError);
          } else {
            updatedCount++;
          }
        }

        successCount++;
      } catch (creativeError) {
        console.error(`[AGGREGATE] Error processing creative ${creative.id}:`, creativeError);
      }
    }

    console.log(`[AGGREGATE] Complete: ${successCount} processed, ${updatedCount} updated`);
    console.log(`[AGGREGATE] Matches: ${adLevelMatches} ad-level, ${campaignLevelFallbacks} campaign-level fallbacks`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: successCount,
        updated: updatedCount,
        ad_level_matches: adLevelMatches,
        campaign_level_fallbacks: campaignLevelFallbacks,
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
