import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateCronOrAdmin, logJobFailure, checkRateLimit } from "../_shared/security.ts";
import { normalizeText, generateHash, extractCanonicalUrl, normalizeUrl, generateContentHash, extractDomain as extractDomainUtil } from "../_shared/urlNormalizer.ts";

/**
 * Evidence-Based Trend Detection v2
 * 
 * Improvements:
 * 1. Rolling baselines from trend_baselines (7d/30d)
 * 2. Deduplication via content_hash/canonical_url
 * 3. Deduped counts for velocity/confidence
 * 4. Evidence includes canonical_url + content_hash
 */

interface SourceMention {
  id: string;
  title: string;
  url?: string;
  published_at: string;
  source_type: 'rss' | 'google_news' | 'bluesky';
  sentiment_score?: number;
  sentiment_label?: string;
  topics: string[];
  domain?: string;
  content_hash?: string;
  canonical_url?: string;
}

interface TopicAggregate {
  event_key: string;
  event_title: string;
  mentions: SourceMention[];
  dedupedMentions: Map<string, SourceMention>; // key = content_hash
  first_seen_at: Date;
  last_seen_at: Date;
  by_source: {
    rss: number;
    google_news: number;
    bluesky: number;
  };
  by_source_deduped: {
    rss: number;
    google_news: number;
    bluesky: number;
  };
  sentiment_sum: number;
  sentiment_count: number;
}

interface RollingBaseline {
  baseline_7d: number;
  baseline_30d: number;
  data_points_7d: number;
  data_points_30d: number;
}

// Topic normalization with aliasing
const TOPIC_ALIASES: Record<string, string> = {
  'trump': 'Donald Trump',
  'biden': 'Joe Biden',
  'harris': 'Kamala Harris',
  'musk': 'Elon Musk',
  'doge': 'DOGE',
  'gop': 'Republican Party',
  'dems': 'Democratic Party',
  'scotus': 'Supreme Court',
  'potus': 'President',
};

function normalizeTopicKey(topic: string): string {
  const lower = topic.toLowerCase().trim();
  if (TOPIC_ALIASES[lower]) {
    return TOPIC_ALIASES[lower].toLowerCase().replace(/\s+/g, '_');
  }
  return lower.replace(/[^\w\s]/g, '').replace(/\s+/g, '_');
}

