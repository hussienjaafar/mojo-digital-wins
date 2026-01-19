import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateCronSecret } from "../_shared/security.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

/**
 * Update Org Affinities
 *
 * Updates topic affinities based on campaign outcomes with safeguards:
 * - Affinities are capped at 20% influence (max 20 pts)
 * - Uses exponential moving average (alpha=0.3)
 * - Clamps scores to 0.2-0.95 range
 */

interface TrendCampaignCorrelation {
  id: string;
  trend_event_id: string;
  campaign_id: string;
  organization_id: string;
  correlation_score: number;
  domain_overlap: string[];
  topic_overlap: string[];
  performance_vs_baseline: number;
  outcome_label: string;
}

interface CampaignPerformance {
  performance_vs_baseline: number;
}

async function updateSingleAffinity(
  supabase: any,
  orgId: string,
  topic: string,
  performanceVsBaseline: number
): Promise<void> {
  // Get existing affinity
  const { data: existing } = await supabase
    .from('org_topic_affinities')
    .select('*')
    .eq('organization_id', orgId)
    .eq('topic', topic)
    .single();

  const currentScore = existing?.affinity_score || 0.5;  // Start neutral
  const currentCount = existing?.times_used || 0;
  const currentAvgPerf = existing?.avg_performance || 0;
  const currentBestPerf = existing?.best_performance || -100;

  // Exponential moving average for affinity score
  // Alpha = 0.3 means new data has 30% influence, history has 70%
  const alpha = 0.3;

  // Convert performance delta to 0-1 signal
  // +50% performance → 1.0, 0% → 0.5, -50% → 0.0
  const performanceSignal = Math.max(0, Math.min(1,
    0.5 + (performanceVsBaseline / 100)
  ));

  const newScore = currentScore * (1 - alpha) + performanceSignal * alpha;

  // Clamp to reasonable bounds
  const clampedScore = Math.max(0.2, Math.min(0.95, newScore));

  // Calculate new average performance
  const newAvgPerformance = currentCount > 0
    ? ((currentAvgPerf * currentCount) + performanceVsBaseline) / (currentCount + 1)
    : performanceVsBaseline;

  // Update or insert
  await supabase
    .from('org_topic_affinities')
    .upsert({
      organization_id: orgId,
      topic: topic,
      affinity_score: clampedScore,
      times_used: currentCount + 1,
      avg_performance: newAvgPerformance,
      best_performance: Math.max(currentBestPerf, performanceVsBaseline),
      last_used_at: new Date().toISOString(),
      source: 'learned_outcome',
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'organization_id,topic',
    });
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
    const orgId = body.organization_id;
    const correlations = body.correlations as TrendCampaignCorrelation[] | undefined;

    console.log('📈 Starting affinity updates...');

    let affinitiesUpdated = 0;
    let processedCorrelations = 0;

    if (correlations && correlations.length > 0) {
      // Process provided correlations
      for (const correlation of correlations) {
        processedCorrelations++;

        // Get trend to get policy domains
        const { data: trend } = await supabase
          .from('trend_events')
          .select('policy_domains')
          .eq('id', correlation.trend_event_id)
          .single();

        if (!trend) continue;

        // Update affinity for each policy domain in the correlated trend
        for (const domain of trend.policy_domains || []) {
          await updateSingleAffinity(
            supabase,
            correlation.organization_id,
            domain,
            correlation.performance_vs_baseline
          );
          affinitiesUpdated++;
        }

        // Also update affinity for matched specific topics
        for (const topic of correlation.topic_overlap || []) {
          await updateSingleAffinity(
            supabase,
            correlation.organization_id,
            topic,
            correlation.performance_vs_baseline
          );
          affinitiesUpdated++;
        }
      }
    } else {
      // Batch mode: process unprocessed correlations from database
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

      let query = supabase
        .from('trend_campaign_correlations')
        .select('*')
        .gte('created_at', cutoff)
        .not('performance_vs_baseline', 'is', null)
        .limit(100);

      if (orgId) {
        query = query.eq('organization_id', orgId);
      }

      const { data: dbCorrelations } = await query;

      console.log(`📊 Processing ${dbCorrelations?.length || 0} correlations from database`);

      for (const correlation of dbCorrelations || []) {
        processedCorrelations++;

        const { data: trend } = await supabase
          .from('trend_events')
          .select('policy_domains')
          .eq('id', correlation.trend_event_id)
          .single();

        if (!trend) continue;

        for (const domain of trend.policy_domains || []) {
          await updateSingleAffinity(
            supabase,
            correlation.organization_id,
            domain,
            correlation.performance_vs_baseline
          );
          affinitiesUpdated++;
        }

        for (const topic of correlation.topic_overlap || []) {
          await updateSingleAffinity(
            supabase,
            correlation.organization_id,
            topic,
            correlation.performance_vs_baseline
          );
          affinitiesUpdated++;
        }
      }
    }

    console.log(`✅ Updated ${affinitiesUpdated} affinities from ${processedCorrelations} correlations`);

    return new Response(
      JSON.stringify({
        success: true,
        correlationsProcessed: processedCorrelations,
        affinitiesUpdated,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error updating affinities:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
