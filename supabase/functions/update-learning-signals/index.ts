import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("Starting learning signals update...");

    // Get action outcomes from the last 30 days with results
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: outcomes, error: outcomesError } = await supabase
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

    if (outcomesError) {
      throw new Error(`Failed to fetch outcomes: ${outcomesError.message}`);
    }

    console.log(`Processing ${outcomes?.length || 0} outcomes for learning signals`);

    // Calculate pattern weights based on outcomes
    const patternWeights = new Map<string, { total: number; positive: number; value: number }>();

    for (const outcome of outcomes || []) {
      const trend = outcome.trend_events;
      if (!trend) continue;

      const isPositive = outcome.outcome_type !== "none" && outcome.outcome_value > 0;
      const actionKey = `action:${outcome.action_type}`;
      const entityKey = trend.entity_type ? `entity:${trend.entity_type}` : null;
      
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
      const topics = trend.related_topics || [];
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
          s => s.pattern_key === `entity:${trend.entity_type}`
        );
        if (entitySignal) {
          learningBoost += entitySignal.weight_adjustment * 10;
        }

        // Apply topic boosts
        for (const topic of (trend.related_topics || []).slice(0, 3)) {
          const topicSignal = activeSignals.find(
            s => s.pattern_key === `topic:${topic.toLowerCase().replace(/\s+/g, '_')}`
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
        outcomes_processed: outcomes?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error updating learning signals:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
