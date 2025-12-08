import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateCronOrAdmin, logJobFailure, checkRateLimit } from "../_shared/security.ts";

// Expanded topic normalization (matches analyze-bluesky-posts)
const TOPIC_NORMALIZATIONS: Record<string, string> = {
  'donald trump': 'Donald Trump',
  'trump': 'Donald Trump',
  'joe biden': 'Joe Biden',
  'biden': 'Joe Biden',
  'netanyahu': 'Benjamin Netanyahu',
  'benjamin netanyahu': 'Benjamin Netanyahu',
  'israel': 'Israel',
  'palestine': 'Palestine',
  'gaza': 'Gaza',
  'west bank': 'West Bank',
  'middle east': 'Middle East',
  'un': 'United Nations',
  'united nations': 'United Nations',
  'ice': 'ICE',
  'gop': 'Republican Party',
  'republican party': 'Republican Party',
  'democratic party': 'Democratic Party',
  'nyc': 'New York City',
  'new york city': 'New York City',
  'dc': 'Washington DC',
  'washington dc': 'Washington DC',
  'climate change': 'Climate Change',
  'climate crisis': 'Climate Change',
  'human rights': 'Human Rights',
  'civil rights': 'Civil Rights',
  'lgbtq rights': 'LGBTQ Rights',
  'lgbtq': 'LGBTQ Rights',
  'immigration': 'Immigration',
  'surveillance': 'Surveillance',
  'privacy': 'Privacy',
  'genocide': 'Genocide',
  'humanitarian crisis': 'Humanitarian Crisis',
  'occupation': 'Occupation',
  'israel-palestine conflict': 'Israel-Palestine Conflict',
  'palestinian conflict': 'Israel-Palestine Conflict',
};

