import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Calculate velocity: % change from average
function calculateVelocity(hourlyCount: number, sixHourCount: number, dailyCount: number): number {
  const sixHourAvg = sixHourCount / 6;
  const dailyAvg = dailyCount / 24;
  
  if (dailyAvg === 0) {
    return sixHourCount > 0 ? 500 : 0; // New topic gets 500% velocity
  }
  
  return ((sixHourAvg - dailyAvg) / dailyAvg) * 100;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('[calculate-news-trends] Starting trend calculation...');

    // Get all unique tags from recent articles (last 7 days)
    const { data: articles, error: articlesError } = await supabase
      .from('articles')
      .select('tags, sentiment_score, sentiment_label, created_at, id')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (articlesError) throw articlesError;

    // Build topic mention counts
    const topicMentions = new Map<string, {
      hour: Set<string>,
      sixHour: Set<string>,
      day: Set<string>,
      week: Set<string>,
      sentiments: number[],
      articleIds: string[]
    }>();

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    for (const article of articles || []) {
      const articleDate = new Date(article.created_at);
      const tags = article.tags || [];

      for (const tag of tags) {
        if (!topicMentions.has(tag)) {
          topicMentions.set(tag, {
            hour: new Set(),
            sixHour: new Set(),
            day: new Set(),
            week: new Set(),
            sentiments: [],
            articleIds: []
          });
        }

        const data = topicMentions.get(tag)!;
        
        if (articleDate >= oneHourAgo) data.hour.add(article.id);
        if (articleDate >= sixHoursAgo) data.sixHour.add(article.id);
        if (articleDate >= oneDayAgo) data.day.add(article.id);
        if (articleDate >= oneWeekAgo) data.week.add(article.id);

        if (article.sentiment_score !== null) {
          data.sentiments.push(article.sentiment_score);
        }
        data.articleIds.push(article.id);
      }
    }

    console.log(`[calculate-news-trends] Found ${topicMentions.size} unique topics`);

    // Calculate trends for each topic
    const trends = [];
    let trendingCount = 0;

    for (const [topic, data] of topicMentions) {
      const hourlyCount = data.hour.size;
      const sixHourCount = data.sixHour.size;
      const dailyCount = data.day.size;
      const weeklyCount = data.week.size;

      const velocity = calculateVelocity(hourlyCount, sixHourCount, dailyCount);
      const isTrending = (velocity > 50 && dailyCount >= 3) || sixHourCount >= 5;

      if (isTrending) trendingCount++;

      // Calculate sentiment breakdown
      const sentiments = data.sentiments;
      const avgSentiment = sentiments.length > 0 
        ? sentiments.reduce((a, b) => a + b, 0) / sentiments.length 
        : 0;

      const positive = sentiments.filter(s => s > 0.3).length;
      const neutral = sentiments.filter(s => s >= -0.3 && s <= 0.3).length;
      const negative = sentiments.filter(s => s < -0.3).length;

      // Check if we should track peak velocity
      const { data: existing } = await supabase
        .from('trending_news_topics')
        .select('peak_velocity, trending_since, peak_at')
        .eq('topic', topic)
        .maybeSingle();

      const peakVelocity = existing?.peak_velocity 
        ? Math.max(existing.peak_velocity, velocity) 
        : velocity;

      const trendingSince = existing?.trending_since 
        ? (isTrending ? existing.trending_since : null)
        : (isTrending ? now.toISOString() : null);

      trends.push({
        topic,
        mentions_last_hour: hourlyCount,
        mentions_last_6_hours: sixHourCount,
        mentions_last_24_hours: dailyCount,
        mentions_last_week: weeklyCount,
        velocity,
        peak_velocity: peakVelocity,
        peak_at: velocity === peakVelocity ? now.toISOString() : existing?.peak_at || null,
        is_trending: isTrending,
        trending_since: trendingSince,
        last_seen_at: now.toISOString(),
        sentiment_avg: avgSentiment,
        sentiment_positive: positive,
        sentiment_neutral: neutral,
        sentiment_negative: negative,
        related_articles: data.articleIds.slice(0, 20), // Top 20 most recent
        calculated_at: now.toISOString(),
        updated_at: now.toISOString()
      });
    }

    // Batch upsert all trends
    if (trends.length > 0) {
      const { error: upsertError } = await supabase
        .from('trending_news_topics')
        .upsert(trends, {
          onConflict: 'topic'
        });

      if (upsertError) {
        console.error('[calculate-news-trends] Error upserting trends:', upsertError);
        throw upsertError;
      }
    }

    console.log(`[calculate-news-trends] ✅ Updated ${trends.length} topics, ${trendingCount} trending`);

    return new Response(
      JSON.stringify({
        success: true,
        topics_updated: trends.length,
        trending_count: trendingCount,
        timestamp: now.toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[calculate-news-trends] Error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
