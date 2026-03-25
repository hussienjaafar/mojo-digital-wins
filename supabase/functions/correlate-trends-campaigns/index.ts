import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateCronSecret } from "../_shared/security.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

/**
 * Correlate Trends with Campaigns
 *
 * Links trend events to campaign outcomes to learn what topics
 * perform well for each organization.
 */

interface Campaign {
  id: string;
  organization_id: string;
  sent_at: string;
  performance_vs_baseline?: number;
}

interface CampaignTopics {
  policy_domains: string[];
  topics: string[];
  entities: string[];
}

interface TrendEvent {
  id: string;
  event_title: string;
  policy_domains: string[];
  context_terms: string[];
  first_seen_at: string;
  last_seen_at: string;
  is_breaking: boolean;
}

interface TrendCampaignCorrelation {
  trend_event_id: string;
  campaign_id: string;
  organization_id: string;
  correlation_score: number;
  domain_overlap: string[];
  topic_overlap: string[];
  time_delta_hours: number;
  campaign_performance: any;
  performance_vs_baseline: number;
  outcome_label: string;
}

function calculateOutcomeLabel(performanceVsBaseline: number): string {
  if (performanceVsBaseline > 30) return 'high_performer';
  if (performanceVsBaseline > 0) return 'performer';
  if (performanceVsBaseline > -20) return 'neutral';
  return 'underperformer';
}

/**
 * Calculate actual campaign performance from metrics
 * Returns percentage vs baseline (positive = above average, negative = below)
 */
async function calculateCampaignPerformance(
  campaign: Campaign,
  supabase: any
): Promise<number> {
  // Get campaign metrics from analytics
  const { data: metrics, error: metricsError } = await supabase
    .from('campaign_analytics')
    .select('opens, clicks, conversions, sends, unsubscribes')
    .eq('campaign_id', campaign.id)
    .single();

  if (metricsError || !metrics) {
    // Try sms_campaign_stats as fallback
    const { data: smsStats } = await supabase
      .from('sms_campaign_stats')
      .select('delivered, clicked, responded, sent')
      .eq('campaign_id', campaign.id)
      .single();

    if (!smsStats) {
      console.log(`   No metrics found for campaign ${campaign.id}, using neutral performance`);
      return 0; // Neutral if no data available
    }

    // Calculate SMS performance (click-through + response rate)
    const smsDeliveryRate = smsStats.sent > 0 ? smsStats.delivered / smsStats.sent : 0;
    const smsEngagementRate = smsStats.delivered > 0
      ? (smsStats.clicked + smsStats.responded) / smsStats.delivered
      : 0;

    // Get baseline for SMS campaigns (30-day rolling average)
    const baseline = await getTypeBaseline(supabase, 'sms');
    const performanceScore = smsDeliveryRate * 0.3 + smsEngagementRate * 0.7;

    return baseline > 0
      ? ((performanceScore - baseline) / baseline) * 100
      : 0;
  }

  // Calculate email/general campaign performance
  const openRate = metrics.sends > 0 ? metrics.opens / metrics.sends : 0;
  const clickRate = metrics.opens > 0 ? metrics.clicks / metrics.opens : 0;
  const conversionRate = metrics.clicks > 0 ? metrics.conversions / metrics.clicks : 0;

  // Weighted performance score
  const performanceScore = openRate * 0.2 + clickRate * 0.4 + conversionRate * 0.4;

  // Get baseline for this org's campaign type
  const baseline = await getOrgBaseline(supabase, campaign.organization_id);

  if (baseline <= 0) {
    // No baseline yet, use absolute scale
    // Good performance: >5% combined rate
    return (performanceScore - 0.05) * 1000;
  }

  // Return percentage difference from baseline
  return ((performanceScore - baseline) / baseline) * 100;
}

/**
 * Get rolling 30-day performance baseline for an organization
 */
async function getOrgBaseline(supabase: any, organizationId: string): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: recentCampaigns } = await supabase
    .from('campaign_analytics')
    .select('opens, clicks, conversions, sends')
    .eq('organization_id', organizationId)
    .gte('created_at', thirtyDaysAgo);

  if (!recentCampaigns || recentCampaigns.length < 3) {
    // Not enough data, use global baseline
    return await getGlobalBaseline(supabase);
  }

  // Calculate average performance across recent campaigns
  let totalScore = 0;
  let validCount = 0;

  for (const campaign of recentCampaigns) {
    if (campaign.sends > 0) {
      const openRate = campaign.opens / campaign.sends;
      const clickRate = campaign.opens > 0 ? campaign.clicks / campaign.opens : 0;
      const conversionRate = campaign.clicks > 0 ? campaign.conversions / campaign.clicks : 0;
      totalScore += openRate * 0.2 + clickRate * 0.4 + conversionRate * 0.4;
      validCount++;
    }
  }

  return validCount > 0 ? totalScore / validCount : 0;
}

/**
 * Get global baseline across all organizations (fallback)
 */
async function getGlobalBaseline(supabase: any): Promise<number> {
  const { data } = await supabase
    .from('system_baselines')
    .select('baseline_value')
    .eq('metric_name', 'campaign_performance')
    .single();

  return data?.baseline_value || 0.05; // Default 5% combined rate
}

/**
 * Get baseline for a specific campaign type (sms, email, etc)
 */
