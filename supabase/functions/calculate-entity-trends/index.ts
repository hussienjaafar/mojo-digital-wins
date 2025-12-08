import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateCronOrAdmin, logJobFailure, checkRateLimit } from "../_shared/security.ts";

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
      console.error('[calculate-entity-trends] Unauthorized access attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log(`[calculate-entity-trends] Authorized via ${authResult.isAdmin ? 'admin' : 'cron'}`);

    // SECURITY: Rate limiting
    const rateLimit = await checkRateLimit('calculate-entity-trends', 10, 60000);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', resetAt: rateLimit.resetAt }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔄 Starting enhanced entity trends calculation...');

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // Get all entity mentions from the last 7 days
    const { data: mentions, error: mentionsError } = await supabase
      .from('entity_mentions')
      .select('entity_name, entity_type, sentiment, mentioned_at')
      .gte('mentioned_at', sevenDaysAgo);

    if (mentionsError) throw mentionsError;

    console.log(`📊 Found ${mentions?.length || 0} existing mentions`);

    // If no or few mentions, extract from content sources
    if (!mentions || mentions.length < 50) {
      console.log('📝 Extracting entities from content sources...');
      
      const newMentions: any[] = [];
      
      // Get recent articles
      const { data: articles } = await supabase
        .from('articles')
        .select('id, title, ai_summary, affected_groups, affected_organizations, sentiment_score, published_date, source_url')
        .gte('published_date', oneDayAgo)
        .limit(200);

      if (articles) {
        for (const article of articles) {
          if (article.affected_organizations) {
            for (const org of article.affected_organizations) {
              newMentions.push({
                entity_name: org,
                entity_type: 'organization',
                source_type: 'article',
                source_id: article.id,
                source_title: article.title,
                source_url: article.source_url,
                mentioned_at: article.published_date,
                sentiment: article.sentiment_score || 0,
                context_snippet: article.ai_summary?.substring(0, 200) || article.title,
              });
            }
          }
          if (article.affected_groups) {
            for (const group of article.affected_groups) {
              newMentions.push({
                entity_name: group,
                entity_type: 'topic',
                source_type: 'article',
                source_id: article.id,
                source_title: article.title,
                source_url: article.source_url,
                mentioned_at: article.published_date,
                sentiment: article.sentiment_score || 0,
                context_snippet: article.ai_summary?.substring(0, 200) || article.title,
              });
            }
          }
        }
      }

      // Get bluesky trends
      const { data: blueskyTrends } = await supabase
        .from('bluesky_trends')
        .select('topic, mentions_last_hour, mentions_last_24_hours, velocity, sentiment_avg')
        .eq('is_trending', true)
        .order('velocity', { ascending: false })
        .limit(100);

      if (blueskyTrends) {
        for (const trend of blueskyTrends) {
          newMentions.push({
            entity_name: trend.topic,
            entity_type: 'topic',
            source_type: 'bluesky',
            mentioned_at: new Date().toISOString(),
            sentiment: trend.sentiment_avg || 0,
            context_snippet: `Trending on social: ${trend.mentions_last_24_hours} mentions`,
            platform_engagement: {
              mentions_1h: trend.mentions_last_hour,
              mentions_24h: trend.mentions_last_24_hours,
              velocity: trend.velocity
            }
          });
        }
      }

      // Get trending news topics
      const { data: newsTrends } = await supabase
        .from('trending_news_topics')
        .select('topic, mention_count, velocity_score, sentiment_avg')
        .gte('hour_timestamp', oneDayAgo)
        .order('velocity_score', { ascending: false })
        .limit(100);

      if (newsTrends) {
        for (const trend of newsTrends) {
          newMentions.push({
            entity_name: trend.topic,
            entity_type: 'topic',
            source_type: 'news',
            mentioned_at: new Date().toISOString(),
            sentiment: trend.sentiment_avg || 0,
            context_snippet: `News trend: ${trend.mention_count} mentions`,
          });
        }
      }

      // Insert new mentions (dedupe by entity+source)
      if (newMentions.length > 0) {
        console.log(`📤 Inserting ${newMentions.length} entity mentions...`);
        const { error: insertError } = await supabase
          .from('entity_mentions')
          .insert(newMentions);
        
        if (insertError && !insertError.message.includes('duplicate')) {
          console.error("Error inserting mentions:", insertError);
        }
      }
    }

    // Fetch all mentions again after potential insert
    const { data: allMentions } = await supabase
      .from('entity_mentions')
      .select('entity_name, entity_type, sentiment, mentioned_at')
      .gte('mentioned_at', sevenDaysAgo);

    // Group mentions by entity_name (case-insensitive)
    const entityGroups = new Map<string, {
      entity_type: string;
      sentiments: { value: number; time: Date }[];
      mentions: Date[];
    }>();
    
    for (const mention of allMentions || []) {
      const key = mention.entity_name.toLowerCase();
      if (!entityGroups.has(key)) {
        entityGroups.set(key, {
          entity_type: mention.entity_type || 'topic',
          sentiments: [],
          mentions: [],
        });
      }
      const group = entityGroups.get(key)!;
      group.mentions.push(new Date(mention.mentioned_at));
      if (mention.sentiment !== null) {
        group.sentiments.push({ value: mention.sentiment, time: new Date(mention.mentioned_at) });
      }
    }

    console.log(`📈 Processing ${entityGroups.size} unique entities`);

    // Calculate trends for each entity
    const trends = [];
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const oneDayAgoDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    for (const [entityName, data] of entityGroups) {
      const mentions1h = data.mentions.filter(m => m > oneHourAgo).length;
      const mentions6h = data.mentions.filter(m => m > sixHoursAgo).length;
      const mentions24h = data.mentions.filter(m => m > oneDayAgoDate).length;
      const mentions7d = data.mentions.length;

      // Enhanced velocity calculation using time-weighted approach
      const hourlyRate = mentions1h;
      const sixHourAvg = mentions6h / 6;
      const dailyAvg = mentions24h / 24;
      const weeklyAvg = mentions7d / 168;

      let velocity = 0;
      if (weeklyAvg > 0) {
        // Compare current hourly rate to weekly baseline
        velocity = ((hourlyRate - weeklyAvg) / weeklyAvg) * 100;
      } else if (dailyAvg > 0) {
        velocity = ((hourlyRate - dailyAvg) / dailyAvg) * 100;
      } else if (hourlyRate > 0) {
        velocity = 500; // New entity spike
      }

      // Calculate sentiment with time decay (recent sentiment matters more)
      let avgSentiment = 0;
      let sentimentChange = 0;
      
      if (data.sentiments.length > 0) {
        // Recent 12h sentiment vs older 12-48h sentiment
        const recentSentiments = data.sentiments.filter(s => s.time > new Date(now.getTime() - 12 * 60 * 60 * 1000));
        const olderSentiments = data.sentiments.filter(s => s.time <= new Date(now.getTime() - 12 * 60 * 60 * 1000) && s.time > twoDaysAgo);
        
        const recentAvg = recentSentiments.length > 0 
          ? recentSentiments.reduce((sum, s) => sum + s.value, 0) / recentSentiments.length 
          : 0;
        const olderAvg = olderSentiments.length > 0 
          ? olderSentiments.reduce((sum, s) => sum + s.value, 0) / olderSentiments.length 
          : 0;
        
        avgSentiment = data.sentiments.reduce((sum, s) => sum + s.value, 0) / data.sentiments.length;
        sentimentChange = recentSentiments.length > 0 && olderSentiments.length > 0 
          ? recentAvg - olderAvg 
          : 0;
      }

      // Get first and last seen
      const timestamps = data.mentions.map(m => m.getTime());
      const firstSeen = new Date(Math.min(...timestamps)).toISOString();
      const lastSeen = new Date(Math.max(...timestamps)).toISOString();

      // Improved trending detection
      const isTrending = 
        (velocity > 50 && mentions24h >= 3) || // High velocity with volume
        mentions6h >= 5 || // High recent activity
        Math.abs(sentimentChange) > 0.3 || // Significant sentiment shift
        (hourlyRate >= 2 && velocity > 100); // Breakthrough detection

      trends.push({
        entity_name: entityName,
        entity_type: data.entity_type,
        mentions_1h: mentions1h,
        mentions_6h: mentions6h,
        mentions_24h: mentions24h,
        mentions_7d: mentions7d,
        velocity: Math.round(velocity * 100) / 100,
        is_trending: isTrending,
        sentiment_avg: Math.round(avgSentiment * 100) / 100,
        sentiment_change: Math.round(sentimentChange * 100) / 100,
        first_seen_at: firstSeen,
        last_seen_at: lastSeen,
        calculated_at: now.toISOString(),
        updated_at: now.toISOString(),
      });
    }

    console.log(`📊 Calculated trends for ${trends.length} entities, ${trends.filter(t => t.is_trending).length} trending`);

    // Upsert trends into entity_trends table
    let upsertedCount = 0;
    for (const trend of trends) {
      const { error: upsertError } = await supabase
        .from('entity_trends')
        .upsert(trend, { 
          onConflict: 'entity_name',
          ignoreDuplicates: false 
        });

      if (upsertError) {
        console.error(`Error upserting trend for ${trend.entity_name}:`, upsertError);
      } else {
        upsertedCount++;
      }
    }

    console.log(`✅ Entity trends calculation complete: ${upsertedCount} upserted`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        trendsCalculated: trends.length,
        trendingCount: trends.filter(t => t.is_trending).length,
        mentionsProcessed: allMentions?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error calculating entity trends:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
