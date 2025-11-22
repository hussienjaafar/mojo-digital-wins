import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced similarity calculation with fuzzy matching and entity overlap
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  // Jaccard similarity
  const set1 = new Set(s1.split(/\s+/));
  const set2 = new Set(s2.split(/\s+/));
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  let similarity = intersection.size / union.size;
  
  // Entity overlap (capitalized words)
  const entities1: string[] = str1.match(/[A-Z][a-z]+/g) || [];
  const entities2: string[] = str2.match(/[A-Z][a-z]+/g) || [];
  const entityMatches = entities1.filter(e => entities2.includes(e)).length;
  if (entityMatches > 0) {
    similarity += (entityMatches * 0.15);
  }
  
  // Fuzzy matching for partial word matches
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  let partialMatches = 0;
  for (const w1 of words1) {
    for (const w2 of words2) {
      if (w1.length > 3 && w2.length > 3) {
        if (w1.includes(w2) || w2.includes(w1)) {
          partialMatches++;
        }
      }
    }
  }
  if (partialMatches > 0) {
    similarity += (partialMatches * 0.05);
  }
  
  return Math.min(similarity, 1.0);
}

// Find matching articles for a Bluesky trend with enhanced correlation
async function findMatchingArticles(supabase: any, topic: string, trendData: any) {
  const { data: articles, error } = await supabase
    .from('articles')
    .select('id, title, description, content, published_date, source_name, extracted_topics')
    .gte('published_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('published_date', { ascending: false })
    .limit(100);

  if (error || !articles) {
    console.error('Error fetching articles:', error);
    return [];
  }

  const matches: any[] = [];

  for (const article of articles) {
    // Enhanced correlation scoring with entity overlap
    const titleSimilarity = calculateSimilarity(topic, article.title);
    const contentSimilarity = article.content 
      ? calculateSimilarity(topic, article.content.substring(0, 500))
      : 0;
    
    let correlationScore = (titleSimilarity * 0.6) + (contentSimilarity * 0.4);
    
    // Entity overlap bonus
    const topicEntities: string[] = topic.match(/[A-Z][a-z]+/g) || [];
    const titleEntities: string[] = article.title.match(/[A-Z][a-z]+/g) || [];
    const entityOverlap = topicEntities.filter(e => titleEntities.includes(e)).length;
    if (entityOverlap > 0) {
      correlationScore += (entityOverlap * 0.1);
    }
    
    // Extracted topics matching
    if (article.extracted_topics && Array.isArray(article.extracted_topics)) {
      const topicMatch = article.extracted_topics.some((t: any) => 
        typeof t === 'string' && calculateSimilarity(topic, t) > 0.6
      );
      if (topicMatch) correlationScore += 0.2;
    }
    
    // Keyword variations bonus
    const variations = trendData.keyword_variations || [];
    const variationMatch = variations.some((v: string) => 
      article.title.toLowerCase().includes(v.toLowerCase()) ||
      (article.content && article.content.toLowerCase().includes(v.toLowerCase()))
    );
    if (variationMatch) correlationScore += 0.15;

    // Only include if correlation is significant
    if (correlationScore >= 0.25) {
      const articleTime = new Date(article.published_date).getTime();
      const trendTime = new Date(trendData.last_seen_at).getTime();
      const timeLagMinutes = Math.round((trendTime - articleTime) / (1000 * 60));
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

    const { data: trends, error: trendsError } = await supabase
      .from('bluesky_trends')
      .select('*')
      .gte('mentions_last_24_hours', 5)
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

        const { error: insertError } = await supabase
          .from('bluesky_article_correlations')
          .upsert(matches, {
            onConflict: 'article_id,topic'
          });

        if (insertError) {
          console.error(`❌ Error inserting correlations:`, insertError);
        } else {
          totalCorrelations += matches.length;

          const articleIds = matches.map(m => m.article_id);
          await supabase
            .from('bluesky_trends')
            .update({
              related_articles: articleIds,
              correlation_score: matches[0]?.correlation_strength || 0,
              updated_at: new Date().toISOString()
            })
            .eq('topic', trend.topic);

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
