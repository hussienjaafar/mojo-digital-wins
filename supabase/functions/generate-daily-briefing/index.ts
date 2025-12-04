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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch today's key data points in parallel
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [watchlistResult, trendsResult, articlesResult] = await Promise.all([
      supabase.from('entity_watchlist').select('entity_name'),
      supabase
        .from('mv_unified_trends')
        .select('name, spike_ratio, total_mentions_24h, avg_sentiment')
        .gt('spike_ratio', 1.5)
        .order('unified_score', { ascending: false })
        .limit(5),
      supabase
        .from('articles')
        .select('title, threat_level, sentiment_label, affected_organizations')
        .gte('published_date', today.toISOString())
        .order('published_date', { ascending: false })
        .limit(20)
    ]);

    const watchlistEntities = (watchlistResult.data || []).map(w => w.entity_name?.toLowerCase() || '');
    const trends = trendsResult.data || [];
    const articles = articlesResult.data || [];

    // Find watchlist matches in articles
    const watchlistMatches = articles.filter(a => 
      watchlistEntities.some(entity => 
        entity && (a.title?.toLowerCase().includes(entity) || 
        a.affected_organizations?.some((org: string) => org.toLowerCase().includes(entity)))
      )
    );

    const criticalCount = articles.filter(a => a.threat_level === 'critical' || a.threat_level === 'high').length;

    // Build context for AI
    const context = {
      totalArticles: articles.length,
      criticalCount,
      watchlistMatches: watchlistMatches.length,
      watchlistEntities: watchlistEntities.slice(0, 5),
      topTrends: trends.map(t => ({
        name: t.name,
        spikeRatio: t.spike_ratio,
        mentions: t.total_mentions_24h,
        sentiment: t.avg_sentiment > 0.2 ? 'positive' : t.avg_sentiment < -0.2 ? 'negative' : 'neutral'
      })),
      sampleHeadlines: articles.slice(0, 5).map(a => a.title)
    };

    // Call Lovable AI for summary
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      // Return a fallback summary if no API key
      const fallbackSummary = generateFallbackSummary(context);
      return new Response(JSON.stringify({ summary: fallbackSummary, context }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a concise news briefing assistant. Generate a 2-3 sentence executive summary for a political campaign strategist. Focus on:
1. What's most important TODAY for their watchlist
2. Any critical/high-threat news they need to know
3. Key trending topics that might affect their work

Be direct, actionable, and use plain language. No marketing speak. Start with the most important thing.`
          },
          {
            role: "user",
            content: `Generate today's briefing based on this data:

Watchlist entities: ${context.watchlistEntities.join(', ') || 'None set'}
Watchlist mentions today: ${context.watchlistMatches}
Critical/high-threat articles: ${context.criticalCount}
Total new articles: ${context.totalArticles}

Top trending topics:
${context.topTrends.map(t => `- "${t.name}" (${t.spikeRatio.toFixed(1)}x spike, ${t.mentions} mentions, ${t.sentiment} sentiment)`).join('\n') || 'No significant trends'}

Sample headlines:
${context.sampleHeadlines.join('\n') || 'No recent headlines'}`
          }
        ],
        max_tokens: 200,
        temperature: 0.7
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429 || aiResponse.status === 402) {
        const fallbackSummary = generateFallbackSummary(context);
        return new Response(JSON.stringify({ summary: fallbackSummary, context }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const summary = aiData.choices?.[0]?.message?.content || generateFallbackSummary(context);

    return new Response(JSON.stringify({ summary, context }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Error generating briefing:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ 
      error: message,
      summary: "Unable to generate briefing. Check your data sources."
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function generateFallbackSummary(context: any): string {
  const parts: string[] = [];
  
  if (context.watchlistMatches > 0) {
    parts.push(`${context.watchlistMatches} article${context.watchlistMatches > 1 ? 's' : ''} mention your watchlist items today.`);
  }
  
  if (context.criticalCount > 0) {
    parts.push(`${context.criticalCount} critical item${context.criticalCount > 1 ? 's' : ''} need attention.`);
  }
  
  if (context.topTrends.length > 0) {
    const topTrend = context.topTrends[0];
    parts.push(`"${topTrend.name}" is trending at ${topTrend.spikeRatio.toFixed(1)}x normal volume.`);
  }
  
  if (parts.length === 0) {
    parts.push(`${context.totalArticles} new articles today. No urgent items detected.`);
  }
  
  return parts.join(' ');
}
