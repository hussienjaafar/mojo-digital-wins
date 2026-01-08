import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HourlyCount {
  event_key: string;
  hour_bucket: string;
  mention_count: number;
}

interface BaselineData {
  event_key: string;
  hourly_readings: number[];
  avg_hourly: number;
  hourly_std_dev: number;
  relative_std_dev: number;
  min_hourly: number;
  max_hourly: number;
  is_stable: boolean;
  total_mentions_7d: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[update-trend-baselines] Starting baseline computation...');

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Validate cron secret for scheduled runs
    const cronSecret = req.headers.get('x-cron-secret');
    const expectedSecret = Deno.env.get('CRON_SECRET');
    const authHeader = req.headers.get('Authorization');
    
    let isAuthorized = false;
    if (cronSecret && expectedSecret && cronSecret === expectedSecret) {
      isAuthorized = true;
    } else if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        isAuthorized = profile?.role === 'admin';
      }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get hourly mention counts for the last 7 days from articles
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    console.log('[update-trend-baselines] Fetching articles from last 7 days...');
    
    const { data: articles, error: articlesError } = await supabase
      .from('articles')
      .select('id, published_date, extracted_topics')
      .gte('published_date', sevenDaysAgo)
      .not('extracted_topics', 'is', null)
      .order('published_date', { ascending: true });

    if (articlesError) {
      throw new Error(`Failed to fetch articles: ${articlesError.message}`);
    }

    console.log(`[update-trend-baselines] Processing ${articles?.length || 0} articles...`);

    // Build hourly counts per topic
    const hourlyCountsMap = new Map<string, Map<string, number>>();

    for (const article of articles || []) {
      if (!article.extracted_topics) continue;

      const pubDate = new Date(article.published_date);
      const hourBucket = new Date(
        pubDate.getFullYear(),
        pubDate.getMonth(),
        pubDate.getDate(),
        pubDate.getHours()
      ).toISOString();

      const topics = Array.isArray(article.extracted_topics) 
        ? article.extracted_topics 
        : [];

      for (const topic of topics) {
        const topicName = typeof topic === 'string' ? topic : topic?.name;
        if (!topicName) continue;

        const eventKey = topicName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        
        if (!hourlyCountsMap.has(eventKey)) {
          hourlyCountsMap.set(eventKey, new Map());
        }
        
        const topicHours = hourlyCountsMap.get(eventKey)!;
        topicHours.set(hourBucket, (topicHours.get(hourBucket) || 0) + 1);
      }
    }

    console.log(`[update-trend-baselines] Found ${hourlyCountsMap.size} unique topics...`);

    // Also get Bluesky post counts
    const { data: posts, error: postsError } = await supabase
      .from('bluesky_posts')
      .select('id, created_at, ai_topics')
      .gte('created_at', sevenDaysAgo)
      .not('ai_topics', 'is', null)
      .order('created_at', { ascending: true });

    if (!postsError && posts) {
      console.log(`[update-trend-baselines] Processing ${posts.length} Bluesky posts...`);
      
      for (const post of posts) {
        if (!post.ai_topics) continue;

        const createdAt = new Date(post.created_at);
        const hourBucket = new Date(
          createdAt.getFullYear(),
          createdAt.getMonth(),
          createdAt.getDate(),
          createdAt.getHours()
        ).toISOString();

        const topics = Array.isArray(post.ai_topics) ? post.ai_topics : [];

        for (const topic of topics) {
          const topicName = typeof topic === 'string' ? topic : String(topic);
          if (!topicName) continue;

          const eventKey = topicName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
          
          if (!hourlyCountsMap.has(eventKey)) {
            hourlyCountsMap.set(eventKey, new Map());
          }
          
          const topicHours = hourlyCountsMap.get(eventKey)!;
          topicHours.set(hourBucket, (topicHours.get(hourBucket) || 0) + 1);
        }
      }
    }

    // Generate all hour buckets for the last 7 days (168 hours)
    const allHours: string[] = [];
    const now = new Date();
    for (let i = 167; i >= 0; i--) {
      const hourDate = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourBucket = new Date(
        hourDate.getFullYear(),
        hourDate.getMonth(),
        hourDate.getDate(),
        hourDate.getHours()
      ).toISOString();
      allHours.push(hourBucket);
    }

    // Compute baselines for each topic
    const baselines: BaselineData[] = [];
    
    for (const [eventKey, hourCounts] of hourlyCountsMap.entries()) {
      // Fill in zero counts for missing hours
      const readings: number[] = allHours.map(hour => hourCounts.get(hour) || 0);
      
      // Calculate statistics
      const total = readings.reduce((a, b) => a + b, 0);
      const avg = total / readings.length;
      
      // Standard deviation - handle sparse data correctly
      const nonZeroReadings = readings.filter(r => r > 0);
      let stdDev: number;
      
      if (nonZeroReadings.length >= 3) {
        // Population standard deviation across all 168 hour buckets
        const squaredDiffs = readings.map(r => Math.pow(r - avg, 2));
        const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / readings.length;
        stdDev = Math.sqrt(avgSquaredDiff);
      } else if (nonZeroReadings.length >= 1) {
        // Sparse data: estimate volatility based on max spike vs avg
        // This gives us a reasonable std dev even with few data points
        const maxReading = Math.max(...readings);
        stdDev = Math.max(avg * 0.5, (maxReading - avg) / 2);
      } else {
        // No data at all
        stdDev = 0;
      }
      
      // Relative standard deviation (coefficient of variation)
      const rsd = avg > 0 ? stdDev / avg : 0;
      
      // Min/max
      const min = Math.min(...readings);
      const max = Math.max(...readings);
      
      // Is stable? (low variation = evergreen topic)
      const isStable = rsd < 0.4 && avg > 0.5;
      
      baselines.push({
        event_key: eventKey,
        hourly_readings: readings,
        avg_hourly: avg,
        hourly_std_dev: stdDev,
        relative_std_dev: rsd,
        min_hourly: min,
        max_hourly: max,
        is_stable: isStable,
        total_mentions_7d: total
      });
    }

    console.log(`[update-trend-baselines] Computed ${baselines.length} baselines...`);

    // Filter to topics with at least some activity
    const significantBaselines = baselines.filter(b => b.total_mentions_7d >= 2);
    console.log(`[update-trend-baselines] ${significantBaselines.length} topics with >= 2 mentions...`);

    // Upsert baselines in batches
    const batchSize = 100;
    let upsertedCount = 0;
    const today = new Date().toISOString().split('T')[0];

    for (let i = 0; i < significantBaselines.length; i += batchSize) {
      const batch = significantBaselines.slice(i, i + batchSize);
      
      const upsertData = batch.map(b => ({
        event_key: b.event_key,
        baseline_date: today,
        mentions_count: Math.round(b.avg_hourly * 24),  // daily mentions
        hourly_average: b.avg_hourly,
        news_mentions: 0,  // Will be populated separately if needed
        social_mentions: 0, // Will be populated separately if needed  
        avg_sentiment: 0,
        hourly_std_dev: b.hourly_std_dev,
        relative_std_dev: b.relative_std_dev,
        hourly_readings: b.hourly_readings,
        min_hourly: b.min_hourly,
        max_hourly: b.max_hourly,
        is_stable: b.is_stable
      }));

      const { error: upsertError } = await supabase
        .from('trend_baselines')
        .upsert(upsertData, { 
          onConflict: 'event_key,baseline_date',
          ignoreDuplicates: false 
        });

      if (upsertError) {
        console.error(`[update-trend-baselines] Batch upsert error:`, upsertError);
      } else {
        upsertedCount += batch.length;
      }
    }

    // Log stable (evergreen) topics for reference
    const stableTopics = significantBaselines
      .filter(b => b.is_stable && b.total_mentions_7d > 10)
      .sort((a, b) => b.total_mentions_7d - a.total_mentions_7d)
      .slice(0, 20);

    console.log('[update-trend-baselines] Top stable/evergreen topics:', 
      stableTopics.map(t => `${t.event_key} (${t.total_mentions_7d} mentions, RSD: ${t.relative_std_dev.toFixed(2)})`));

    // Log high volatility topics (potential breaking news candidates)
    const volatileTopics = significantBaselines
      .filter(b => b.relative_std_dev > 1.5 && b.total_mentions_7d > 5)
      .sort((a, b) => b.relative_std_dev - a.relative_std_dev)
      .slice(0, 20);

    console.log('[update-trend-baselines] Top volatile topics:', 
      volatileTopics.map(t => `${t.event_key} (RSD: ${t.relative_std_dev.toFixed(2)}, max: ${t.max_hourly})`));

    const duration = Date.now() - startTime;
    
    const result = {
      success: true,
      articlesProcessed: articles?.length || 0,
      postsProcessed: posts?.length || 0,
      uniqueTopics: hourlyCountsMap.size,
      baselinesComputed: baselines.length,
      baselinesUpserted: upsertedCount,
      stableTopicsCount: stableTopics.length,
      volatileTopicsCount: volatileTopics.length,
      durationMs: duration
    };

    console.log('[update-trend-baselines] Complete:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const err = error as Error;
    console.error('[update-trend-baselines] Error:', err);
    return new Response(JSON.stringify({ 
      error: err.message,
      stack: err.stack 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