async function getTypeBaseline(supabase: any, campaignType: string): Promise<number> {
  const { data } = await supabase
    .from('system_baselines')
    .select('baseline_value')
    .eq('metric_name', `${campaignType}_performance`)
    .single();

  // Default baselines by type
  const defaults: Record<string, number> = {
    sms: 0.08,    // 8% engagement rate
    email: 0.05,  // 5% combined rate
    push: 0.03,   // 3% engagement
    social: 0.02, // 2% engagement
  };

  return data?.baseline_value || defaults[campaignType] || 0.05;
}

async function correlateTrendsWithCampaign(
  supabase: any,
  campaign: Campaign,
  campaignTopics: CampaignTopics,
  performanceVsBaseline: number
): Promise<TrendCampaignCorrelation[]> {
  const correlations: TrendCampaignCorrelation[] = [];

  // Find trends that were active 0-48h before campaign sent
  const campaignSentTime = new Date(campaign.sent_at).getTime();
  const windowStart = new Date(campaignSentTime - 48 * 60 * 60 * 1000).toISOString();

  const { data: activeTrends } = await supabase
    .from('trend_events')
    .select('id, event_title, policy_domains, context_terms, first_seen_at, last_seen_at, is_breaking')
    .lte('first_seen_at', campaign.sent_at)
    .gte('last_seen_at', windowStart)
    .order('confidence_score', { ascending: false })
    .limit(100);

  for (const trend of activeTrends || []) {
    const domainOverlap = (trend.policy_domains || []).filter((d: string) =>
      campaignTopics.policy_domains.some(cd =>
        cd.toLowerCase() === d.toLowerCase()
      )
    );

    const topicOverlap = (trend.context_terms || []).filter((t: string) =>
      campaignTopics.topics.some(ct =>
        t.toLowerCase().includes(ct.toLowerCase()) ||
        ct.toLowerCase().includes(t.toLowerCase())
      )
    );

    // Only create correlation if there's meaningful overlap
    if (domainOverlap.length === 0 && topicOverlap.length === 0) {
      continue;
    }

    const correlationScore = Math.min(1, (
      domainOverlap.length * 0.4 +
      topicOverlap.length * 0.3 +
      (trend.is_breaking ? 0.2 : 0) +
      (performanceVsBaseline > 0 ? 0.1 : 0)
    ));

    // Only keep correlations with meaningful scores
    if (correlationScore < 0.2) continue;

    const timeDelta = Math.round(
      (campaignSentTime - new Date(trend.first_seen_at).getTime())
      / (1000 * 60 * 60)
    );

    correlations.push({
      trend_event_id: trend.id,
      campaign_id: campaign.id,
      organization_id: campaign.organization_id,
      correlation_score: correlationScore,
      domain_overlap: domainOverlap,
      topic_overlap: topicOverlap,
      time_delta_hours: timeDelta,
      campaign_performance: { performance_vs_baseline: performanceVsBaseline },
      performance_vs_baseline: performanceVsBaseline,
      outcome_label: calculateOutcomeLabel(performanceVsBaseline),
    });
  }

  return correlations;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!validateCronSecret(req)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const campaignId = body.campaign_id;
    const batchSize = body.batch_size || 50;

    console.log('🔗 Starting trend-campaign correlation...');

    // Get campaigns with performance data that haven't been correlated yet
    let campaignsQuery;

    if (campaignId) {
      campaignsQuery = supabase
        .from('sms_campaigns')
        .select('id, organization_id, sent_at')
        .eq('id', campaignId);
    } else {
      // Get recent campaigns with performance data
      campaignsQuery = supabase
        .from('sms_campaigns')
        .select('id, organization_id, sent_at')
        .gte('sent_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .not('sent_at', 'is', null)
        .limit(batchSize);
    }

    const { data: campaigns, error: campaignsError } = await campaignsQuery;
    if (campaignsError) throw campaignsError;

    console.log(`📊 Processing ${campaigns?.length || 0} campaigns`);

    let totalCorrelations = 0;
    const correlationsByOutcome: Record<string, number> = {};

    for (const campaign of campaigns || []) {
      // Get campaign topics
      const { data: topicsData } = await supabase
        .from('campaign_topic_extractions')
        .select('policy_domains, topics, entities')
        .eq('campaign_id', campaign.id)
        .single();

      if (!topicsData) {
        console.log(`   Skipping campaign ${campaign.id} - no topic extraction`);
        continue;
      }

      // Calculate actual campaign performance from metrics
      const performanceVsBaseline = await calculateCampaignPerformance(campaign, supabase);

      const correlations = await correlateTrendsWithCampaign(
        supabase,
        campaign,
        topicsData as CampaignTopics,
        performanceVsBaseline
      );

      if (correlations.length > 0) {
        const { error: insertError } = await supabase
          .from('trend_campaign_correlations')
          .upsert(correlations.map(c => ({
            ...c,
            created_at: new Date().toISOString(),
          })), {
            onConflict: 'trend_event_id,campaign_id',
            ignoreDuplicates: true,
          });

        if (!insertError) {
          totalCorrelations += correlations.length;

          for (const corr of correlations) {
            correlationsByOutcome[corr.outcome_label] =
              (correlationsByOutcome[corr.outcome_label] || 0) + 1;
          }
        }
      }
    }

    console.log(`✅ Created ${totalCorrelations} trend-campaign correlations`);
    console.log('   Outcome distribution:', correlationsByOutcome);

    return new Response(
      JSON.stringify({
        success: true,
        campaignsProcessed: campaigns?.length || 0,
        correlationsCreated: totalCorrelations,
        outcomeDistribution: correlationsByOutcome,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error correlating trends:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