function normalizeTopic(topic: string): string {
  const lower = topic.toLowerCase();
  return TOPIC_NORMALIZATIONS[lower] || topic;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // SECURITY: Require cron secret or admin JWT
    const authResult = await validateCronOrAdmin(req, supabase);
    if (!authResult.valid) {
      console.error('[calculate-bluesky-trends] Unauthorized access attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Rate limiting
    const rateLimit = await checkRateLimit('calculate-bluesky-trends', 20, 60000);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', resetAt: rateLimit.resetAt }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📊 Recalculating all Bluesky trends from existing posts...');

    // Get all processed posts with topics
    const { data: posts, error } = await supabase
      .from('bluesky_posts')
      .select('ai_topics, ai_sentiment, created_at')
      .eq('ai_processed', true)
      .not('ai_topics', 'is', null);

    if (error) throw error;
    if (!posts || posts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No processed posts found', trendsUpdated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📈 Processing ${posts.length} posts...`);

    // Aggregate topics with normalization
    const topicData = new Map<string, { 
      sentiment: number[], 
      timestamps: Date[],
      mentionsLastHour: number,
      mentionsLast6Hours: number,
      mentionsLast24Hours: number,
      mentionsLastWeek: number
    }>();

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    for (const post of posts) {
      if (!post.ai_topics || !Array.isArray(post.ai_topics)) continue;

      const postDate = new Date(post.created_at);

      for (const rawTopic of post.ai_topics) {
        const topic = normalizeTopic(rawTopic);
        
        if (!topicData.has(topic)) {
          topicData.set(topic, {
            sentiment: [],
            timestamps: [],
            mentionsLastHour: 0,
            mentionsLast6Hours: 0,
            mentionsLast24Hours: 0,
            mentionsLastWeek: 0
          });
        }

        const data = topicData.get(topic)!;
        data.sentiment.push(post.ai_sentiment || 0);
        data.timestamps.push(postDate);

        // Count by time window
        if (postDate >= oneHourAgo) data.mentionsLastHour++;
        if (postDate >= sixHoursAgo) data.mentionsLast6Hours++;
        if (postDate >= oneDayAgo) data.mentionsLast24Hours++;
        if (postDate >= oneWeekAgo) data.mentionsLastWeek++;
      }
    }

    console.log(`📊 Found ${topicData.size} unique topics`);

    // Calculate trends
    const trends = [];
    for (const [topic, data] of topicData.entries()) {
      const avgSentiment = data.sentiment.reduce((a, b) => a + b, 0) / data.sentiment.length;
      
      // Sentiment breakdown
      const sentimentPositive = data.sentiment.filter(s => s > 0.3).length;
      const sentimentNeutral = data.sentiment.filter(s => s >= -0.3 && s <= 0.3).length;
      const sentimentNegative = data.sentiment.filter(s => s < -0.3).length;

      // FIXED: Multi-window velocity calculation
      const sixHourAvg = data.mentionsLast6Hours / 6;
      const dailyAvg = data.mentionsLast24Hours / 24;
      
      let velocity = 0;
      if (dailyAvg > 0) {
        velocity = ((sixHourAvg - dailyAvg) / dailyAvg) * 100;
      } else if (data.mentionsLast6Hours > 0) {
        velocity = 500; // New emerging topic
      }

      // FIXED: Lower threshold (50% = 1.5x increase) + minimum volume
      const isTrending = (velocity > 50 && data.mentionsLast24Hours >= 3) || data.mentionsLast6Hours >= 5;

      // Find first and last mention
      const sortedTimestamps = data.timestamps.sort((a, b) => a.getTime() - b.getTime());
      const firstSeen = sortedTimestamps[0];
      const lastSeen = sortedTimestamps[sortedTimestamps.length - 1];

      // Get existing trend to preserve trending_since
      const { data: existingTrend } = await supabase
        .from('bluesky_trends')
        .select('is_trending, trending_since')
        .eq('topic', topic)
        .single();

      trends.push({
        topic,
        mentions_last_hour: data.mentionsLastHour,
        mentions_last_6_hours: data.mentionsLast6Hours,
        mentions_last_24_hours: data.mentionsLast24Hours,
        mentions_last_week: data.mentionsLastWeek,
        velocity: Math.round(velocity * 100) / 100,
        sentiment_avg: Math.round(avgSentiment * 100) / 100,
        sentiment_positive: sentimentPositive,
        sentiment_neutral: sentimentNeutral,
        sentiment_negative: sentimentNegative,
        is_trending: isTrending,
        trending_since: isTrending 
          ? (existingTrend?.is_trending ? existingTrend.trending_since : new Date().toISOString())
          : null,
        first_seen_at: firstSeen.toISOString(),
        last_seen_at: lastSeen.toISOString(),
        calculated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    console.log(`💾 Upserting ${trends.length} trends...`);

    // Batch upsert (50 at a time to avoid timeouts)
    let upserted = 0;
    const batchSize = 50;
    
    for (let i = 0; i < trends.length; i += batchSize) {
      const batch = trends.slice(i, i + batchSize);
      const { error: upsertError } = await supabase
        .from('bluesky_trends')
        .upsert(batch, { onConflict: 'topic' });

      if (upsertError) {
        console.error(`❌ Error upserting batch ${i / batchSize + 1}:`, upsertError);
      } else {
        upserted += batch.length;
        console.log(`✅ Upserted batch ${i / batchSize + 1} (${batch.length} trends)`);
      }
    }

    // Count trending topics
    const trendingCount = trends.filter(t => t.is_trending).length;

    console.log(`✅ Complete: ${upserted} trends upserted, ${trendingCount} trending`);

    return new Response(
      JSON.stringify({
        success: true,
        trendsCalculated: trends.length,
        trendsUpserted: upserted,
        trendingTopics: trendingCount,
        topTrending: trends
          .filter(t => t.is_trending)
          .sort((a, b) => b.velocity - a.velocity)
          .slice(0, 10)
          .map(t => ({ topic: t.topic, velocity: t.velocity, mentions: t.mentions_last_24_hours }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in calculate-bluesky-trends:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
