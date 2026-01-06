import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateCronOrAdmin, logJobFailure, checkRateLimit } from "../_shared/security.ts";
import { normalizeText, generateHash, extractCanonicalUrl, normalizeUrl, generateContentHash, extractDomain as extractDomainUtil } from "../_shared/urlNormalizer.ts";

/**
 * Evidence-Based Trend Detection v3 with Phrase Clustering
 * 
 * Improvements:
 * 1. Rolling baselines from trend_baselines (7d/30d)
 * 2. Deduplication via content_hash/canonical_url
 * 3. Deduped counts for velocity/confidence
 * 4. Evidence includes canonical_url + content_hash
 * 5. Embedding-based phrase clustering for unified labels
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
  is_event_phrase: boolean; // True if multi-word descriptive phrase
  related_entities: Set<string>; // Single entities that contributed to this phrase
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
  authority_score: number; // For label selection
}

interface RollingBaseline {
  baseline_7d: number;
  baseline_30d: number;
  data_points_7d: number;
  data_points_30d: number;
}

interface ExistingTrendEvent {
  id: string;
  event_key: string;
  event_title: string;
  embedding: number[] | null;
  related_phrases: string[] | null;
  current_24h: number;
}

// Database-loaded entity aliases for canonicalization
let dbAliases: Map<string, { canonical_name: string; entity_type: string }> = new Map();

// Source authority weights for label selection
const SOURCE_AUTHORITY: Record<string, number> = {
  'rss': 3,        // News sources have highest authority
  'google_news': 2.5, // Google News aggregated
  'bluesky': 1,    // Social media lower authority
};

// Similarity threshold for phrase clustering
const EMBEDDING_SIMILARITY_THRESHOLD = 0.82;

// ============================================================================
// QUALITY GATES: Prevent noisy/low-value topics
// ============================================================================

// Blocklist: evergreen/generic terms that should never trend
const TOPIC_BLOCKLIST: Set<string> = new Set([
  // Generic political terms
  'politics', 'political', 'government', 'democracy', 'freedom', 'liberty',
  'america', 'american', 'united states', 'usa', 'congress', 'senate', 'house',
  'republican', 'democrat', 'conservative', 'liberal', 'progressive',
  // Generic news terms
  'breaking', 'news', 'update', 'report', 'latest', 'today', 'new',
  'says', 'said', 'announces', 'announced', 'confirms', 'confirmed',
  // Common filler words
  'people', 'time', 'year', 'years', 'day', 'days', 'week', 'weeks',
  'first', 'last', 'next', 'more', 'most', 'many', 'some', 'other',
  // Generic actions
  'says', 'said', 'claims', 'claims', 'calls', 'called', 'asks', 'asked',
  // Social media noise
  'thread', 'post', 'tweet', 'retweet', 'share', 'like', 'comment',
  // Low-value topics
  'watch', 'video', 'photo', 'image', 'live', 'opinion', 'editorial',
]);

// Quality thresholds
const QUALITY_THRESHOLDS = {
  // Minimum deduped mentions for any topic
  MIN_MENTIONS_DEFAULT: 3,
  // Single-word topics need higher thresholds
  MIN_MENTIONS_SINGLE_WORD: 5,
  MIN_SOURCES_SINGLE_WORD: 2,
  MIN_NEWS_SOURCES_SINGLE_WORD: 1,
  // Source diversity requirements
  MIN_SOURCES_FOR_TRENDING: 2,
  MIN_NEWS_FOR_LOW_SOCIAL: 1,
  // Volume thresholds
  MIN_1H_MENTIONS: 2,
  MIN_24H_MENTIONS: 5,
};

/**
 * Check if a topic passes quality gates
 */
