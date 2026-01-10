import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { calculateDecisionScore, DecisionScoreInput } from '../_shared/decisionScoring.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { organization_id, trend_event_ids } = await req.json();

    // Get active trend events (optionally filtered by IDs)
    let trendQuery = supabase
      .from('trend_events')
      .select(`
        id,
        event_title,
        canonical_label,
        entity_type,
        trend_stage,
        velocity,
        sentiment_score,
        current_24h,
        related_topics,
        confidence_score,
        first_seen_at,
        source_count,
        news_source_count,
        social_source_count,
        is_breaking
      `)
      .eq('is_trending', true)
      .order('first_seen_at', { ascending: false })
      .limit(100);

    if (trend_event_ids?.length) {
      trendQuery = trendQuery.in('id', trend_event_ids);
    }

    const { data: trends, error: trendsError } = await trendQuery;
    if (trendsError) throw trendsError;

    if (!trends?.length) {
      return new Response(JSON.stringify({ message: 'No active trends found', updated: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get org profile if organization_id provided
    let profile = null;
    let interestTopics: any[] = [];
    let interestEntities: any[] = [];

    if (organization_id) {
      const [profileRes, topicsRes, entitiesRes] = await Promise.all([
        supabase.from('organization_profiles').select('*').eq('organization_id', organization_id).maybeSingle(),
        supabase.from('org_interest_topics').select('*').eq('organization_id', organization_id),
        supabase.from('org_interest_entities').select('*').eq('organization_id', organization_id),
      ]);

      profile = profileRes.data;
      interestTopics = topicsRes.data || [];
      interestEntities = entitiesRes.data || [];
    }

    // Get historical action outcomes for learning weights
    const { data: outcomes } = await supabase
      .from('trend_action_outcomes')
      .select('trend_event_id, action_type, outcome_type, outcome_value')
      .not('outcome_type', 'is', null)
      .order('action_taken_at', { ascending: false })
      .limit(500);

    // Calculate success rates by topic (simple learning signal)
    const topicSuccessRates: Record<string, { successes: number; total: number }> = {};

    if (outcomes?.length) {
      for (const outcome of outcomes) {
        if (outcome.outcome_type === 'donation' || outcome.outcome_type === 'conversion') {
          // TODO: Join with trends to get topics and build learning model
        }
      }
    }

    // Calculate decision scores for each trend
    const updates: Array<{ id: string; decision_score: number; opportunity_tier: string }> = [];

    for (const trend of trends) {
      const alertAge = trend.first_seen_at
        ? (Date.now() - new Date(trend.first_seen_at).getTime()) / (1000 * 60 * 60)
        : undefined;

      const sampleSources: Array<{ type: string; count?: number }> = [];
      if (trend.news_source_count) {
        sampleSources.push({ type: 'news', count: trend.news_source_count });
      }
      if (trend.social_source_count) {
        sampleSources.push({ type: 'social', count: trend.social_source_count });
      }
      if (sampleSources.length === 0 && trend.source_count) {
        sampleSources.push({ type: 'sources', count: trend.source_count });
      }

      const input: DecisionScoreInput = {
        entityName: trend.canonical_label || trend.event_title,
        entityType: trend.entity_type || undefined,
        alertType: trend.is_breaking ? 'breaking' : (trend.trend_stage || 'spike'),
        velocity: trend.velocity,
        sentiment: trend.sentiment_score,
        mentions: trend.current_24h,
        topics: trend.related_topics || [],
        sampleSources: sampleSources.length ? sampleSources : undefined,
        alertAge,
      };

      const result = calculateDecisionScore(input, profile, interestTopics, interestEntities);

      updates.push({
        id: trend.id,
        decision_score: result.decision_score,
        opportunity_tier: result.tier,
      });
    }

    // Batch update trend events
    let updatedCount = 0;
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('trend_events')
        .update({
          decision_score: update.decision_score,
          opportunity_tier: update.opportunity_tier,
        })
        .eq('id', update.id);

      if (!updateError) updatedCount++;
    }

    return new Response(
      JSON.stringify({
        message: 'Decision scores computed',
        total: trends.length,
        updated: updatedCount,
        scores: updates.slice(0, 10),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error computing decision scores:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
