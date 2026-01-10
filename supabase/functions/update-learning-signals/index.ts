import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateCronOrAdmin, checkRateLimit } from "../_shared/security.ts";

const corsHeaders = getCorsHeaders();

interface OutcomeRecord {
  id: string;
  organization_id: string;
  trend_event_id: string | null;
  action_type: string;
  sent_at: string;
  outcome_type: string | null;
  outcome_value: number | null;
  entity_type: string | null;
  related_topics: string[] | null;
  trend_title?: string;
}

async function processOutcomes(
  supabase: SupabaseClient,
  outcomes: OutcomeRecord[]
): Promise<Response> {
  console.log(`Processing ${outcomes.length} outcomes for learning signals`);

  // Calculate pattern weights based on outcomes
  const patternWeights = new Map<string, { total: number; positive: number; value: number }>();

  for (const outcome of outcomes) {
    if (!outcome.entity_type && !outcome.related_topics?.length) continue;

    const isPositive = outcome.outcome_type !== "none" && (outcome.outcome_value || 0) > 0;
    const actionKey = `action:${outcome.action_type}`;
    const entityKey = outcome.entity_type ? `entity:${outcome.entity_type}` : null;

    // Track action type effectiveness
    const actionStats = patternWeights.get(actionKey) || { total: 0, positive: 0, value: 0 };
    actionStats.total++;
    if (isPositive) {
      actionStats.positive++;
      actionStats.value += outcome.outcome_value || 0;
    }
    patternWeights.set(actionKey, actionStats);

    // Track entity type effectiveness
    if (entityKey) {
      const entityStats = patternWeights.get(entityKey) || { total: 0, positive: 0, value: 0 };
      entityStats.total++;
      if (isPositive) {
        entityStats.positive++;
        entityStats.value += outcome.outcome_value || 0;
      }
      patternWeights.set(entityKey, entityStats);
    }

    // Track topics effectiveness
    const topics = outcome.related_topics || [];
    for (const topic of topics.slice(0, 3)) {
      const topicKey = `topic:${topic.toLowerCase().replace(/\s+/g, '_')}`;
      const topicStats = patternWeights.get(topicKey) || { total: 0, positive: 0, value: 0 };
      topicStats.total++;
      if (isPositive) {
        topicStats.positive++;
        topicStats.value += outcome.outcome_value || 0;
      }
      patternWeights.set(topicKey, topicStats);
    }
  }

  // Upsert learning signals
  let upsertCount = 0;
  for (const [patternKey, stats] of patternWeights) {
    const [signalType] = patternKey.split(":");
    const successRate = stats.total > 0 ? stats.positive / stats.total : 0;

    // Weight adjustment: positive for high success, negative for low
    // Scale: -1 to +1 based on success rate vs baseline (50%)
    const weightAdjustment = (successRate - 0.5) * 2;

    const { error: upsertError } = await supabase
      .from("learning_signals")
      .upsert({
        signal_type: signalType,
        pattern_key: patternKey,
        weight_adjustment: weightAdjustment,
        sample_count: stats.total,
        last_calculated_at: new Date().toISOString(),
        metadata: {
          success_rate: successRate,
          total_value: stats.value,
          positive_count: stats.positive,
        },
      }, {
        onConflict: "signal_type,pattern_key",
      });

    if (!upsertError) {
      upsertCount++;
    }
  }

  console.log(`Updated ${upsertCount} learning signals`);

  // Update decision scores based on learning signals
  const { data: activeSignals } = await supabase
    .from("learning_signals")
    .select("*")
    .gte("sample_count", 5) // Only use signals with enough samples
    .order("weight_adjustment", { ascending: false });

  // Apply learning signals to active trends
  const { data: activeTrends, error: trendsError } = await supabase
    .from("trend_events")
    .select("id, entity_type, related_topics, decision_score")
    .eq("is_trending", true);

  if (!trendsError && activeTrends && activeSignals) {
    for (const trend of activeTrends) {
      let learningBoost = 0;

      // Apply entity type boost
      const entitySignal = activeSignals.find(
        (s: { pattern_key: string }) => s.pattern_key === `entity:${trend.entity_type}`
      );
      if (entitySignal) {
        learningBoost += entitySignal.weight_adjustment * 10;
      }

      // Apply topic boosts
      for (const topic of (trend.related_topics || []).slice(0, 3)) {
        const topicSignal = activeSignals.find(
          (s: { pattern_key: string }) => s.pattern_key === `topic:${topic.toLowerCase().replace(/\s+/g, '_')}`
        );
        if (topicSignal) {
          learningBoost += topicSignal.weight_adjustment * 5;
        }
      }

      // Update decision score if there's a meaningful boost
      if (Math.abs(learningBoost) >= 2) {
        const newScore = Math.max(0, Math.min(100, (trend.decision_score || 50) + learningBoost));

        await supabase
          .from("trend_events")
          .update({ decision_score: newScore })
          .eq("id", trend.id);
      }
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      signals_updated: upsertCount,
      patterns_analyzed: patternWeights.size,
      outcomes_processed: outcomes.length,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // SECURITY: Require cron secret or admin JWT
    const authResult = await validateCronOrAdmin(req, supabase);
    if (!authResult.valid) {
      console.error('[update-learning-signals] Unauthorized access attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Rate limiting
    const rateLimit = await checkRateLimit('update-learning-signals', 6, 60000);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', resetAt: rateLimit.resetAt }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Starting learning signals update...");

    // Get action outcomes from the last 30 days with results
    // FIX: Use unified_action_outcomes view to capture both UI actions AND campaign outcomes
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: outcomes, error: outcomesError } = await supabase
      .from("unified_action_outcomes")
      .select("*")
      .gte("sent_at", thirtyDaysAgo.toISOString())
      .not("outcome_type", "is", null);

    if (outcomesError) {
      // Fallback to old table if view doesn't exist yet (migration not applied)
      console.warn("unified_action_outcomes view not available, falling back to trend_action_outcomes:", outcomesError.message);

      const { data: fallbackOutcomes, error: fallbackError } = await supabase
        .from("trend_action_outcomes")
        .select(`
          *,
          trend_events (
            event_title,
            entity_type,
            related_topics,
            confidence_score
          )
        `)
        .gte("action_taken_at", thirtyDaysAgo.toISOString())
        .not("outcome_type", "is", null);

      if (fallbackError) {
        throw new Error(`Failed to fetch outcomes: ${fallbackError.message}`);
      }

      // Transform fallback data to match unified view shape
      const transformedOutcomes: OutcomeRecord[] = (fallbackOutcomes || []).map((o: any) => ({
        id: o.id,
        organization_id: o.organization_id,
        trend_event_id: o.trend_event_id,
        action_type: o.action_type,
        sent_at: o.action_taken_at,
        outcome_type: o.outcome_type,
        outcome_value: o.outcome_value,
        entity_type: o.trend_events?.entity_type || null,
        related_topics: o.trend_events?.related_topics || null,
        trend_title: o.trend_events?.event_title,
      }));

      return processOutcomes(supabase, transformedOutcomes);
    }

    // Transform unified view data to OutcomeRecord shape
    const outcomeRecords: OutcomeRecord[] = (outcomes || []).map((o: any) => ({
      id: o.id,
      organization_id: o.organization_id,
      trend_event_id: o.trend_event_id,
      action_type: o.action_type,
      sent_at: o.sent_at,
      outcome_type: o.outcome_type,
      outcome_value: o.outcome_value,
      entity_type: o.entity_type || null,
      related_topics: o.related_topics || null,
      trend_title: o.trend_title,
    }));

    return processOutcomes(supabase, outcomeRecords);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error updating learning signals:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