function passesQualityGates(
  topicKey: string,
  topicTitle: string,
  totalMentionsDeduped: number,
  sourceCount: number,
  newsCount: number,
  socialCount: number,
  current1h: number,
  current24h: number
): { passes: boolean; reason?: string } {
  // Check blocklist
  const normalizedKey = topicKey.toLowerCase();
  const normalizedTitle = topicTitle.toLowerCase();
  
  if (TOPIC_BLOCKLIST.has(normalizedKey) || TOPIC_BLOCKLIST.has(normalizedTitle)) {
    return { passes: false, reason: 'blocklisted_term' };
  }
  
  // Check if any word in a multi-word topic is blocklisted (only if ALL words are blocklisted)
  const words = normalizedTitle.split(/\s+/);
  if (words.length > 1 && words.every(w => TOPIC_BLOCKLIST.has(w))) {
    return { passes: false, reason: 'all_words_blocklisted' };
  }
  
  // Single-word topics require higher thresholds
  const isSingleWord = words.length === 1;
  
  if (isSingleWord) {
    // Must meet higher mention threshold
    if (totalMentionsDeduped < QUALITY_THRESHOLDS.MIN_MENTIONS_SINGLE_WORD) {
      return { passes: false, reason: 'single_word_low_volume' };
    }
    // Must have source diversity
    if (sourceCount < QUALITY_THRESHOLDS.MIN_SOURCES_SINGLE_WORD) {
      return { passes: false, reason: 'single_word_low_sources' };
    }
    // Must have at least one news source for credibility
    if (newsCount < QUALITY_THRESHOLDS.MIN_NEWS_SOURCES_SINGLE_WORD) {
      return { passes: false, reason: 'single_word_no_news' };
    }
  } else {
    // Multi-word topics: standard threshold
    if (totalMentionsDeduped < QUALITY_THRESHOLDS.MIN_MENTIONS_DEFAULT) {
      return { passes: false, reason: 'low_volume' };
    }
  }
  
  // Source diversity: require either 2+ sources OR 1+ news source with volume
  const hasSourceDiversity = sourceCount >= QUALITY_THRESHOLDS.MIN_SOURCES_FOR_TRENDING;
  const hasNewsCorroboration = newsCount >= QUALITY_THRESHOLDS.MIN_NEWS_FOR_LOW_SOCIAL && current24h >= QUALITY_THRESHOLDS.MIN_24H_MENTIONS;
  
  if (!hasSourceDiversity && !hasNewsCorroboration) {
    return { passes: false, reason: 'low_source_diversity' };
  }
  
  return { passes: true };
}

// Fallback topic aliases (used when DB is unavailable)
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

/**
 * Load entity aliases from database for canonicalization
 */
async function loadEntityAliases(supabase: any): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('entity_aliases')
      .select('raw_name, canonical_name, entity_type')
      .order('usage_count', { ascending: false })
      .limit(1000);
    
    if (data && !error) {
      dbAliases = new Map();
      for (const alias of data) {
        dbAliases.set(alias.raw_name.toLowerCase(), {
          canonical_name: alias.canonical_name,
          entity_type: alias.entity_type || 'unknown'
        });
      }
      console.log(`[detect-trend-events] Loaded ${dbAliases.size} entity aliases`);
    }
  } catch (e) {
    console.error('Failed to load entity aliases:', e);
  }
}

/**
 * Calculate cosine similarity between two embedding vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude > 0 ? dotProduct / magnitude : 0;
}

/**
 * Check if a topic is an event phrase (multi-word descriptive)
 */
function isEventPhrase(topic: string): boolean {
  const words = topic.trim().split(/\s+/);
  return words.length >= 2 && words.length <= 5;
}

/**
 * Calculate authority score for label selection
 * Prefers: event phrases > entities, high-authority sources, higher frequency
 */
