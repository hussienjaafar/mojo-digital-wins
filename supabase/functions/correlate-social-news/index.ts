import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Calculate similarity between two strings (Jaccard similarity)
function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().split(/\s+/));
  const words2 = new Set(str2.toLowerCase().split(/\s+/));

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

// Find matching articles for a Bluesky trend
async function findMatchingArticles(supabase: any, topic: string, trendData: any) {
  // Search for articles with similar titles or descriptions
  const { data: articles, error } = await supabase
    .from('articles')
    .select('id, title, description, published_date, source_name')
    .gte('published_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
    .order('published_date', { ascending: false })
    .limit(100);

  if (error || !articles) {
    console.error('Error fetching articles:', error);
    return [];
  }

  const matches: any[] = [];

  for (const article of articles) {
    const articleText = `${article.title} ${article.description || ''}`.toLowerCase();
    const topicLower = topic.toLowerCase();

    // Calculate correlation strength
    let correlationScore = 0;

    // Direct keyword match
    if (articleText.includes(topicLower)) {
      correlationScore += 0.4;
    }

    // Similarity score
    const titleSimilarity = calculateSimilarity(topic, article.title);
    correlationScore += titleSimilarity * 0.6;

    // Only include if correlation is significant
    if (correlationScore >= 0.3) {
      // Calculate time lag
      const articleTime = new Date(article.published_date).getTime();
      const trendTime = new Date(trendData.last_seen_at).getTime();
      const timeLagMinutes = Math.round((trendTime - articleTime) / (1000 * 60));

      // Is social discussion predictive? (appeared before article)
      const isPredictive = timeLagMinutes < 0;

      matches.push({
        article_id: article.id,
        topic,
        social_mentions: trendData.mentions_last_24_hours,
        social_sentiment: trendData.sentiment_avg,
        correlation_strength: correlationScore,
        peak_social_time: trendData.last_seen_at,
        article_published: article.published_date,
        time_lag_minutes: timeLagMinutes,
        is_predictive: isPredictive
      });
    }
  }

  return matches.sort((a, b) => b.correlation_strength - a.correlation_strength).slice(0, 10);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔗 Starting social-news correlation analysis...');

    // Get trending topics
    const { data: trends, error: trendsError } = await supabase
      .from('bluesky_trends')
      .select('*')
      .gte('mentions_last_24_hours', 5) // At least 5 mentions to be meaningful
      .order('velocity', { ascending: false })
      .limit(50);

    if (trendsError || !trends) {
      throw trendsError;
    }

    console.log(`📊 Found ${trends.length} trends to correlate`);

    let totalCorrelations = 0;
    let predictiveSignals = 0;

    for (const trend of trends) {
      const matches = await findMatchingArticles(supabase, trend.topic, trend);

      if (matches.length > 0) {
        console.log(`✅ Found ${matches.length} correlations for "${trend.topic}"`);

        // Insert correlations
        const { error: insertError } = await supabase
          .from('bluesky_article_correlations')
          .upsert(matches, {
            onConflict: 'article_id,topic'
          });

        if (insertError) {
          console.error(`❌ Error inserting correlations:`, insertError);
        } else {
          totalCorrelations += matches.length;

          // Update trend with related articles
          const articleIds = matches.map(m => m.article_id);
          await supabase
            .from('bluesky_trends')
            .update({
              related_articles: articleIds,
              correlation_score: matches[0]?.correlation_strength || 0,
              updated_at: new Date().toISOString()
            })
            .eq('topic', trend.topic);

          // Count predictive signals
          predictiveSignals += matches.filter(m => m.is_predictive).length;
        }
      }
    }

    console.log(`✅ Created ${totalCorrelations} total correlations, ${predictiveSignals} predictive signals`);

    return new Response(
      JSON.stringify({
        success: true,
        trends_analyzed: trends.length,
        correlations_found: totalCorrelations,
        predictive_signals: predictiveSignals
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in correlate-social-news:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