function normalizeTopicTitle(topic: string): string {
  const lower = topic.toLowerCase().trim();
  if (TOPIC_ALIASES[lower]) {
    return TOPIC_ALIASES[lower];
  }
  return topic.split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function extractDomain(url?: string): string {
  if (!url) return '';
  return extractDomainUtil(url);
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // SECURITY: Require cron secret or admin JWT
    const authResult = await validateCronOrAdmin(req, supabase);
    if (!authResult.valid) {
      console.error('[detect-trend-events] Unauthorized access attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Rate limiting
    const rateLimit = await checkRateLimit('detect-trend-events', 10, 60000);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', resetAt: rateLimit.resetAt }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[detect-trend-events] Starting evidence-based trend detection v2 (with rolling baselines + dedupe)...');
    
    const now = new Date();
    const hour1Ago = new Date(now.getTime() - 60 * 60 * 1000);
    const hours6Ago = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const hours24Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const days7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const days30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Load source tiers for authority weighting
    const { data: tierData } = await supabase
      .from('source_tiers')
      .select('domain, tier, authority_weight');
    
    const sourceTiers = new Map<string, { tier: string; weight: number }>();
    for (const t of tierData || []) {
      sourceTiers.set(t.domain, { tier: t.tier, weight: t.authority_weight || 1 });
    }
    
    // ========================================
    // STEP 1: Load rolling baselines from trend_baselines
    // ========================================
    console.log('[detect-trend-events] Loading rolling baselines...');
    
    const { data: baselineData } = await supabase
      .from('trend_baselines')
      .select('event_key, baseline_date, hourly_average')
      .gte('baseline_date', days30Ago.toISOString().split('T')[0])
      .order('baseline_date', { ascending: false });
    
    // Compute rolling averages per event_key
    const rollingBaselines = new Map<string, RollingBaseline>();
    const baselinesByKey = new Map<string, { date: string; hourly_avg: number }[]>();
    
    for (const b of baselineData || []) {
      if (!baselinesByKey.has(b.event_key)) {
        baselinesByKey.set(b.event_key, []);
      }
      baselinesByKey.get(b.event_key)!.push({
        date: b.baseline_date,
        hourly_avg: Number(b.hourly_average) || 0,
      });
    }
    
    const today = now.toISOString().split('T')[0];
    const date7dAgo = days7Ago.toISOString().split('T')[0];
    
    for (const [key, baselines] of baselinesByKey) {
      // Filter to 7d and 30d windows (excluding today to avoid counting current data)
      const last7d = baselines.filter(b => b.date >= date7dAgo && b.date < today);
      const last30d = baselines.filter(b => b.date < today);
      
      const avg7d = last7d.length > 0 
        ? last7d.reduce((sum, b) => sum + b.hourly_avg, 0) / last7d.length 
        : 0;
      const avg30d = last30d.length > 0 
        ? last30d.reduce((sum, b) => sum + b.hourly_avg, 0) / last30d.length 
        : 0;
      
      rollingBaselines.set(key, {
        baseline_7d: avg7d,
        baseline_30d: avg30d,
        data_points_7d: last7d.length,
        data_points_30d: last30d.length,
      });
    }
    
    console.log(`[detect-trend-events] Loaded rolling baselines for ${rollingBaselines.size} topics`);
    
    // ========================================
    // STEP 2: Aggregate topics with deduplication
    // ========================================
    const topicMap = new Map<string, TopicAggregate>();
    
    // Helper to generate content hash for deduplication
    const generateMentionHash = (mention: SourceMention): string => {
      // For Bluesky, use text hash since no URL
      if (mention.source_type === 'bluesky') {
        return generateHash(normalizeText(mention.title || '').substring(0, 100));
      }
      // For articles, use canonical URL + title hash
      return generateContentHash(
        mention.title || '',
        mention.url || '',
        mention.published_at
      );
    };
    
    // Helper to add mention to topic with deduplication
    const addMention = (topic: string, mention: SourceMention) => {
      const key = normalizeTopicKey(topic);
      if (!key || key.length < 2) return;
      
      // Generate content hash for dedupe
      const contentHash = generateMentionHash(mention);
      mention.content_hash = contentHash;
      
      // Generate canonical URL
      if (mention.url) {
        mention.canonical_url = extractCanonicalUrl(mention.url);
      }
      
      if (!topicMap.has(key)) {
        topicMap.set(key, {
          event_key: key,
          event_title: normalizeTopicTitle(topic),
          mentions: [],
          dedupedMentions: new Map(),
          first_seen_at: new Date(mention.published_at),
          last_seen_at: new Date(mention.published_at),
          by_source: { rss: 0, google_news: 0, bluesky: 0 },
          by_source_deduped: { rss: 0, google_news: 0, bluesky: 0 },
          sentiment_sum: 0,
          sentiment_count: 0,
        });
      }
      
      const agg = topicMap.get(key)!;
      
      // Add to raw mentions (for evidence)
      agg.mentions.push(mention);
      agg.by_source[mention.source_type]++;
      
      // Deduplicate: only count unique content hashes
      if (!agg.dedupedMentions.has(contentHash)) {
        agg.dedupedMentions.set(contentHash, mention);
        agg.by_source_deduped[mention.source_type]++;
      }
      
      const pubDate = new Date(mention.published_at);
      if (pubDate < agg.first_seen_at) agg.first_seen_at = pubDate;
      if (pubDate > agg.last_seen_at) agg.last_seen_at = pubDate;
      
      if (mention.sentiment_score !== undefined && mention.sentiment_score !== null) {
        agg.sentiment_sum += mention.sentiment_score;
        agg.sentiment_count++;
      }
    };
    
    // 1. Fetch articles with topics (RSS)
    const { data: articles } = await supabase
      .from('articles')
      .select('id, title, source_url, canonical_url, content_hash, published_date, sentiment_score, sentiment_label, tags')
      .gte('published_date', hours24Ago.toISOString())
      .eq('is_duplicate', false)
      .not('tags', 'is', null);
    
    for (const article of articles || []) {
      const mention: SourceMention = {
        id: article.id,
        title: article.title,
        url: article.source_url,
        canonical_url: article.canonical_url || undefined,
        content_hash: article.content_hash || undefined,
        published_at: article.published_date,
        source_type: 'rss',
        sentiment_score: article.sentiment_score,
        sentiment_label: article.sentiment_label,
        topics: article.tags || [],
        domain: extractDomain(article.source_url),
      };
      
      for (const topic of mention.topics) {
        addMention(topic, mention);
      }
    }
    
    // 2. Fetch Google News with topics
    const { data: googleNews } = await supabase
      .from('google_news_articles')
      .select('id, title, url, canonical_url, content_hash, published_at, ai_sentiment, ai_sentiment_label, ai_topics')
      .eq('ai_processed', true)
      .eq('is_duplicate', false)
      .gte('published_at', hours24Ago.toISOString())
      .not('ai_topics', 'is', null);
    
    for (const item of googleNews || []) {
      const mention: SourceMention = {
        id: item.id,
        title: item.title,
        url: item.url,
        canonical_url: item.canonical_url || undefined,
        content_hash: item.content_hash || undefined,
        published_at: item.published_at,
        source_type: 'google_news',
        sentiment_score: item.ai_sentiment,
        sentiment_label: item.ai_sentiment_label,
        topics: item.ai_topics || [],
        domain: extractDomain(item.url),
      };
      
      for (const topic of mention.topics) {
        addMention(topic, mention);
      }
    }
    
    // 3. Fetch Bluesky posts with topics
    const { data: blueskyPosts } = await supabase
      .from('bluesky_posts')
      .select('id, text, post_uri, created_at, ai_sentiment, ai_sentiment_label, ai_topics')
      .eq('ai_processed', true)
      .gte('created_at', hours24Ago.toISOString())
      .not('ai_topics', 'is', null)
      .limit(5000); // Limit to avoid massive queries
    
    for (const post of blueskyPosts || []) {
      const mention: SourceMention = {
        id: post.id,
        title: post.text?.substring(0, 200) || '',
        url: post.post_uri,
        published_at: post.created_at,
        source_type: 'bluesky',
        sentiment_score: post.ai_sentiment,
        sentiment_label: post.ai_sentiment_label,
        topics: post.ai_topics || [],
      };
      
      for (const topic of mention.topics) {
        addMention(topic, mention);
      }
    }
    
    console.log(`[detect-trend-events] Aggregated ${topicMap.size} unique topics from sources`);
    
    // ========================================
    // STEP 3: Process topics with deduped counts + rolling baselines
    // ========================================
    const eventsToUpsert: any[] = [];
    const evidenceToInsert: any[] = [];
    let trendingCount = 0;
    let breakingCount = 0;
    let dedupedSavings = 0;
    
    for (const [key, agg] of topicMap) {
      // Use DEDUPED counts for all calculations
      const dedupedMentions = Array.from(agg.dedupedMentions.values());
      const totalMentionsRaw = agg.mentions.length;
      const totalMentionsDeduped = dedupedMentions.length;
      
      dedupedSavings += (totalMentionsRaw - totalMentionsDeduped);
      
      // Skip low-volume topics (using deduped count)
      if (totalMentionsDeduped < 3) continue;
      
      // Calculate window counts using DEDUPED mentions
      const current1h_deduped = dedupedMentions.filter(m => new Date(m.published_at) > hour1Ago).length;
      const current6h_deduped = dedupedMentions.filter(m => new Date(m.published_at) > hours6Ago).length;
      const current24h_deduped = totalMentionsDeduped;
      
      // Get rolling baseline from historical data
      const rolling = rollingBaselines.get(key);
      const hasHistoricalBaseline = rolling && rolling.data_points_7d >= 3;
      
      // Use rolling baseline if available, else use conservative fallback
      const baseline7d = hasHistoricalBaseline 
        ? rolling!.baseline_7d 
        : (current24h_deduped / 24) * 0.5; // Conservative: assume current is 2x normal
      
      const baseline30d = rolling?.baseline_30d || baseline7d;
      
      // Calculate velocity using deduped hourly rate vs baseline
      const currentHourlyRate = current1h_deduped;
      const velocity = baseline7d > 0 
        ? ((currentHourlyRate - baseline7d) / baseline7d) * 100 
        : (currentHourlyRate > 0 ? currentHourlyRate * 50 : 0);
      
      const velocity1h = velocity;
      const rate6h = current6h_deduped / 6;
      const velocity6h = baseline7d > 0 
        ? ((rate6h - baseline7d) / baseline7d) * 100 
        : 0;
      
      // Calculate acceleration
      const acceleration = rate6h > 0 ? ((currentHourlyRate - rate6h) / rate6h) * 100 : 0;
      
      // Source counts using DEDUPED counts
      const newsCount = agg.by_source_deduped.rss + agg.by_source_deduped.google_news;
      const socialCount = agg.by_source_deduped.bluesky;
      const sourceCount = (agg.by_source_deduped.rss > 0 ? 1 : 0) + 
                          (agg.by_source_deduped.google_news > 0 ? 1 : 0) + 
                          (agg.by_source_deduped.bluesky > 0 ? 1 : 0);
      
      // Corroboration score
      const corroborationScore = Math.min(100, sourceCount * 25 + (newsCount > 0 && socialCount > 0 ? 25 : 0));
      
      // Calculate confidence with baseline quality factor
      const baselineQuality = hasHistoricalBaseline ? 1.0 : 0.6; // Penalize if no historical data
      const confidenceFactors = {
        baseline_delta: Math.min(30, Math.max(0, velocity / 10)) * baselineQuality,
        cross_source: Math.min(30, sourceCount * 8 + (newsCount > 0 ? 5 : 0)),
        volume: Math.min(20, current24h_deduped * 2),
        velocity: Math.min(20, Math.max(0, velocity / 10)) * baselineQuality,
      };
      const confidenceScore = Object.values(confidenceFactors).reduce((a, b) => a + b, 0);
      
      // Determine trend stage
      const hoursOld = (now.getTime() - agg.first_seen_at.getTime()) / (1000 * 60 * 60);
      let trendStage = 'stable';
      if (velocity > 100 && acceleration > 50 && hoursOld < 3) {
        trendStage = 'emerging';
      } else if (velocity > 150 && acceleration > 20) {
        trendStage = 'surging';
      } else if (velocity > 100 && acceleration < -20) {
        trendStage = 'peaking';
      } else if (velocity < -20 || (velocity < 50 && acceleration < -30)) {
        trendStage = 'declining';
      } else if (velocity > 30) {
        trendStage = 'surging';
      }
      
      // Determine if trending (using deduped counts)
      // Relaxed: require confidence >= 40, 3+ deduped mentions in 24h, OR 2+ sources
      const isTrending = confidenceScore >= 40 && current24h_deduped >= 3 && (sourceCount >= 2 || current24h_deduped >= 8);
      
      // Determine if breaking (requires cross-source + high velocity + recent + good baseline)
      const baselineDelta = baseline7d > 0 ? (currentHourlyRate - baseline7d) / baseline7d : currentHourlyRate;
      const isBreaking = hasHistoricalBaseline && (
        (velocity > 150 && sourceCount >= 2 && newsCount >= 1 && hoursOld < 6) ||
        (velocity > 300 && newsCount >= 1) ||
        (baselineDelta > 5 && sourceCount >= 2 && hoursOld < 12)
      );
      
      if (isTrending) trendingCount++;
      if (isBreaking) breakingCount++;
      
      // Sentiment
      const avgSentiment = agg.sentiment_count > 0 ? agg.sentiment_sum / agg.sentiment_count : null;
      let sentimentLabel = 'neutral';
      if (avgSentiment !== null) {
        if (avgSentiment > 0.2) sentimentLabel = 'positive';
        else if (avgSentiment < -0.2) sentimentLabel = 'negative';
      }
      
      // Get top headline (prefer news sources, use deduped list)
      const sortedMentions = [...dedupedMentions].sort((a, b) => {
        if (a.source_type !== 'bluesky' && b.source_type === 'bluesky') return -1;
        if (a.source_type === 'bluesky' && b.source_type !== 'bluesky') return 1;
        return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
      });
      const topHeadline = sortedMentions[0]?.title?.substring(0, 200) || '';
      
      // Build event record
      const eventRecord = {
        event_key: key,
        event_title: agg.event_title,
        first_seen_at: agg.first_seen_at.toISOString(),
        last_seen_at: agg.last_seen_at.toISOString(),
        peak_at: trendStage === 'peaking' ? now.toISOString() : null,
        baseline_7d: baseline7d,
        baseline_30d: baseline30d,
        baseline_updated_at: now.toISOString(),
        current_1h: current1h_deduped,
        current_6h: current6h_deduped,
        current_24h: current24h_deduped,
        velocity,
        velocity_1h: velocity1h,
        velocity_6h: velocity6h,
        acceleration,
        confidence_score: Math.round(confidenceScore),
        confidence_factors: {
          ...confidenceFactors,
          baseline_quality: baselineQuality,
          has_historical_baseline: hasHistoricalBaseline,
        },
        is_trending: isTrending,
        is_breaking: isBreaking,
        trend_stage: trendStage,
        source_count: sourceCount,
        news_source_count: (agg.by_source_deduped.rss > 0 ? 1 : 0) + (agg.by_source_deduped.google_news > 0 ? 1 : 0),
        social_source_count: agg.by_source_deduped.bluesky > 0 ? 1 : 0,
        corroboration_score: corroborationScore,
        evidence_count: totalMentionsDeduped,
        top_headline: topHeadline,
        sentiment_score: avgSentiment,
        sentiment_label: sentimentLabel,
        updated_at: now.toISOString(),
      };
      
      eventsToUpsert.push(eventRecord);
      
      // Prepare evidence records (top 10 per topic, from deduped list)
      const topEvidence = sortedMentions.slice(0, 10);
      for (const mention of topEvidence) {
        const domain = mention.domain || extractDomain(mention.url);
        const tierInfo = sourceTiers.get(domain);
        
        evidenceToInsert.push({
          event_key: key,
          source_type: mention.source_type === 'rss' ? 'article' : mention.source_type,
          source_id: mention.id,
          source_url: mention.url,
          source_title: mention.title?.substring(0, 500),
          source_domain: domain,
          published_at: mention.published_at,
          contribution_score: tierInfo?.weight || 1,
          is_primary: mention === sortedMentions[0],
          canonical_url: mention.canonical_url || null,
          content_hash: mention.content_hash || null,
          sentiment_score: mention.sentiment_score,
          sentiment_label: mention.sentiment_label,
        });
      }
    }
    
    console.log(`[detect-trend-events] Processing ${eventsToUpsert.length} topics, ${trendingCount} trending, ${breakingCount} breaking`);
    console.log(`[detect-trend-events] Deduplication removed ${dedupedSavings} duplicate mentions`);
    
    // ========================================
    // STEP 4: Upsert trend events and evidence
    // ========================================
    if (eventsToUpsert.length > 0) {
      const { data: upsertedEvents, error: upsertError } = await supabase
        .from('trend_events')
        .upsert(eventsToUpsert, { onConflict: 'event_key' })
        .select('id, event_key');
      
      if (upsertError) {
        console.error('[detect-trend-events] Error upserting events:', upsertError.message);
      } else {
        console.log(`[detect-trend-events] Upserted ${upsertedEvents?.length || 0} trend events`);
        
        // Build event key to ID map
        const eventIdMap = new Map<string, string>();
        for (const e of upsertedEvents || []) {
          eventIdMap.set(e.event_key, e.id);
        }
        
        // Insert evidence with resolved event IDs
        const resolvedEvidence = evidenceToInsert
          .filter(e => eventIdMap.has(e.event_key))
          .map(e => ({
            event_id: eventIdMap.get(e.event_key),
            source_type: e.source_type,
            source_id: e.source_id,
            source_url: e.source_url,
            source_title: e.source_title,
            source_domain: e.source_domain,
            published_at: e.published_at,
            contribution_score: e.contribution_score,
            is_primary: e.is_primary,
            canonical_url: e.canonical_url,
            content_hash: e.content_hash,
            sentiment_score: e.sentiment_score,
            sentiment_label: e.sentiment_label,
          }));
        
        if (resolvedEvidence.length > 0) {
          // Delete old evidence for these events first
          const eventIds = Array.from(new Set(resolvedEvidence.map(e => e.event_id)));
          await supabase
            .from('trend_evidence')
            .delete()
            .in('event_id', eventIds);
          
          // Insert fresh evidence
          const { error: evidenceError } = await supabase
            .from('trend_evidence')
            .insert(resolvedEvidence);
          
          if (evidenceError) {
            console.error('[detect-trend-events] Error inserting evidence:', evidenceError.message);
          } else {
            console.log(`[detect-trend-events] Inserted ${resolvedEvidence.length} evidence records with canonical_url/content_hash`);
          }
        }
      }
    }
    
    // ========================================
    // STEP 5: Update baselines for today
    // ========================================
    const baselineUpdates = eventsToUpsert.slice(0, 200).map(e => ({
      event_key: e.event_key,
      baseline_date: today,
      mentions_count: e.current_24h,
      hourly_average: e.current_24h / 24,
      news_mentions: (topicMap.get(e.event_key)?.by_source_deduped.rss || 0) + 
                     (topicMap.get(e.event_key)?.by_source_deduped.google_news || 0),
      social_mentions: topicMap.get(e.event_key)?.by_source_deduped.bluesky || 0,
    }));
    
    if (baselineUpdates.length > 0) {
      await supabase
        .from('trend_baselines')
        .upsert(baselineUpdates, { onConflict: 'event_key,baseline_date' });
      
      console.log(`[detect-trend-events] Updated ${baselineUpdates.length} baseline records for ${today}`);
    }
    
    const duration = Date.now() - startTime;
    
    const result = {
      success: true,
      topics_processed: topicMap.size,
      events_upserted: eventsToUpsert.length,
      trending_count: trendingCount,
      breaking_count: breakingCount,
      evidence_count: evidenceToInsert.length,
      deduped_savings: dedupedSavings,
      baselines_loaded: rollingBaselines.size,
      duration_ms: duration,
    };
    
    console.log('[detect-trend-events] Complete:', result);
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error: any) {
    console.error('[detect-trend-events] Error:', error);
    await logJobFailure(supabase, 'detect-trend-events', error.message);
    
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
