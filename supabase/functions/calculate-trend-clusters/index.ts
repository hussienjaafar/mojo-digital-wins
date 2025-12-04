import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TopicData {
  topic: string;
  google_news_count: number;
  reddit_count: number;
  bluesky_count: number;
  rss_count: number;
  total_count: number;
  avg_sentiment: number;
  sentiment_counts: { positive: number; negative: number; neutral: number };
  sample_headlines: string[];
  google_news_ids: string[];
  reddit_ids: string[];
  bluesky_ids: string[];
  article_ids: string[];
  first_seen: Date;
  last_seen: Date;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Calculating cross-source trend clusters...');
    
    const topicMap = new Map<string, TopicData>();
    const now = new Date();
    const hour1Ago = new Date(now.getTime() - 60 * 60 * 1000);
    const hours6Ago = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const hours24Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Helper to normalize topic names
    const normalizeTopic = (topic: string): string => {
      return topic
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .trim()
        .split(/\s+/)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    };
    
    // Aggregate Google News topics (last 24h)
    const { data: newsData } = await supabase
      .from('google_news_articles')
      .select('id, title, ai_topics, ai_sentiment, ai_sentiment_label, published_at')
      .eq('ai_processed', true)
      .gte('published_at', hours24Ago.toISOString())
      .not('ai_topics', 'is', null);
    
    if (newsData) {
      for (const item of newsData) {
        for (const topic of (item.ai_topics || [])) {
          const normalized = normalizeTopic(topic);
          if (!normalized || normalized.length < 3) continue;
          
          if (!topicMap.has(normalized)) {
            topicMap.set(normalized, {
              topic: normalized,
              google_news_count: 0,
              reddit_count: 0,
              bluesky_count: 0,
              rss_count: 0,
              total_count: 0,
              avg_sentiment: 0,
              sentiment_counts: { positive: 0, negative: 0, neutral: 0 },
              sample_headlines: [],
              google_news_ids: [],
              reddit_ids: [],
              bluesky_ids: [],
              article_ids: [],
              first_seen: new Date(item.published_at),
              last_seen: new Date(item.published_at)
            });
          }
          
          const data = topicMap.get(normalized)!;
          data.google_news_count++;
          data.total_count++;
          data.google_news_ids.push(item.id);
          
          if (data.sample_headlines.length < 5) {
            data.sample_headlines.push(item.title);
          }
          
          // Track sentiment
          if (item.ai_sentiment_label === 'positive') data.sentiment_counts.positive++;
          else if (item.ai_sentiment_label === 'negative') data.sentiment_counts.negative++;
          else data.sentiment_counts.neutral++;
          
          // Update timestamps
          const pubDate = new Date(item.published_at);
          if (pubDate < data.first_seen) data.first_seen = pubDate;
          if (pubDate > data.last_seen) data.last_seen = pubDate;
        }
      }
    }
    
    // Aggregate Reddit topics
    const { data: redditData } = await supabase
      .from('reddit_posts')
      .select('id, title, ai_topics, ai_sentiment, ai_sentiment_label, created_utc')
      .eq('ai_processed', true)
      .gte('created_utc', hours24Ago.toISOString())
      .not('ai_topics', 'is', null);
    
    if (redditData) {
      for (const item of redditData) {
        for (const topic of (item.ai_topics || [])) {
          const normalized = normalizeTopic(topic);
          if (!normalized || normalized.length < 3) continue;
          
          if (!topicMap.has(normalized)) {
            topicMap.set(normalized, {
              topic: normalized,
              google_news_count: 0,
              reddit_count: 0,
              bluesky_count: 0,
              rss_count: 0,
              total_count: 0,
              avg_sentiment: 0,
              sentiment_counts: { positive: 0, negative: 0, neutral: 0 },
              sample_headlines: [],
              google_news_ids: [],
              reddit_ids: [],
              bluesky_ids: [],
              article_ids: [],
              first_seen: new Date(item.created_utc),
              last_seen: new Date(item.created_utc)
            });
          }
          
          const data = topicMap.get(normalized)!;
          data.reddit_count++;
          data.total_count++;
          data.reddit_ids.push(item.id);
          
          if (data.sample_headlines.length < 5) {
            data.sample_headlines.push(item.title);
          }
          
          if (item.ai_sentiment_label === 'positive') data.sentiment_counts.positive++;
          else if (item.ai_sentiment_label === 'negative') data.sentiment_counts.negative++;
          else data.sentiment_counts.neutral++;
          
          const createdDate = new Date(item.created_utc);
          if (createdDate < data.first_seen) data.first_seen = createdDate;
          if (createdDate > data.last_seen) data.last_seen = createdDate;
        }
      }
    }
    
    // Aggregate BlueSky topics
    const { data: blueskyData } = await supabase
      .from('bluesky_posts')
      .select('id, text, ai_topics, ai_sentiment, ai_sentiment_label, created_at')
      .eq('ai_processed', true)
      .gte('created_at', hours24Ago.toISOString())
      .not('ai_topics', 'is', null);
    
    if (blueskyData) {
      for (const item of blueskyData) {
        for (const topic of (item.ai_topics || [])) {
          const normalized = normalizeTopic(topic);
          if (!normalized || normalized.length < 3) continue;
          
          if (!topicMap.has(normalized)) {
            topicMap.set(normalized, {
              topic: normalized,
              google_news_count: 0,
              reddit_count: 0,
              bluesky_count: 0,
              rss_count: 0,
              total_count: 0,
              avg_sentiment: 0,
              sentiment_counts: { positive: 0, negative: 0, neutral: 0 },
              sample_headlines: [],
              google_news_ids: [],
              reddit_ids: [],
              bluesky_ids: [],
              article_ids: [],
              first_seen: new Date(item.created_at),
              last_seen: new Date(item.created_at)
            });
          }
          
          const data = topicMap.get(normalized)!;
          data.bluesky_count++;
          data.total_count++;
          data.bluesky_ids.push(item.id);
          
          if (item.ai_sentiment_label === 'positive') data.sentiment_counts.positive++;
          else if (item.ai_sentiment_label === 'negative') data.sentiment_counts.negative++;
          else data.sentiment_counts.neutral++;
          
          const createdDate = new Date(item.created_at);
          if (createdDate < data.first_seen) data.first_seen = createdDate;
          if (createdDate > data.last_seen) data.last_seen = createdDate;
        }
      }
    }
    
    // Aggregate RSS articles
    const { data: rssData } = await supabase
      .from('articles')
      .select('id, title, extracted_topics, sentiment_score, sentiment_label, published_date')
      .gte('published_date', hours24Ago.toISOString())
      .not('extracted_topics', 'is', null);
    
    if (rssData) {
      for (const item of rssData) {
        const topics = Array.isArray(item.extracted_topics) 
          ? item.extracted_topics 
          : (item.extracted_topics as any)?.topics || [];
          
        for (const topic of topics) {
          const topicStr = typeof topic === 'string' ? topic : topic?.topic || topic?.name || '';
          const normalized = normalizeTopic(topicStr);
          if (!normalized || normalized.length < 3) continue;
          
          if (!topicMap.has(normalized)) {
            topicMap.set(normalized, {
              topic: normalized,
              google_news_count: 0,
              reddit_count: 0,
              bluesky_count: 0,
              rss_count: 0,
              total_count: 0,
              avg_sentiment: 0,
              sentiment_counts: { positive: 0, negative: 0, neutral: 0 },
              sample_headlines: [],
              google_news_ids: [],
              reddit_ids: [],
              bluesky_ids: [],
              article_ids: [],
              first_seen: new Date(item.published_date),
              last_seen: new Date(item.published_date)
            });
          }
          
          const data = topicMap.get(normalized)!;
          data.rss_count++;
          data.total_count++;
          data.article_ids.push(item.id);
          
          if (data.sample_headlines.length < 5) {
            data.sample_headlines.push(item.title);
          }
          
          if (item.sentiment_label === 'positive') data.sentiment_counts.positive++;
          else if (item.sentiment_label === 'negative') data.sentiment_counts.negative++;
          else data.sentiment_counts.neutral++;
          
          const pubDate = new Date(item.published_date);
          if (pubDate < data.first_seen) data.first_seen = pubDate;
          if (pubDate > data.last_seen) data.last_seen = pubDate;
        }
      }
    }
    
    // Filter and process top topics
    const significantTopics = Array.from(topicMap.values())
      .filter(t => t.total_count >= 3) // Minimum mentions
      .sort((a, b) => b.total_count - a.total_count)
      .slice(0, 100); // Top 100 topics
    
    console.log(`Found ${significantTopics.length} significant topics`);
    
    // Calculate velocity and create/update clusters
    let clustersUpdated = 0;
    
    for (const topicData of significantTopics) {
      // Calculate cross-source score
      const crossSourceScore = (
        (topicData.google_news_count > 0 ? 1 : 0) +
        (topicData.reddit_count > 0 ? 1 : 0) +
        (topicData.bluesky_count > 0 ? 1 : 0) +
        (topicData.rss_count > 0 ? 1 : 0)
      );
      
      // Calculate dominant sentiment
      const { positive, negative, neutral } = topicData.sentiment_counts;
      const total = positive + negative + neutral;
      let dominantSentiment = 'neutral';
      let sentimentScore = 0;
      
      if (total > 0) {
        if (positive > negative && positive > neutral) {
          dominantSentiment = 'positive';
          sentimentScore = positive / total;
        } else if (negative > positive && negative > neutral) {
          dominantSentiment = 'negative';
          sentimentScore = -(negative / total);
        }
      }
      
      // Get hour counts for velocity
      const { count: hourCount } = await supabase
        .from('google_news_articles')
        .select('id', { count: 'exact', head: true })
        .eq('ai_processed', true)
        .contains('ai_topics', [topicData.topic])
        .gte('published_at', hour1Ago.toISOString());
      
      const { count: sixHourCount } = await supabase
        .from('google_news_articles')
        .select('id', { count: 'exact', head: true })
        .eq('ai_processed', true)
        .contains('ai_topics', [topicData.topic])
        .gte('published_at', hours6Ago.toISOString());
      
      // Calculate velocity
      const mentions1h = hourCount || 0;
      const mentions6h = sixHourCount || 0;
      const mentions24h = topicData.total_count;
      
      const hourlyRate = mentions1h;
      const dailyAvg = mentions24h / 24;
      const velocity = dailyAvg > 0 
        ? ((hourlyRate - dailyAvg) / dailyAvg) * 100 
        : (mentions1h > 0 ? 500 : 0);
      
      // Determine momentum
      const momentum = velocity > 50 ? 'up' : velocity < -20 ? 'down' : 'stable';
      
      // Is trending?
      const isTrending = (velocity > 30 && mentions24h >= 5) || 
                         (crossSourceScore >= 3 && mentions24h >= 10) ||
                         mentions1h >= 5;
      
      // Generate summary using AI (only for high-signal topics)
      let clusterSummary = topicData.sample_headlines[0] || topicData.topic;
      
      if (isTrending && lovableApiKey && topicData.sample_headlines.length >= 3) {
        try {
          const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${lovableApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash-lite', // Cheapest model
              messages: [
                {
                  role: 'system',
                  content: 'Create a 1-sentence news summary from these headlines. Be specific about the story, not generic.'
                },
                {
                  role: 'user',
                  content: topicData.sample_headlines.slice(0, 5).join('\n')
                }
              ],
              max_tokens: 100
            })
          });
          
          if (response.ok) {
            const data = await response.json();
            clusterSummary = data.choices[0]?.message?.content || clusterSummary;
          }
        } catch (e) {
          console.error('AI summary error:', e);
        }
      }
      
      // Upsert cluster
      const { error } = await supabase
        .from('trend_clusters')
        .upsert({
          cluster_title: topicData.topic,
          cluster_summary: clusterSummary,
          dominant_sentiment: dominantSentiment,
          sentiment_score: Math.round(sentimentScore * 100) / 100,
          total_mentions: mentions24h,
          mentions_last_hour: mentions1h,
          mentions_last_6h: mentions6h,
          mentions_last_24h: mentions24h,
          velocity_score: Math.round(velocity * 100) / 100,
          momentum,
          source_distribution: {
            google_news: topicData.google_news_count,
            reddit: topicData.reddit_count,
            bluesky: topicData.bluesky_count,
            rss: topicData.rss_count
          },
          google_news_count: topicData.google_news_count,
          reddit_count: topicData.reddit_count,
          bluesky_count: topicData.bluesky_count,
          rss_count: topicData.rss_count,
          cross_source_score: crossSourceScore,
          google_news_ids: topicData.google_news_ids.slice(0, 50),
          reddit_ids: topicData.reddit_ids.slice(0, 50),
          bluesky_ids: topicData.bluesky_ids.slice(0, 50),
          article_ids: topicData.article_ids.slice(0, 50),
          first_seen_at: topicData.first_seen.toISOString(),
          last_activity_at: topicData.last_seen.toISOString(),
          is_trending: isTrending,
          trending_since: isTrending ? now.toISOString() : null,
          updated_at: now.toISOString()
        }, {
          onConflict: 'cluster_title'
        });
      
      if (!error) clustersUpdated++;
    }
    
    // Log batch
    await supabase.from('processing_batches').insert({
      batch_type: 'trend_clusters',
      items_count: topicMap.size,
      unique_items: significantTopics.length,
      clusters_created: clustersUpdated,
      processing_time_ms: Date.now() - startTime,
      completed_at: new Date().toISOString(),
      status: 'completed'
    });

    const result = {
      success: true,
      total_topics: topicMap.size,
      significant_topics: significantTopics.length,
      clusters_updated: clustersUpdated,
      duration_ms: Date.now() - startTime
    };
    
    console.log('Trend cluster calculation complete:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error in calculate-trend-clusters:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