function calculateAuthorityScore(
  agg: TopicAggregate,
  sourceTiers: Map<string, { tier: string; weight: number }>
): number {
  // Base score from mention count
  let score = Math.log2(agg.dedupedMentions.size + 1) * 10;
  
  // Boost for event phrases (more descriptive labels)
  if (agg.is_event_phrase) {
    score += 25;
  }
  
  // Authority from source types
  score += agg.by_source_deduped.rss * SOURCE_AUTHORITY['rss'];
  score += agg.by_source_deduped.google_news * SOURCE_AUTHORITY['google_news'];
  score += agg.by_source_deduped.bluesky * SOURCE_AUTHORITY['bluesky'];
  
  // Domain authority bonus
  for (const mention of agg.dedupedMentions.values()) {
    const tierInfo = sourceTiers.get(mention.domain || '');
    if (tierInfo) {
      score += tierInfo.weight * 2;
    }
  }
  
  return score;
}

function normalizeTopicKey(topic: string): string {
  const lower = topic.toLowerCase().trim();
  
  // Check database aliases first
  if (dbAliases.has(lower)) {
    return dbAliases.get(lower)!.canonical_name.toLowerCase().replace(/\s+/g, '_');
  }
  
  // Check hardcoded aliases
  if (TOPIC_ALIASES[lower]) {
    return TOPIC_ALIASES[lower].toLowerCase().replace(/\s+/g, '_');
  }
  
  return lower.replace(/[^\w\s]/g, '').replace(/\s+/g, '_');
}

