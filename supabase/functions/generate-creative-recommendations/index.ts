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
    const { organizationId, campaignObjective, targetAudience } = await req.json();

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: "organizationId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Generating recommendations for org: ${organizationId}`);

    // Fetch historical performance data
    const { data: creatives, error: creativesError } = await supabase
      .from("meta_creative_insights")
      .select("*")
      .eq("organization_id", organizationId)
      .not("topic", "is", null)
      .order("roas", { ascending: false });

    if (creativesError) {
      console.error("Error fetching creatives:", creativesError);
      throw creativesError;
    }

    // Fetch learnings from creative_performance_learnings
    const { data: learnings, error: learningsError } = await supabase
      .from("creative_performance_learnings")
      .select("*")
      .eq("organization_id", organizationId)
      .order("effectiveness_score", { ascending: false })
      .limit(20);

    if (learningsError) {
      console.error("Error fetching learnings:", learningsError);
    }

    // Analyze patterns
    const patterns = analyzePatterns(creatives || [], learnings || []);

    // Generate AI recommendations using Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      console.log("No LOVABLE_API_KEY, returning pattern-based recommendations");
      return new Response(
        JSON.stringify({ 
          recommendations: patterns.recommendations,
          scorecard: patterns.scorecard,
          patterns: patterns.topPatterns
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build context for AI
    const performanceContext = buildPerformanceContext(creatives || [], patterns);

    const systemPrompt = `You are a creative strategist AI that analyzes ad performance data and generates actionable recommendations. 
    
Based on the performance data provided, generate specific, data-backed recommendations for new creatives.

Focus on:
1. Topic/theme combinations that historically perform well
2. Tone and messaging style patterns
3. Call-to-action effectiveness
4. Visual style patterns (if available)
5. Timing and urgency elements

Always include:
- Confidence score (0-1) based on sample size and consistency
- Expected performance range (min-max ROAS)
- Specific actionable suggestions`;

    const userPrompt = `Analyze this creative performance data and generate recommendations:

${performanceContext}

Campaign objective: ${campaignObjective || "General fundraising"}
Target audience: ${targetAudience || "General supporters"}

Generate 3-5 specific recommendations with:
1. Title
2. Description with data backing
3. Confidence score (0-1)
4. Impact level (high/medium/low)
5. Specific suggestion for implementation
6. Expected ROAS range

Return as JSON array with structure:
{
  "recommendations": [
    {
      "title": "...",
      "description": "...",
      "confidence": 0.85,
      "impact": "high",
      "suggestion": "...",
      "expectedRoas": { "min": 1.5, "max": 3.2 },
      "basedOn": "X creatives analyzed"
    }
  ],
  "optimalFormula": {
    "topic": "...",
    "tone": "...",
    "emotionalAppeal": "...",
    "cta": "...",
    "expectedRoas": 2.5
  }
}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI API error:", await aiResponse.text());
      // Fall back to pattern-based recommendations
      return new Response(
        JSON.stringify({ 
          recommendations: patterns.recommendations,
          scorecard: patterns.scorecard,
          patterns: patterns.topPatterns
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";

    // Parse AI response
    let aiRecommendations;
    try {
      // Extract JSON from response
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiRecommendations = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("Failed to parse AI response:", e);
    }

    // Combine AI recommendations with pattern analysis
    const finalRecommendations = aiRecommendations?.recommendations || patterns.recommendations;
    const optimalFormula = aiRecommendations?.optimalFormula || patterns.optimalFormula;

    console.log(`Generated ${finalRecommendations.length} recommendations`);

    return new Response(
      JSON.stringify({
        recommendations: finalRecommendations,
        optimalFormula,
        scorecard: patterns.scorecard,
        patterns: patterns.topPatterns,
        totalCreativesAnalyzed: creatives?.length || 0
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error generating recommendations:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function analyzePatterns(creatives: any[], learnings: any[]) {
  const byTopic: Record<string, { count: number; totalRoas: number; totalCtr: number; totalConv: number }> = {};
  const byTone: Record<string, { count: number; totalRoas: number; totalCtr: number }> = {};
  const byEmotional: Record<string, { count: number; totalRoas: number }> = {};
  const byCta: Record<string, { count: number; totalRoas: number; totalCtr: number }> = {};
  const byVisual: Record<string, { count: number; totalRoas: number }> = {};

  // Analyze creatives
  creatives.forEach(c => {
    if (c.topic) {
      if (!byTopic[c.topic]) byTopic[c.topic] = { count: 0, totalRoas: 0, totalCtr: 0, totalConv: 0 };
      byTopic[c.topic].count++;
      byTopic[c.topic].totalRoas += c.roas || 0;
      byTopic[c.topic].totalCtr += c.ctr || 0;
      byTopic[c.topic].totalConv += c.conversions || 0;
    }
    if (c.tone) {
      if (!byTone[c.tone]) byTone[c.tone] = { count: 0, totalRoas: 0, totalCtr: 0 };
      byTone[c.tone].count++;
      byTone[c.tone].totalRoas += c.roas || 0;
      byTone[c.tone].totalCtr += c.ctr || 0;
    }
    if (c.emotional_appeal) {
      if (!byEmotional[c.emotional_appeal]) byEmotional[c.emotional_appeal] = { count: 0, totalRoas: 0 };
      byEmotional[c.emotional_appeal].count++;
      byEmotional[c.emotional_appeal].totalRoas += c.roas || 0;
    }
    if (c.call_to_action_type) {
      if (!byCta[c.call_to_action_type]) byCta[c.call_to_action_type] = { count: 0, totalRoas: 0, totalCtr: 0 };
      byCta[c.call_to_action_type].count++;
      byCta[c.call_to_action_type].totalRoas += c.roas || 0;
      byCta[c.call_to_action_type].totalCtr += c.ctr || 0;
    }
    // Analyze visual patterns if available
    if (c.visual_analysis?.composition_style) {
      const style = c.visual_analysis.composition_style;
      if (!byVisual[style]) byVisual[style] = { count: 0, totalRoas: 0 };
      byVisual[style].count++;
      byVisual[style].totalRoas += c.roas || 0;
    }
  });

  // Sort and get top performers
  const sortByAvg = (data: Record<string, { count: number; totalRoas: number }>) =>
    Object.entries(data)
      .filter(([_, v]) => v.count >= 2)
      .map(([k, v]) => ({ key: k, avgRoas: v.totalRoas / v.count, count: v.count }))
      .sort((a, b) => b.avgRoas - a.avgRoas);

  const topTopics = sortByAvg(byTopic);
  const topTones = sortByAvg(byTone);
  const topEmotional = sortByAvg(byEmotional);
  const topCtas = sortByAvg(byCta);
  const topVisual = sortByAvg(byVisual);

  // Generate pattern-based recommendations
  const recommendations: any[] = [];

  if (topTopics.length > 0) {
    const best = topTopics[0];
    const avgRoas = topTopics.reduce((a, t) => a + t.avgRoas, 0) / topTopics.length;
    recommendations.push({
      id: `topic-${Date.now()}`,
      type: 'topic',
      title: `Focus on "${best.key}" content`,
      description: `"${best.key}" themed ads perform ${((best.avgRoas / avgRoas) * 100 - 100).toFixed(0)}% above average with $${best.avgRoas.toFixed(2)} ROAS.`,
      confidence: Math.min(0.95, 0.6 + (best.count * 0.05)),
      impact: best.avgRoas > 2.5 ? 'high' : best.avgRoas > 1.5 ? 'medium' : 'low',
      suggestion: `Create more ads focused on "${best.key}". Test variations with different tones while keeping the topic consistent.`,
      basedOn: `${best.count} creatives analyzed`,
      expectedRoas: { min: best.avgRoas * 0.7, max: best.avgRoas * 1.3 }
    });
  }

  if (topTones.length > 0) {
    const best = topTones[0];
    recommendations.push({
      id: `tone-${Date.now()}`,
      type: 'tone',
      title: `Use "${best.key}" tone`,
      description: `Ads with "${best.key}" tone achieve $${best.avgRoas.toFixed(2)} ROAS on average.`,
      confidence: Math.min(0.9, 0.5 + (best.count * 0.05)),
      impact: best.avgRoas > 2 ? 'high' : 'medium',
      suggestion: `Apply "${best.key}" tone across more creatives, especially with high-performing topics.`,
      basedOn: `${best.count} creatives analyzed`,
      expectedRoas: { min: best.avgRoas * 0.75, max: best.avgRoas * 1.25 }
    });
  }

  if (topEmotional.length > 0) {
    const best = topEmotional[0];
    recommendations.push({
      id: `emotional-${Date.now()}`,
      type: 'emotional',
      title: `Lead with "${best.key}" appeal`,
      description: `Messages emphasizing "${best.key}" drive higher returns.`,
      confidence: Math.min(0.85, 0.5 + (best.count * 0.04)),
      impact: 'medium',
      suggestion: `Structure ad copy to evoke "${best.key}" as the primary emotional response.`,
      basedOn: `${best.count} creatives analyzed`,
      expectedRoas: { min: best.avgRoas * 0.8, max: best.avgRoas * 1.2 }
    });
  }

  if (topCtas.length > 1) {
    const best = topCtas[0];
    const worst = topCtas[topCtas.length - 1];
    if (best.avgRoas > worst.avgRoas * 1.2) {
      recommendations.push({
        id: `cta-${Date.now()}`,
        type: 'cta',
        title: `Switch to "${best.key}" CTAs`,
        description: `"${best.key}" outperforms "${worst.key}" by ${(((best.avgRoas / worst.avgRoas) - 1) * 100).toFixed(0)}%.`,
        confidence: 0.75,
        impact: 'medium',
        suggestion: `Replace "${worst.key}" CTAs with "${best.key}" across campaigns.`,
        basedOn: `Comparing ${best.count} vs ${worst.count} creatives`,
        expectedRoas: { min: best.avgRoas * 0.8, max: best.avgRoas * 1.2 }
      });
    }
  }

  // Optimal formula
  const optimalFormula = {
    topic: topTopics[0]?.key || null,
    tone: topTones[0]?.key || null,
    emotionalAppeal: topEmotional[0]?.key || null,
    cta: topCtas[0]?.key || null,
    visualStyle: topVisual[0]?.key || null,
    expectedRoas: topTopics[0]?.avgRoas || 0
  };

  // Scorecard for evaluating new creatives
  const scorecard = {
    topTopics: topTopics.slice(0, 5).map(t => t.key),
    topTones: topTones.slice(0, 3).map(t => t.key),
    topEmotional: topEmotional.slice(0, 3).map(t => t.key),
    topCtas: topCtas.slice(0, 3).map(t => t.key),
    avgRoas: creatives.reduce((a, c) => a + (c.roas || 0), 0) / Math.max(creatives.length, 1),
    topPerformerRoas: creatives[0]?.roas || 0
  };

  return {
    recommendations,
    optimalFormula,
    scorecard,
    topPatterns: {
      topics: topTopics.slice(0, 5),
      tones: topTones.slice(0, 3),
      emotional: topEmotional.slice(0, 3),
      ctas: topCtas.slice(0, 3),
      visual: topVisual.slice(0, 3)
    }
  };
}

function buildPerformanceContext(creatives: any[], patterns: any) {
  const topCreatives = creatives.slice(0, 10);
  
  let context = `CREATIVE PERFORMANCE DATA\n\n`;
  context += `Total creatives analyzed: ${creatives.length}\n\n`;
  
  context += `TOP PERFORMING TOPICS:\n`;
  patterns.topPatterns.topics.forEach((t: any) => {
    context += `- ${t.key}: Avg ROAS $${t.avgRoas.toFixed(2)} (${t.count} creatives)\n`;
  });
  
  context += `\nTOP PERFORMING TONES:\n`;
  patterns.topPatterns.tones.forEach((t: any) => {
    context += `- ${t.key}: Avg ROAS $${t.avgRoas.toFixed(2)} (${t.count} creatives)\n`;
  });
  
  context += `\nTOP EMOTIONAL APPEALS:\n`;
  patterns.topPatterns.emotional.forEach((t: any) => {
    context += `- ${t.key}: Avg ROAS $${t.avgRoas.toFixed(2)} (${t.count} creatives)\n`;
  });
  
  context += `\nTOP CTAs:\n`;
  patterns.topPatterns.ctas.forEach((t: any) => {
    context += `- ${t.key}: Avg ROAS $${t.avgRoas.toFixed(2)} (${t.count} creatives)\n`;
  });

  context += `\nTOP 5 INDIVIDUAL CREATIVES:\n`;
  topCreatives.slice(0, 5).forEach((c: any, i: number) => {
    context += `${i + 1}. Topic: ${c.topic || 'N/A'}, Tone: ${c.tone || 'N/A'}, ROAS: $${(c.roas || 0).toFixed(2)}\n`;
  });

  return context;
}