function normalizeTopicTitle(topic: string): string {
  const lower = topic.toLowerCase().trim();
  
  // Check database aliases first
  if (dbAliases.has(lower)) {
    return dbAliases.get(lower)!.canonical_name;
  }
  
  // Check hardcoded aliases
  if (TOPIC_ALIASES[lower]) {
    return TOPIC_ALIASES[lower];
  }
  
  // Preserve event phrase formatting
  if (isEventPhrase(topic)) {
    return topic.split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
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

    console.log('[detect-trend-events] Starting evidence-based trend detection v3 (NER + keyphrases + dedupe)...');
    
    // Load entity aliases for canonicalization
    await loadEntityAliases(supabase);
    
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
          is_event_phrase: isEventPhrase(topic),
          related_entities: new Set(),
          mentions: [],
          dedupedMentions: new Map(),
          first_seen_at: new Date(mention.published_at),
          last_seen_at: new Date(mention.published_at),
          by_source: { rss: 0, google_news: 0, bluesky: 0 },
          by_source_deduped: { rss: 0, google_news: 0, bluesky: 0 },
          sentiment_sum: 0,
          sentiment_count: 0,
          authority_score: 0,
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
    
    // 1. Fetch articles with topics (RSS) - includes extracted_topics with event phrases
    const { data: articles } = await supabase
      .from('articles')
      .select('id, title, source_url, canonical_url, content_hash, published_date, sentiment_score, sentiment_label, tags, extracted_topics')
      .gte('published_date', hours24Ago.toISOString())
      .eq('is_duplicate', false);
    
    for (const article of articles || []) {
      // Build topics list from both tags and extracted_topics
      let allTopics: string[] = [];
      
      // Add tags (legacy)
      if (article.tags && Array.isArray(article.tags)) {
        allTopics.push(...article.tags);
      }
      
      // Add extracted_topics with event phrases (new NER output)
      if (article.extracted_topics && Array.isArray(article.extracted_topics)) {
        for (const extracted of article.extracted_topics) {
          if (typeof extracted === 'object' && extracted.topic) {
            allTopics.push(extracted.topic);
          } else if (typeof extracted === 'string') {
            allTopics.push(extracted);
          }
        }
      }
      
      // Skip if no topics
      if (allTopics.length === 0) continue;
      
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
        topics: allTopics,
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
    
    // Calculate authority scores for each topic
    for (const [key, agg] of topicMap) {
      agg.authority_score = calculateAuthorityScore(agg, sourceTiers);
    }
    
    // ========================================
    // STEP 2.5: Load existing trend events with embeddings for clustering
    // ========================================
    const { data: existingEvents } = await supabase
      .from('trend_events')
      .select('id, event_key, event_title, embedding, related_phrases, current_24h')
      .not('embedding', 'is', null)
      .gte('last_seen_at', days7Ago.toISOString())
      .order('current_24h', { ascending: false })
      .limit(500);
    
    const existingEventsMap = new Map<string, ExistingTrendEvent>();
    const embeddingsIndex: { key: string; embedding: number[]; title: string; mentions: number }[] = [];
    
    for (const event of existingEvents || []) {
      existingEventsMap.set(event.event_key, event);
      if (event.embedding) {
        embeddingsIndex.push({
          key: event.event_key,
          embedding: event.embedding,
          title: event.event_title,
          mentions: event.current_24h || 0,
        });
      }
    }
    
    console.log(`[detect-trend-events] Loaded ${embeddingsIndex.length} existing events with embeddings for clustering`);
    
    // ========================================
    // STEP 2.6: Cluster similar phrases using embedding similarity
    // ========================================
    interface PhraseCluster {
      canonicalKey: string;
      canonicalTitle: string;
      memberKeys: Set<string>;
      memberTitles: Set<string>;
      totalMentions: number;
      topAuthorityScore: number;
      isEventPhrase: boolean;
    }
    
    const clusters = new Map<string, PhraseCluster>();
    const keyToCluster = new Map<string, string>(); // event_key -> canonical cluster key
    
    // For new topics without embeddings, use text-based clustering
    function textSimilarity(a: string, b: string): number {
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      
      // Exact match
      if (aLower === bLower) return 1.0;
      
      // One contains the other
      if (aLower.includes(bLower) || bLower.includes(aLower)) return 0.85;
      
      // Word overlap (Jaccard)
      const aWords = new Set(aLower.split(/\s+/).filter(w => w.length > 2));
      const bWords = new Set(bLower.split(/\s+/).filter(w => w.length > 2));
      
      if (aWords.size === 0 || bWords.size === 0) return 0;
      
      let intersection = 0;
      for (const word of aWords) {
        if (bWords.has(word)) intersection++;
      }
      
      const union = aWords.size + bWords.size - intersection;
      return intersection / union;
    }
    
    // First pass: cluster based on embedding similarity from existing events
    for (const [key, agg] of topicMap) {
      if (keyToCluster.has(key)) continue;
      
      // Check existing events for embedding match
      const existing = existingEventsMap.get(key);
      if (existing?.embedding) {
        // Find best matching cluster using embedding
        let bestMatch: { key: string; similarity: number } | null = null;
        
        for (const indexed of embeddingsIndex) {
          if (indexed.key === key) continue;
          
          const similarity = cosineSimilarity(existing.embedding, indexed.embedding);
          if (similarity >= EMBEDDING_SIMILARITY_THRESHOLD) {
            if (!bestMatch || similarity > bestMatch.similarity) {
              bestMatch = { key: indexed.key, similarity };
            }
          }
        }
        
        if (bestMatch && clusters.has(bestMatch.key)) {
          // Join existing cluster
          const cluster = clusters.get(bestMatch.key)!;
          cluster.memberKeys.add(key);
          cluster.memberTitles.add(agg.event_title);
          cluster.totalMentions += agg.dedupedMentions.size;
          
          // Update canonical if this phrase has higher authority
          if (agg.authority_score > cluster.topAuthorityScore) {
            cluster.canonicalKey = key;
            cluster.canonicalTitle = agg.event_title;
            cluster.topAuthorityScore = agg.authority_score;
            cluster.isEventPhrase = agg.is_event_phrase;
          }
          
          keyToCluster.set(key, cluster.canonicalKey);
          continue;
        }
      }
      
      // Create new cluster with this topic as canonical
      const cluster: PhraseCluster = {
        canonicalKey: key,
        canonicalTitle: agg.event_title,
        memberKeys: new Set([key]),
        memberTitles: new Set([agg.event_title]),
        totalMentions: agg.dedupedMentions.size,
        topAuthorityScore: agg.authority_score,
        isEventPhrase: agg.is_event_phrase,
      };
      clusters.set(key, cluster);
      keyToCluster.set(key, key);
    }
    
    // Second pass: text-based clustering for topics without embeddings
    const unclusteredKeys = Array.from(topicMap.keys()).filter(k => !keyToCluster.has(k));
    
    for (const key of unclusteredKeys) {
      const agg = topicMap.get(key)!;
      let bestMatch: { clusterKey: string; similarity: number } | null = null;
      
      for (const [clusterKey, cluster] of clusters) {
        const similarity = textSimilarity(agg.event_title, cluster.canonicalTitle);
        if (similarity >= 0.7) { // Lower threshold for text-based
          if (!bestMatch || similarity > bestMatch.similarity) {
            bestMatch = { clusterKey, similarity };
          }
        }
      }
      
      if (bestMatch) {
        const cluster = clusters.get(bestMatch.clusterKey)!;
        cluster.memberKeys.add(key);
        cluster.memberTitles.add(agg.event_title);
        cluster.totalMentions += agg.dedupedMentions.size;
        
        // Update canonical if higher authority
        if (agg.authority_score > cluster.topAuthorityScore) {
          cluster.canonicalKey = key;
          cluster.canonicalTitle = agg.event_title;
          cluster.topAuthorityScore = agg.authority_score;
          cluster.isEventPhrase = agg.is_event_phrase;
        }
        
        keyToCluster.set(key, cluster.canonicalKey);
      } else {
        // Create standalone cluster
        const cluster: PhraseCluster = {
          canonicalKey: key,
          canonicalTitle: agg.event_title,
          memberKeys: new Set([key]),
          memberTitles: new Set([agg.event_title]),
          totalMentions: agg.dedupedMentions.size,
          topAuthorityScore: agg.authority_score,
          isEventPhrase: agg.is_event_phrase,
        };
        clusters.set(key, cluster);
        keyToCluster.set(key, key);
      }
    }
    
    console.log(`[detect-trend-events] Created ${clusters.size} phrase clusters from ${topicMap.size} topics`);
    
    // ========================================
    // STEP 3: Process topics with deduped counts + rolling baselines
    // ========================================
    const eventsToUpsert: any[] = [];
    const evidenceToInsert: any[] = [];
    const clustersToUpsert: any[] = [];
    let trendingCount = 0;
    let breakingCount = 0;
    let dedupedSavings = 0;
    
    let qualityGateFiltered = 0;
    
    for (const [key, agg] of topicMap) {
      // Use DEDUPED counts for all calculations
      const dedupedMentions = Array.from(agg.dedupedMentions.values());
      const totalMentionsRaw = agg.mentions.length;
      const totalMentionsDeduped = dedupedMentions.length;
      
      dedupedSavings += (totalMentionsRaw - totalMentionsDeduped);
      
      // Calculate window counts using DEDUPED mentions
      const current1h_deduped = dedupedMentions.filter(m => new Date(m.published_at) > hour1Ago).length;
      const current6h_deduped = dedupedMentions.filter(m => new Date(m.published_at) > hours6Ago).length;
      const current24h_deduped = totalMentionsDeduped;
      
      // Source counts using DEDUPED counts
      const newsCount = agg.by_source_deduped.rss + agg.by_source_deduped.google_news;
      const socialCount = agg.by_source_deduped.bluesky;
      const sourceCount = (agg.by_source_deduped.rss > 0 ? 1 : 0) + 
                          (agg.by_source_deduped.google_news > 0 ? 1 : 0) + 
                          (agg.by_source_deduped.bluesky > 0 ? 1 : 0);
      
      // ========================================
      // QUALITY GATES: Filter low-quality topics
      // ========================================
      const qualityResult = passesQualityGates(
        key,
        agg.event_title,
        totalMentionsDeduped,
        sourceCount,
        newsCount,
        socialCount,
        current1h_deduped,
        current24h_deduped
      );
      
      if (!qualityResult.passes) {
        qualityGateFiltered++;
        console.log(`[detect-trend-events] Quality gate filtered: "${agg.event_title}" (${qualityResult.reason})`);
        continue;
      }
      
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
      
      // Corroboration score
      const corroborationScore = Math.min(100, sourceCount * 25 + (newsCount > 0 && socialCount > 0 ? 25 : 0));
      
      // Calculate baseline delta for ranking
      const baselineDelta = baseline7d > 0 ? (currentHourlyRate - baseline7d) / baseline7d : currentHourlyRate;
      const baselineDeltaPct = baselineDelta * 100;
      
      // ========================================
      // TWITTER-LIKE RANKING: Velocity vs Baseline (z-score approach)
      // Primary: spike velocity relative to baseline
      // Secondary: corroboration + volume gate
      // ========================================
      
      // Baseline quality factor
      const baselineQuality = hasHistoricalBaseline ? 1.0 : 0.6;
      
      // Calculate z-score for velocity (how many standard deviations above normal)
      // Using simplified z-score: (current - baseline) / max(baseline, 1)
      // Capped to avoid extreme outliers dominating
      const zScoreVelocity = Math.min(10, Math.max(-2, 
        baseline7d > 0.5 
          ? (currentHourlyRate - baseline7d) / Math.max(baseline7d, 0.5)
          : Math.min(currentHourlyRate * 0.5, 5) // New topics get modest score
      ));
      
      // Volume gate: minimum thresholds to prevent low-volume spikes
      // Require either:
      // - 2+ mentions in 1h (recent activity), OR
      // - 5+ mentions in 24h (sustained interest), OR
      // - 2+ sources (corroboration)
      const meetsVolumeGate = current1h_deduped >= 2 || current24h_deduped >= 5 || sourceCount >= 2;
      
      // TREND_SCORE: Primary ranking metric (Twitter-like)
      // Components:
      // 1. Z-score velocity (0-100): How much above baseline (primary factor)
      // 2. Corroboration boost (0-30): Cross-source verification
      // 3. Volume bonus (0-20): Raw activity level (secondary)
      const velocityScore = zScoreVelocity * 10 * baselineQuality; // 0-100
      const corroborationBoost = sourceCount >= 2 
        ? 15 + (newsCount > 0 && socialCount > 0 ? 15 : 0) // 15-30 for cross-source
        : 0;
      const volumeBonus = Math.min(20, Math.log2(current24h_deduped + 1) * 5);
      
      // Apply volume gate: no score if below minimum thresholds
      const trendScore = meetsVolumeGate 
        ? Math.max(0, velocityScore + corroborationBoost + volumeBonus)
        : 0;
      
      // Keep confidence score for reference (but not primary ranking)
      // FIXED: Confidence score should be 0-100, with capped components
      const confidenceFactors = {
        baseline_delta: Math.min(25, Math.max(0, baselineDelta * 5)) * baselineQuality, // 0-25: spike vs baseline
        cross_source: Math.min(25, sourceCount * 8 + (newsCount > 0 && socialCount > 0 ? 5 : 0)), // 0-25: source diversity
        volume: Math.min(25, Math.log2(current24h_deduped + 1) * 5), // 0-25: volume (log scaled)
        recency: Math.min(25, current1h_deduped > 0 ? 15 + Math.min(10, current1h_deduped * 2) : 0), // 0-25: recent activity
      };
      // Sum only the scoring components (all capped to ensure max 100)
      const confidenceScore = Math.min(100, 
        confidenceFactors.baseline_delta + 
        confidenceFactors.cross_source + 
        confidenceFactors.volume + 
        confidenceFactors.recency
      );
      
      // Determine trend stage
      const hoursOld = (now.getTime() - agg.first_seen_at.getTime()) / (1000 * 60 * 60);
      let trendStage = 'stable';
      if (zScoreVelocity > 3 && acceleration > 50 && hoursOld < 3) {
        trendStage = 'emerging';
      } else if (zScoreVelocity > 2 && acceleration > 20) {
        trendStage = 'surging';
      } else if (zScoreVelocity > 1.5 && acceleration < -20) {
        trendStage = 'peaking';
      } else if (zScoreVelocity < 0 || (zScoreVelocity < 0.5 && acceleration < -30)) {
        trendStage = 'declining';
      } else if (zScoreVelocity > 0.5) {
        trendStage = 'surging';
      }
      
      // Determine if trending: use trend_score threshold + volume gate
      const isTrending = trendScore >= 20 && meetsVolumeGate;
      
      // Determine if breaking: high velocity spike + corroboration + recency
      const isBreaking = hasHistoricalBaseline && meetsVolumeGate && (
        (zScoreVelocity > 4 && sourceCount >= 2 && newsCount >= 1 && hoursOld < 6) ||
        (zScoreVelocity > 6 && newsCount >= 1) ||
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
      
      // Get cluster info for this topic
      const clusterKey = keyToCluster.get(key) || key;
      const cluster = clusters.get(clusterKey);
      
      // Build related phrases from cluster (excluding self)
      const relatedPhrases = cluster 
        ? Array.from(cluster.memberTitles).filter(t => t !== agg.event_title).slice(0, 10)
        : [];
      
      // Determine canonical label from cluster
      const canonicalLabel = cluster?.canonicalTitle || agg.event_title;
      
      // Build event record with clustering info + velocity-based ranking
      const eventRecord = {
        event_key: key,
        event_title: agg.event_title,
        canonical_label: canonicalLabel, // Best label for display
        is_event_phrase: agg.is_event_phrase,
        related_phrases: relatedPhrases, // Alternate phrasings from cluster
        cluster_id: cluster && cluster.memberKeys.size > 1 ? clusterKey : null,
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
        // NEW: Velocity-based ranking fields
        trend_score: Math.round(trendScore * 10) / 10, // Primary ranking metric
        z_score_velocity: Math.round(zScoreVelocity * 100) / 100, // For explainability
        confidence_score: Math.round(confidenceScore),
        confidence_factors: {
          ...confidenceFactors,
          baseline_quality: baselineQuality,
          baseline_delta_pct: Math.round(baselineDeltaPct * 10) / 10,
          has_historical_baseline: hasHistoricalBaseline,
          meets_volume_gate: meetsVolumeGate,
          is_event_phrase: agg.is_event_phrase,
          related_entities_count: agg.related_entities.size,
          cluster_size: cluster?.memberKeys.size || 1,
          authority_score: agg.authority_score,
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
    console.log(`[detect-trend-events] Quality gates filtered ${qualityGateFiltered} low-quality topics`);
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
    // STEP 4.5: Upsert phrase clusters
    // ========================================
    const multiMemberClusters = Array.from(clusters.values()).filter(c => c.memberKeys.size > 1);
    
    if (multiMemberClusters.length > 0) {
      const clusterRecords = multiMemberClusters.map(c => ({
        canonical_phrase: c.canonicalTitle,
        member_phrases: Array.from(c.memberTitles),
        member_event_keys: Array.from(c.memberKeys),
        similarity_threshold: EMBEDDING_SIMILARITY_THRESHOLD,
        total_mentions: c.totalMentions,
        top_authority_score: c.topAuthorityScore,
        updated_at: now.toISOString(),
      }));
      
      const { error: clusterError } = await supabase
        .from('trend_phrase_clusters')
        .upsert(clusterRecords, { onConflict: 'canonical_phrase' });
      
      if (clusterError) {
        console.error('[detect-trend-events] Error upserting clusters:', clusterError.message);
      } else {
        console.log(`[detect-trend-events] Upserted ${clusterRecords.length} phrase clusters`);
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
      quality_gate_filtered: qualityGateFiltered,
      evidence_count: evidenceToInsert.length,
      clusters_created: multiMemberClusters.length,
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
