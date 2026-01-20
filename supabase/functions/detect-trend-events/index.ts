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
  tier?: 'tier1' | 'tier2' | 'tier3' | null; // Source tier for weighting
}

interface TopicAggregate {
  event_key: string;
  event_title: string;
  is_event_phrase: boolean; // True if multi-word descriptive phrase
  label_quality_hint: 'event_phrase' | 'fallback_generated' | 'entity_only' | null; // FIX: From extracted_topics metadata
  related_entities: Set<string>; // Single entities that contributed to this phrase
  co_occurrences: Map<string, number>; // Co-occurring topics for context bundles
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
  // Tier distribution (deduped)
  by_tier_deduped: {
    tier1: number;
    tier2: number;
    tier3: number;
  };
  sentiment_sum: number;
  sentiment_count: number;
  authority_score: number; // For label selection
}

interface RollingBaseline {
  baseline_7d: number;
  baseline_30d: number;
  stddev_7d: number;
  stddev_30d: number;
  rsd_7d: number;
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

// ============================================================================
// TIER & SOURCE TYPE WEIGHTING for Phase 2
// ============================================================================

// Tier weights: tier1 is most authoritative, tier3 is least
const TIER_WEIGHTS: Record<string, number> = {
  'tier1': 1.0,    // Official/government + high-trust
  'tier2': 0.7,    // National news + statehouse network
  'tier3': 0.4,    // Issue specialists + advocacy
  'unclassified': 0.5, // Unknown tier gets middle weight
};

// Source type weights
const SOURCE_TYPE_WEIGHTS: Record<string, number> = {
  'rss': 1.0,         // Direct RSS feeds (highest trust)
  'google_news': 0.8, // Aggregated news
  'bluesky': 0.3,     // Social media (lowest trust)
};

// Cross-tier corroboration requirement: tier3-only trends are demoted
const REQUIRE_TIER12_CORROBORATION = true;

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
  // PHASE 3 FIX: Ambiguous single-word abbreviations and common words
  'us', 'uk', 'eu', 'un', 'mlk', 'ice',  // Too ambiguous without context
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
  'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
]);

// ============================================================================
// PHASE 3: EVERGREEN DETECTION for suppression
// Topics that are "always on" should be ranked lower unless spiking
// ============================================================================
const EVERGREEN_ENTITIES: Set<string> = new Set([
  // Political figures always in news
  'trump', 'biden', 'harris', 'obama', 'pelosi', 'mcconnell', 'schumer',
  'musk', 'putin', 'netanyahu', 'zelensky', 'xi jinping', 'vance', 'walz',
  // Government bodies
  'white house', 'pentagon', 'state department', 'justice department',
  'congress', 'senate', 'house', 'supreme court', 'capitol',
  // Geopolitical hotspots (always in news)
  'gaza', 'israel', 'ukraine', 'russia', 'china', 'taiwan', 'iran',
  'greenland', 'nato', 'eu', 'european union', 'middle east', 'west bank',
  // Recurring topics
  'immigration', 'border', 'economy', 'inflation', 'healthcare', 'climate',
  'taxes', 'election', 'campaign', 'poll', 'polls', 'voter', 'voting',
  'tariffs', 'trade', 'democracy', 'freedom', 'abortion', 'gun', 'guns',
]);

// Evergreen detection: check if topic is typically always-on
function isEvergreenTopic(topicKey: string, baseline7d: number, baseline30d: number): boolean {
  const normalizedKey = topicKey.toLowerCase();
  
  // Check explicit evergreen list
  if (EVERGREEN_ENTITIES.has(normalizedKey)) return true;
  
  // PHASE A: Single-word topics that match common geo/political patterns are pseudo-evergreen
  const isSingleWord = normalizedKey.split(/\s+/).length === 1;
  
  // Heuristic: if 30d baseline is high and relatively stable, it's evergreen
  // A topic with consistent high volume (baseline30d > 2/hour) is likely evergreen
  if (baseline30d >= 2 && baseline7d >= 1.5) {
    // Check stability: if 7d and 30d are similar, it's steady/evergreen
    const stabilityRatio = Math.abs(baseline7d - baseline30d) / Math.max(baseline30d, 0.1);
    if (stabilityRatio < 0.3) return true; // Less than 30% variance = stable/evergreen
  }
  
  // PHASE A: Lower threshold for single-word entities (more aggressive evergreen detection)
  if (isSingleWord && baseline30d >= 1 && baseline7d >= 0.8) {
    const stabilityRatio = Math.abs(baseline7d - baseline30d) / Math.max(baseline30d, 0.1);
    if (stabilityRatio < 0.5) return true; // 50% variance tolerance for single-word
  }
  
  return false;
}

// Calculate evergreen penalty (0.05-1.0): lower for evergreen unless spiking
// PHASE 3 FIX: DRASTICALLY strengthened single-word penalty to nearly eliminate them
function calculateEvergreenPenalty(
  isEvergreen: boolean,
  zScoreVelocity: number,
  hasHistoricalBaseline: boolean,
  isSingleWordEntity: boolean = false
): number {
  // PHASE 3 FIX: Single-word entities get SEVERE penalty - they should rarely trend
  // Goal: Force conversion to event phrases like "Trump Announces X" instead of just "Trump"
  const baseEntityPenalty = isSingleWordEntity ? 0.15 : 1.0;  // Was 0.6, now 0.15

  if (!isEvergreen) return baseEntityPenalty;

  // PHASE 3 FIX: Even higher z-score required for evergreen topics
  if (zScoreVelocity > 8) return 0.80 * baseEntityPenalty;  // Extreme spike (was 6)
  if (zScoreVelocity > 6) return 0.55 * baseEntityPenalty;  // Very strong spike (was 5)
  if (zScoreVelocity > 5) return 0.35 * baseEntityPenalty;  // Strong spike (was 4)
  if (zScoreVelocity > 4) return 0.20 * baseEntityPenalty;  // Moderate spike (was 3)

  // Evergreen with no significant spike gets EXTREME penalty
  return hasHistoricalBaseline ? 0.05 * baseEntityPenalty : 0.08 * baseEntityPenalty;
}

// ============================================================================
// PHASE 3: RECENCY DECAY - Fresh spikes rank higher
// Decay factor based on hours since last seen (0.3-1.0)
// ============================================================================
function calculateRecencyDecay(lastSeenAt: Date, now: Date): number {
  const hoursSinceLastSeen = (now.getTime() - lastSeenAt.getTime()) / (1000 * 60 * 60);
  
  // Full score for topics seen in last 2 hours
  if (hoursSinceLastSeen <= 2) return 1.0;
  
  // Gradual decay from 2-12 hours
  if (hoursSinceLastSeen <= 12) {
    return 1.0 - ((hoursSinceLastSeen - 2) / 10) * 0.5; // 1.0 -> 0.5 over 10 hours
  }
  
  // Steeper decay after 12 hours
  if (hoursSinceLastSeen <= 24) {
    return 0.5 - ((hoursSinceLastSeen - 12) / 12) * 0.2; // 0.5 -> 0.3 over 12 hours
  }
  
  // Minimum decay for very stale topics
  return 0.3;
}

// ============================================================================
// PHASE 3: RANK SCORE CALCULATION - Twitter-like trending formula
// Primary: z-score velocity (burst above baseline)
// Secondary: corroboration (cross-source verification)  
// Modifiers: recency decay, evergreen penalty
// ============================================================================
function calculateRankScore(params: {
  zScoreVelocity: number;
  corroborationScore: number;
  sourceCount: number;
  hasTier12Corroboration: boolean;
  newsCount: number;
  socialCount: number;
  recencyDecay: number;
  evergreenPenalty: number;
  baselineQuality: number;
  current1h: number;
  current24h: number;
  labelQuality: 'event_phrase' | 'entity_only' | 'fallback_generated';
  hasContext: boolean;
}): number {
  const {
    zScoreVelocity,
    corroborationScore,
    sourceCount,
    hasTier12Corroboration,
    newsCount,
    socialCount,
    recencyDecay,
    evergreenPenalty,
    baselineQuality,
    current1h,
    current24h,
    labelQuality,
    hasContext,
  } = params;
  
  // Component 1: Velocity Score (0-50) - PRIMARY FACTOR
  // z-score measures how many standard deviations above baseline
  // Capped at 10 to prevent extreme outliers from dominating
  const velocityComponent = Math.min(50, Math.max(0, zScoreVelocity * 5)) * baselineQuality;
  
  // Component 2: Corroboration Boost (0-30)
  // Cross-source verification is critical for credibility
  let corroborationComponent = 0;
  if (sourceCount >= 3) {
    corroborationComponent = 25; // Multi-platform coverage
  } else if (sourceCount >= 2) {
    corroborationComponent = 15; // Two platforms
  }
  // Bonus for news+social combo (validates social buzz with journalism)
  if (newsCount > 0 && socialCount > 0) {
    corroborationComponent += 10;
  }
  // Bonus for tier1/tier2 sources (authoritative corroboration)
  if (hasTier12Corroboration) {
    corroborationComponent += 5;
  }
  corroborationComponent = Math.min(30, corroborationComponent);
  
  // Component 3: Activity Level (0-20) - SECONDARY
  // Logarithmic scaling to prevent volume from dominating
  const activityComponent = Math.min(20, 
    Math.log2(current1h + 1) * 4 + Math.log2(current24h + 1) * 2
  );
  
  // PHASE A: Label quality modifier
  // Event phrases get full score, entity-only gets penalized unless high corroboration
  let labelQualityModifier = 1.0;
  if (labelQuality === 'entity_only') {
    // Heavy penalty for entity-only labels - reduces score by 40-60%
    labelQualityModifier = hasTier12Corroboration ? 0.6 : 0.4;
  } else if (labelQuality === 'fallback_generated') {
    // Slight penalty for fallback-generated labels
    labelQualityModifier = 0.85;
  }

  // Additional penalty for entity-only labels with no context bundles
  const contextPenalty = labelQuality === 'entity_only' && !hasContext ? 0.35 : 1.0;
  
  // Calculate raw rank score
  const rawScore = velocityComponent + corroborationComponent + activityComponent;
  
  // Apply modifiers: recency decay, evergreen penalty, AND label quality
  const finalScore = rawScore * recencyDecay * evergreenPenalty * labelQualityModifier * contextPenalty;
  
  return Math.round(finalScore * 10) / 10;
}

// Quality thresholds - PHASE 3 FIX: Drastically strengthened single-word suppression
const QUALITY_THRESHOLDS = {
  // Minimum deduped mentions for any topic
  MIN_MENTIONS_DEFAULT: 3,
  // PHASE 3 FIX: Single-word topics need EXTREME thresholds to pass
  // Most single-word entities should NOT trend - they need to be converted to event phrases
  MIN_MENTIONS_SINGLE_WORD: 20,       // INCREASED from 8 - very high bar
  MIN_SOURCES_SINGLE_WORD: 3,         // INCREASED from 2 - need broad corroboration
  MIN_NEWS_SOURCES_SINGLE_WORD: 3,    // INCREASED from 2 - strong news requirement
  MIN_TIER12_SOURCES_SINGLE_WORD: 2,  // INCREASED from 1 - need multiple authoritative sources
  // Source diversity requirements
  MIN_SOURCES_FOR_TRENDING: 2,
  MIN_NEWS_FOR_LOW_SOCIAL: 1,
  // Volume thresholds
  MIN_1H_MENTIONS: 2,
  MIN_24H_MENTIONS: 5,
};

// PHASE 3 FIX: DRASTICALLY reduced allowed list - only unambiguous acronyms that have NO other meaning
// Removed: ice (frozen water), trump/biden/musk (should be event phrases), gaza/ukraine/etc (need context)
// Single-word person names and geographic locations should NEVER trend alone
const ALLOWED_SINGLE_WORD_ENTITIES = new Set([
  // Only keep US government acronyms that are completely unambiguous
  'nato', 'fbi', 'cia', 'doj', 'dhs', 'epa', 'fda', 'cdc',
  'nsa', 'irs', 'sec', 'ftc', 'fcc', 'fec', 'osha',
  'scotus', 'potus',
  // Terrorist organizations (no other meaning)
  'hamas', 'hezbollah', 'isis',
]);

/**
 * Check if a topic passes quality gates
 * PHASE 2: Strengthened single-word suppression with explainability
 */
function passesQualityGates(
  topicKey: string,
  topicTitle: string,
  totalMentionsDeduped: number,
  sourceCount: number,
  newsCount: number,
  socialCount: number,
  current1h: number,
  current24h: number,
  tier1Count: number = 0,
  tier2Count: number = 0
): { passes: boolean; reason?: string; singleWordExplain?: string } {
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
  
  // PHASE 2: Single-word topics require MUCH higher thresholds + tier corroboration
  const isSingleWord = words.length === 1;
  
  if (isSingleWord) {
    const isAllowedEntity = ALLOWED_SINGLE_WORD_ENTITIES.has(normalizedKey);
    const hasTier12 = tier1Count > 0 || tier2Count > 0;
    
    // Build explainability string
    const explains: string[] = [];
    
    // Must meet higher mention threshold
    if (totalMentionsDeduped < QUALITY_THRESHOLDS.MIN_MENTIONS_SINGLE_WORD) {
      return { 
        passes: false, 
        reason: 'single_word_low_volume',
        singleWordExplain: `Needs ${QUALITY_THRESHOLDS.MIN_MENTIONS_SINGLE_WORD}+ mentions (has ${totalMentionsDeduped})`
      };
    }
    explains.push(`${totalMentionsDeduped} mentions`);
    
    // Must have source diversity
    if (sourceCount < QUALITY_THRESHOLDS.MIN_SOURCES_SINGLE_WORD) {
      return { 
        passes: false, 
        reason: 'single_word_low_sources',
        singleWordExplain: `Needs ${QUALITY_THRESHOLDS.MIN_SOURCES_SINGLE_WORD}+ source types (has ${sourceCount})`
      };
    }
    explains.push(`${sourceCount} source types`);
    
    // Must have at least one news source for credibility
    if (newsCount < QUALITY_THRESHOLDS.MIN_NEWS_SOURCES_SINGLE_WORD) {
      return { 
        passes: false, 
        reason: 'single_word_low_news',
        singleWordExplain: `Needs ${QUALITY_THRESHOLDS.MIN_NEWS_SOURCES_SINGLE_WORD}+ news sources (has ${newsCount})`
      };
    }
    explains.push(`${newsCount} news sources`);
    
    // PHASE 2: Must have tier1/tier2 corroboration OR be a known entity
    if (!hasTier12 && !isAllowedEntity) {
      return { 
        passes: false, 
        reason: 'single_word_no_tier12',
        singleWordExplain: `Single-word "${topicTitle}" needs tier1/tier2 source or be well-known acronym`
      };
    }
    
    if (isAllowedEntity) explains.push('known entity');
    if (hasTier12) explains.push(`tier1/2: ${tier1Count + tier2Count}`);
    
    // Single-word passed all gates - log why
    console.log(`[detect-trend-events] Single-word PASSED: "${topicTitle}" (${explains.join(', ')})`);
    
    return { passes: true, singleWordExplain: explains.join(', ') };
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

// Comprehensive action verbs list for verb-centered validation
const VERB_DETECTION_LIST = [
  // Legislative actions
  'vote', 'votes', 'voted', 'voting', 'pass', 'passes', 'passed', 'passing',
  'block', 'blocks', 'blocked', 'blocking', 'reject', 'rejects', 'rejected',
  'approve', 'approves', 'approved', 'sign', 'signs', 'signed', 'signing',
  'veto', 'vetoes', 'vetoed', 'filibuster', 'filibusters', 'filibustered',
  // Executive actions
  'fire', 'fires', 'fired', 'firing', 'resign', 'resigns', 'resigned',
  'nominate', 'nominates', 'nominated', 'appoint', 'appoints', 'appointed',
  'order', 'orders', 'ordered', 'ordering', 'pardon', 'pardons', 'pardoned',
  'commute', 'commutes', 'commuted', 'revoke', 'revokes', 'revoked',
  // Judicial actions
  'rule', 'rules', 'ruled', 'ruling', 'overturn', 'overturns', 'overturned',
  'uphold', 'upholds', 'upheld', 'strike', 'strikes', 'struck', 'striking',
  'dismiss', 'dismisses', 'dismissed', 'grant', 'grants', 'granted',
  'deny', 'denies', 'denied', 'affirm', 'affirms', 'affirmed',
  // Law enforcement
  'arrest', 'arrests', 'arrested', 'arresting', 'indict', 'indicts', 'indicted',
  'sue', 'sues', 'sued', 'suing', 'charge', 'charges', 'charged', 'charging',
  'convict', 'convicts', 'convicted', 'acquit', 'acquits', 'acquitted',
  'sentence', 'sentences', 'sentenced', 'raid', 'raids', 'raided',
  'seize', 'seizes', 'seized', 'deport', 'deports', 'deported',
  'detain', 'detains', 'detained',
  // Policy/diplomacy
  'announce', 'announces', 'announced', 'announcing', 'launch', 'launches', 'launched',
  'ban', 'bans', 'banned', 'banning', 'sanction', 'sanctions', 'sanctioned',
  'threaten', 'threatens', 'threatened', 'warn', 'warns', 'warned',
  'demand', 'demands', 'demanded', 'propose', 'proposes', 'proposed',
  'withdraw', 'withdraws', 'withdrew', 'withdrawn', 'suspend', 'suspends', 'suspended',
  'expand', 'expands', 'expanded', 'cut', 'cuts', 'cutting',
  // Conflict/crisis
  'attack', 'attacks', 'attacked', 'attacking', 'invade', 'invades', 'invaded',
  'bomb', 'bombs', 'bombed', 'bombing', 'collapse', 'collapses', 'collapsed',
  'halt', 'halts', 'halted', 'halting', 'escalate', 'escalates', 'escalated',
  'cease', 'ceases', 'ceased', 'freeze', 'freezes', 'froze', 'frozen',
  // Economic
  'raise', 'raises', 'raised', 'raising', 'lower', 'lowers', 'lowered',
  'surge', 'surges', 'surged', 'drop', 'drops', 'dropped',
  // General action verbs
  'face', 'faces', 'faced', 'facing', 'win', 'wins', 'won', 'winning',
  'lose', 'loses', 'lost', 'losing', 'defeat', 'defeats', 'defeated',
  'confirm', 'confirms', 'confirmed', 'confirming', 'release', 'releases', 'released',
  'reveal', 'reveals', 'revealed', 'expose', 'exposes', 'exposed',
  'target', 'targets', 'targeted', 'targeting', 'kill', 'kills', 'killed',
  'end', 'ends', 'ended', 'ending', 'begin', 'begins', 'began', 'beginning',
  'start', 'starts', 'started', 'starting', 'stop', 'stops', 'stopped',
];

// Event nouns that indicate something happened
const EVENT_NOUN_LIST = [
  'ruling', 'trial', 'hearing', 'verdict', 'indictment', 'conviction', 'acquittal',
  'lawsuit', 'injunction', 'subpoena', 'testimony', 'deposition', 'sentencing',
  'vote', 'bill', 'election', 'impeachment', 'nomination', 'confirmation', 'veto',
  'filibuster', 'shutdown', 'debate', 'speech', 'summit', 'rally', 'resignation',
  'shooting', 'protest', 'crisis', 'scandal', 'attack', 'bombing', 'strike', 'raid',
  'ceasefire', 'invasion', 'collapse', 'evacuation', 'explosion', 'assassination',
  'sanctions', 'tariffs', 'investigation', 'probe', 'audit', 'deportation',
  'pardon', 'ban', 'order', 'mandate', 'regulation', 'reform',
];

// Known entity-only patterns that should NOT be event phrases
const ENTITY_ONLY_PATTERNS = [
  /^[A-Z][a-z]*$/,                                     // Single capitalized word
  /^[A-Z][a-z]+\s+[A-Z][a-z]+$/,                      // Two capitalized words (likely person name)
  /^(?:President|Senator|Rep\.?|Governor|Mayor|Secretary|Director|Chief|Justice)\s+[A-Z][a-z]+$/i,
  /^[A-Z]{2,5}$/,                                      // Single acronym
  /^The\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?$/,           // The + Organization
];

/**
 * Check if phrase contains at least one action verb or event noun
 * Returns true only if a verb/event-noun is found
 */
function containsVerbOrEventNoun(topic: string): boolean {
  const lower = topic.toLowerCase();
  const words = lower.split(/\s+/);
  
  for (const verb of VERB_DETECTION_LIST) {
    if (words.includes(verb)) return true;
  }
  for (const noun of EVENT_NOUN_LIST) {
    if (words.includes(noun)) return true;
  }
  return false;
}

/**
 * Check if phrase matches entity-only patterns
 */
function matchesEntityOnlyPattern(topic: string): boolean {
  for (const pattern of ENTITY_ONLY_PATTERNS) {
    if (pattern.test(topic.trim())) return true;
  }
  return false;
}

/**
 * Check if a topic is a TRUE event phrase:
 * - Multi-word (2-6 words); allow 2-word phrases when verb/event noun is present (e.g., "ICE raid")
 * - Contains at least one verb or event noun
 * - Does NOT match entity-only patterns unless verb/event noun exists
 * Fix: Verb-required heuristic to prevent entity names from being classified as events
 */
function isEventPhrase(topic: string): boolean {
  const words = topic.trim().split(/\s+/);
  
  // Require 2-6 words
  if (words.length < 2 || words.length > 6) return false;
  
  // REQUIRE: Must contain verb or event noun
  const hasVerbOrEvent = containsVerbOrEventNoun(topic);
  if (!hasVerbOrEvent) return false;
  
  // Reject entity-only patterns unless a verb/event noun is present
  if (matchesEntityOnlyPattern(topic) && !hasVerbOrEvent) return false;
  
  return true;
}

/**
 * Validate and potentially downgrade is_event_phrase labels
 * Returns the corrected label_quality
 * 
 * CRITICAL FIX: Now properly handles:
 * - fallback_generated hints from batch-analyze
 * - event_phrase hints from both old and new format
 * - Generates fallback labels for high-volume entity-only topics
 */
function validateEventPhraseLabel(
  topic: string, 
  claimedIsEventPhrase: boolean,
  labelQualityHint?: 'event_phrase' | 'fallback_generated' | 'entity_only' | null,
  topHeadline?: string // NEW: For fallback generation
): { is_event_phrase: boolean; label_quality: 'event_phrase' | 'entity_only' | 'fallback_generated'; downgraded: boolean; label_source: string; fallbackLabel?: string } {
  
  // FIX: If we have metadata hint of fallback_generated, check if this topic was the actual fallback phrase
  // or just an entity from an article where a fallback was generated
  if (labelQualityHint === 'fallback_generated') {
    // Only validate as fallback if the topic was CLAIMED as an event phrase
    // Entities from fallback-generated articles should not be treated as fallback attempts
    if (claimedIsEventPhrase) {
      const passesVerbCheck = isEventPhrase(topic);
      if (passesVerbCheck) {
        return { is_event_phrase: true, label_quality: 'fallback_generated', downgraded: false, label_source: 'fallback_generated' };
      }
      // Claimed fallback phrase but doesn't pass verb check - downgrade
      return { is_event_phrase: false, label_quality: 'entity_only', downgraded: true, label_source: 'fallback_downgraded' };
    }
    // Entity from a fallback-generated article - treat as entity_only
    return { is_event_phrase: false, label_quality: 'entity_only', downgraded: false, label_source: 'entity_from_fallback' };
  }
  
  // FIX: If metadata says event_phrase, validate it
  if (labelQualityHint === 'event_phrase') {
    const passesVerbCheck = isEventPhrase(topic);
    if (passesVerbCheck) {
      return { is_event_phrase: true, label_quality: 'event_phrase', downgraded: false, label_source: 'metadata_event_phrase' };
    }
    // Claimed event_phrase but doesn't pass validation - downgrade
    return { is_event_phrase: false, label_quality: 'entity_only', downgraded: true, label_source: 'event_phrase_downgraded' };
  }
  
  // If not claimed as event phrase, try to generate fallback from headline
  if (!claimedIsEventPhrase) {
    // NEW: Try to generate fallback event phrase from top headline
    if (topHeadline) {
      const fallbackLabel = tryGenerateFallbackFromHeadline(topHeadline, topic);
      if (fallbackLabel) {
        return { 
          is_event_phrase: true, 
          label_quality: 'fallback_generated', 
          downgraded: false, 
          label_source: 'detect_fallback',
          fallbackLabel 
        };
      }
    }
    return { is_event_phrase: false, label_quality: 'entity_only', downgraded: false, label_source: 'entity_only' };
  }
  
  // Validate the claim: does it actually contain a verb/event noun?
  const isActuallyEventPhrase = isEventPhrase(topic);
  
  if (isActuallyEventPhrase) {
    return { is_event_phrase: true, label_quality: 'event_phrase', downgraded: false, label_source: 'event_phrase' };
  } else {
    // DOWNGRADE: Claimed event_phrase but doesn't pass validation
    // Try fallback generation from headline
    if (topHeadline) {
      const fallbackLabel = tryGenerateFallbackFromHeadline(topHeadline, topic);
      if (fallbackLabel) {
        return { 
          is_event_phrase: true, 
          label_quality: 'fallback_generated', 
          downgraded: true, 
          label_source: 'detect_fallback_after_downgrade',
          fallbackLabel 
        };
      }
    }
    return { is_event_phrase: false, label_quality: 'entity_only', downgraded: true, label_source: 'event_phrase_downgraded' };
  }
}

/**
 * Try to generate a fallback event phrase from headline when entity is detected
 * PHASE 3 FIX: Strengthened with more verb patterns and headline truncation fallback
 */
function tryGenerateFallbackFromHeadline(headline: string, entityName: string): string | null {
  if (!headline || headline.length < 10) return null;

  // Escape special regex characters in entity name
  const escapedEntity = entityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // PHASE 3 FIX: Comprehensive action verbs
  const verbPatterns = [
    // Active voice: "Trump Fires FBI Director", "House Passes Bill"
    new RegExp(`(${escapedEntity})\\s+(passes?|blocks?|rejects?|approves?|signs?|fires?|resigns?|announces?|launches?|bans?|arrests?|indicts?|sues?|orders?|vetoes?|strikes?|rules?|overturns?|upholds?|halts?|suspends?|expands?|cuts?|threatens?|warns?|demands?|proposes?|withdraws?|seizes?|raids?|deports?|detains?|pardons?|revokes?|nominates?|appoints?|dismisses?|grants?|denies?|charges?|convicts?|acquits?|sentences?|attacks?|invades?|bombs?|wins?|loses?|faces?|confirms?|targets?|reveals?|claims?|alleges?|slams?|blasts?|praises?|defends?|condemns?|honors?|celebrates?|mourns?|marks?|meets?|visits?|hosts?|addresses?|plans?|considers?|seeks?|urges?|vows?)\\s+(.+)`, 'i'),
    // Subject + Verb pattern anywhere
    new RegExp(`\\b(${escapedEntity})\\b.*?\\b(passes?|blocks?|fires?|signs?|bans?|wins?|loses?|faces?|arrests?|indicts?|sues?|orders?|announces?|reveals?|confirms?|targets?|slams?|honors?|meets?)\\b`, 'i'),
    // Verb + Subject pattern
    new RegExp(`\\b(passes?|blocks?|fires?|signs?|bans?|wins?|loses?|arrests?|indicts?|sues?|honors?|targets?)\\b.*?\\b(${escapedEntity})\\b`, 'i'),
  ];

  for (const pattern of verbPatterns) {
    const match = headline.match(pattern);
    if (match) {
      // Build phrase: Subject + Verb + Object (limit to 5 words)
      let phrase = match[0];
      const words = phrase.split(/\s+/).slice(0, 5);
      if (words.length >= 3) {
        const result = words.map(w =>
          w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
        ).join(' ');
        // Validate the generated phrase
        if (isEventPhrase(result)) {
          return result;
        }
      }
    }
  }

  // Look for event nouns in headline that could form a phrase
  const eventNounPattern = /\b(vote|bill|ruling|crisis|ban|tariff|policy|probe|investigation|hearing|trial|arrest|firing|resignation|indictment|verdict|conviction|acquittal|sanction|ceasefire|attack|bombing|strike|raid|protest|scandal|impeachment|shutdown|veto|deportation|pardon|order|mandate|summit|election|debate|ceremony|holiday|memorial|anniversary|legacy)\b/i;
  const actionMatch = headline.match(eventNounPattern);

  if (actionMatch) {
    const action = actionMatch[1];
    const phrase = `${entityName} ${action.charAt(0).toUpperCase() + action.slice(1).toLowerCase()}`;
    if (phrase.split(/\s+/).length >= 2) {
      return phrase;
    }
  }

  // PHASE 3 FIX: Headline truncation fallback
  // Use first 4-5 words of headline if it contains the entity
  const headlineLower = headline.toLowerCase();
  const entityLower = entityName.toLowerCase();
  if (headlineLower.includes(entityLower.split(' ')[0])) {
    const words = headline.split(/\s+/).filter(w => w.length > 1).slice(0, 5);
    if (words.length >= 3) {
      const truncated = words.map(w =>
        w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      ).join(' ');
      console.log(`[detect-trend-events] Fallback headline truncation: "${truncated}" for "${entityName}"`);
      return truncated;
    }
  }

  return null;
}

/**
 * Calculate authority score for label selection
 * PHASE 2: Event phrases get STRONG priority (100+ boost) to ensure they always win over entity-only labels
 * Prefers: event phrases >> entities, high-authority sources, higher frequency
 */
function calculateAuthorityScore(
  agg: TopicAggregate,
  sourceTiers: Map<string, { tier: string; weight: number }>
): number {
  // Base score from mention count
  let score = Math.log2(agg.dedupedMentions.size + 1) * 10;
  
  // PHASE 2: STRONG boost for event phrases - ensures they ALWAYS win canonical selection
  // Event phrases (2+ words with action) get massive priority over single-word entities
  if (agg.is_event_phrase) {
    score += 100; // Much higher than before (was 25) to guarantee event phrase selection
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

// ============================================================================
// PERFORMANCE LIMITS - Prevent CPU timeout
// ============================================================================
const PERF_LIMITS = {
  TIME_WINDOW_HOURS: 24,        // Align window with current_24h metrics
  MAX_RSS_ARTICLES: 1000,       // Limit RSS articles per run
  MAX_GOOGLE_NEWS: 800,         // Limit Google News articles  
  MAX_BLUESKY_POSTS: 2000,      // Limit Bluesky posts (was 5000)
  MAX_EXISTING_EVENTS: 300,     // Limit embedding index (was 500)
  UPSERT_BATCH_SIZE: 100,       // Batch upserts to avoid large payloads
  TIMEOUT_GUARD_MS: 45000,      // Exit early if nearing 50s CPU limit
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let currentPhase = 'init';
  
  // Helper to check if we should exit early
  const shouldExitEarly = () => {
    const elapsed = Date.now() - startTime;
    if (elapsed > PERF_LIMITS.TIMEOUT_GUARD_MS) {
      console.warn(`[detect-trend-events] ⚠️ TIMEOUT GUARD: Exiting early at phase "${currentPhase}" after ${elapsed}ms`);
      return true;
    }
    return false;
  };
  
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

    console.log(`[detect-trend-events] Starting v4 with perf limits: window=${PERF_LIMITS.TIME_WINDOW_HOURS}h, rss=${PERF_LIMITS.MAX_RSS_ARTICLES}, gn=${PERF_LIMITS.MAX_GOOGLE_NEWS}, bsky=${PERF_LIMITS.MAX_BLUESKY_POSTS}`);
    currentPhase = 'load_aliases';
    
    // Load entity aliases for canonicalization
    await loadEntityAliases(supabase);
    
    const now = new Date();
    const hour1Ago = new Date(now.getTime() - 60 * 60 * 1000);
    const hours6Ago = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    // PERF: Use reduced time window
    const hoursWindowAgo = new Date(now.getTime() - PERF_LIMITS.TIME_WINDOW_HOURS * 60 * 60 * 1000);
    const days7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const days30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Load source tiers for authority weighting (from source_tiers table)
    const { data: tierData } = await supabase
      .from('source_tiers')
      .select('domain, tier, authority_weight');
    
    const sourceTiers = new Map<string, { tier: string; weight: number }>();
    for (const t of tierData || []) {
      sourceTiers.set(t.domain, { tier: t.tier, weight: t.authority_weight || 1 });
    }
    
    // Load RSS source tiers by URL domain (Phase 2: tier weighting)
    // Maps domain -> normalized tier (tier1/tier2/tier3)
    const { data: rssSourceTiers } = await supabase
      .from('rss_sources')
      .select('url, tier')
      .not('tier', 'is', null);
    
    const rssTiersByDomain = new Map<string, 'tier1' | 'tier2' | 'tier3'>();
    for (const s of rssSourceTiers || []) {
      const domain = extractDomainUtil(s.url);
      if (domain && s.tier) {
        // Normalize tier values: 'specialized', 'national' -> 'tier2'
        let normalizedTier: 'tier1' | 'tier2' | 'tier3' = 'tier3';
        if (s.tier === 'tier1') normalizedTier = 'tier1';
        else if (s.tier === 'tier2' || s.tier === 'national' || s.tier === 'specialized') normalizedTier = 'tier2';
        else if (s.tier === 'tier3') normalizedTier = 'tier3';
        rssTiersByDomain.set(domain, normalizedTier);
      }
    }
    
    // Load Google News source tiers by name
    // Note: Google News articles come from various domains, so we match by source name when possible
    const { data: gnSourceTiers } = await supabase
      .from('google_news_sources')
      .select('name, tier')
      .not('tier', 'is', null);
    
    const gnTiersByName = new Map<string, 'tier1' | 'tier2' | 'tier3'>();
    for (const s of gnSourceTiers || []) {
      if (s.name && s.tier) {
        // Normalize tier values
        let normalizedTier: 'tier1' | 'tier2' | 'tier3' = 'tier2';
        if (s.tier === 'tier1') normalizedTier = 'tier1';
        else if (s.tier === 'national') normalizedTier = 'tier2'; // National topics are tier2
        else if (s.tier === 'tier2') normalizedTier = 'tier2';
        else normalizedTier = 'tier3';
        gnTiersByName.set(s.name.toLowerCase(), normalizedTier);
      }
    }
    
    console.log(`[detect-trend-events] Loaded ${rssTiersByDomain.size} RSS source tiers, ${gnTiersByName.size} Google News source tiers, ${sourceTiers.size} canonical source tiers`);
    
    // ========================================
    // STEP 1: Load rolling baselines from trend_baselines
    // ========================================
    console.log('[detect-trend-events] Loading rolling baselines...');
    
    const { data: baselineData } = await supabase
      .from('trend_baselines')
      .select('event_key, baseline_date, hourly_average, hourly_std_dev, relative_std_dev')
      .gte('baseline_date', days30Ago.toISOString().split('T')[0])
      .order('baseline_date', { ascending: false });
    
    // Compute rolling averages per event_key
    const rollingBaselines = new Map<string, RollingBaseline>();
    const baselinesByKey = new Map<string, { date: string; hourly_avg: number; hourly_std_dev: number; relative_std_dev: number }[]>();
    
    for (const b of baselineData || []) {
      if (!baselinesByKey.has(b.event_key)) {
        baselinesByKey.set(b.event_key, []);
      }
      baselinesByKey.get(b.event_key)!.push({
        date: b.baseline_date,
        hourly_avg: Number(b.hourly_average) || 0,
        hourly_std_dev: Number(b.hourly_std_dev) || 0,
        relative_std_dev: Number(b.relative_std_dev) || 0,
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
      const std7d = last7d.length > 0
        ? last7d.reduce((sum, b) => sum + b.hourly_std_dev, 0) / last7d.length
        : 0;
      const std30d = last30d.length > 0
        ? last30d.reduce((sum, b) => sum + b.hourly_std_dev, 0) / last30d.length
        : 0;
      const rsd7d = last7d.length > 0
        ? last7d.reduce((sum, b) => sum + b.relative_std_dev, 0) / last7d.length
        : 0;
      
      rollingBaselines.set(key, {
        baseline_7d: avg7d,
        baseline_30d: avg30d,
        stddev_7d: std7d,
        stddev_30d: std30d,
        rsd_7d: rsd7d,
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
        // FIX: Check for metadata from extracted_topics (RSS articles)
        const metadata = topicMetadataMap?.get(key);
        const isEventPhraseFromMetadata = metadata?.is_event_phrase === true;
        const labelQualityHint = metadata?.label_quality as 'event_phrase' | 'fallback_generated' | 'entity_only' | undefined;
        
        // Use metadata if available, otherwise fall back to local heuristic
        const computedIsEventPhrase = isEventPhraseFromMetadata || isEventPhrase(topic);
        
        topicMap.set(key, {
          event_key: key,
          event_title: normalizeTopicTitle(topic),
          is_event_phrase: computedIsEventPhrase,
          label_quality_hint: labelQualityHint || null, // FIX: Preserve hint for later use
          related_entities: new Set(),
          co_occurrences: new Map(),
          mentions: [],
          dedupedMentions: new Map(),
          first_seen_at: new Date(mention.published_at),
          last_seen_at: new Date(mention.published_at),
          by_source: { rss: 0, google_news: 0, bluesky: 0 },
          by_source_deduped: { rss: 0, google_news: 0, bluesky: 0 },
          by_tier_deduped: { tier1: 0, tier2: 0, tier3: 0 },
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
        
        // Track tier distribution (bluesky is always tier3)
        const tier = mention.tier || (mention.source_type === 'bluesky' ? 'tier3' : null);
        if (tier === 'tier1') agg.by_tier_deduped.tier1++;
        else if (tier === 'tier2') agg.by_tier_deduped.tier2++;
        else agg.by_tier_deduped.tier3++; // Default unclassified/bluesky to tier3
      }
      
      const pubDate = new Date(mention.published_at);
      if (pubDate < agg.first_seen_at) agg.first_seen_at = pubDate;
      if (pubDate > agg.last_seen_at) agg.last_seen_at = pubDate;
      
      if (mention.sentiment_score !== undefined && mention.sentiment_score !== null) {
        agg.sentiment_sum += mention.sentiment_score;
        agg.sentiment_count++;
      }
    };

    // Track co-occurrence for context bundles
    const trackCoOccurrences = (topics: string[]) => {
      if (!topics || topics.length < 2) return;
      const normalized = topics
        .map((t) => normalizeTopicKey(t))
        .filter((t) => t && t.length > 1);
      for (let i = 0; i < normalized.length; i++) {
        const key = normalized[i];
        const agg = topicMap.get(key);
        if (!agg) continue;
        for (let j = 0; j < normalized.length; j++) {
          if (i === j) continue;
          const otherKey = normalized[j];
          const current = agg.co_occurrences.get(otherKey) || 0;
          agg.co_occurrences.set(otherKey, current + 1);
        }
      }
    };

    const buildContextBundles = (agg: TopicAggregate) => {
      const entries = Array.from(agg.co_occurrences.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12);
      const contextTerms: string[] = [];
      const contextPhrases: string[] = [];
      for (const [key, count] of entries) {
        if (count < 1) continue;
        const related = topicMap.get(key);
        if (!related) continue;
        const label = related.event_title;
        const isPhrase = related.is_event_phrase || isEventPhrase(label);
        if (isPhrase && contextPhrases.length < 3) {
          contextPhrases.push(label);
        } else if (!isPhrase && contextTerms.length < 5) {
          contextTerms.push(label);
        }
        if (contextTerms.length >= 5 && contextPhrases.length >= 3) break;
      }
      return { contextTerms, contextPhrases };
    };
    
    // 1. Fetch articles with topics (RSS) - includes extracted_topics with event phrases
    currentPhase = 'fetch_rss';
    const { data: articles } = await supabase
      .from('articles')
      .select('id, title, source_url, canonical_url, content_hash, published_date, sentiment_score, sentiment_label, tags, extracted_topics')
      .gte('published_date', hoursWindowAgo.toISOString())
      .eq('is_duplicate', false)
      .order('published_date', { ascending: false })
      .limit(PERF_LIMITS.MAX_RSS_ARTICLES);
    
    console.log(`[detect-trend-events] Fetched ${articles?.length || 0} RSS articles (limit: ${PERF_LIMITS.MAX_RSS_ARTICLES})`);
    if (shouldExitEarly()) throw new Error('Timeout guard triggered during RSS fetch');
    
// FIX: Track topic metadata from extracted_topics for label quality propagation
    const topicMetadataMap = new Map<string, { is_event_phrase: boolean; label_quality: string }>();
    
    for (const article of articles || []) {
      // Build topics list: prefer extracted_topics; use tags only when missing.
      let allTopics: string[] = [];
      const hasExtracted = Array.isArray(article.extracted_topics) && article.extracted_topics.length > 0;
      
      if (hasExtracted) {
        // Add extracted_topics with event phrases (new NER output) - PRESERVE METADATA
        // CRITICAL FIX: Handle BOTH old format {topic, type, relevance} AND new format {topic, entity_type, is_event_phrase, label_quality}
        for (const extracted of article.extracted_topics) {
          if (typeof extracted === 'object' && extracted.topic) {
            allTopics.push(extracted.topic);
            
            // FIX: Store metadata - handle BOTH formats
            const key = normalizeTopicKey(extracted.topic);
            if (key && !topicMetadataMap.has(key)) {
              // NEW FORMAT: has explicit is_event_phrase and label_quality
              if (extracted.is_event_phrase !== undefined || extracted.label_quality) {
                topicMetadataMap.set(key, {
                  is_event_phrase: extracted.is_event_phrase === true,
                  label_quality: extracted.label_quality || 'entity_only'
                });
              }
              // OLD FORMAT: has type field - "event_phrase" type means is_event_phrase=true
              else if (extracted.type) {
                const isEventPhraseType = extracted.type === 'event_phrase' || extracted.entity_type === 'EVENT_PHRASE';
                topicMetadataMap.set(key, {
                  is_event_phrase: isEventPhraseType,
                  label_quality: isEventPhraseType ? 'event_phrase' : 'entity_only'
                });
              }
            }
          } else if (typeof extracted === 'string') {
            allTopics.push(extracted);
          }
        }
      } else if (article.tags && Array.isArray(article.tags)) {
        // Add tags (legacy) only when no extracted_topics exist
        allTopics.push(...article.tags);
      }
      
      // Skip if no topics
      if (allTopics.length === 0) continue;
      
      // Look up tier from RSS source by domain, then fall back to source_tiers canonical table
      const articleDomain = extractDomain(article.source_url);
      let articleTier: 'tier1' | 'tier2' | 'tier3' | undefined = rssTiersByDomain.get(articleDomain);
      
      // Fall back to source_tiers table (canonical tier mapping by domain)
      if (!articleTier) {
        const canonicalTierInfo = sourceTiers.get(articleDomain);
        if (canonicalTierInfo?.tier) {
          articleTier = canonicalTierInfo.tier as 'tier1' | 'tier2' | 'tier3';
        }
      }
      
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
        domain: articleDomain,
        tier: articleTier || 'tier3', // Default to tier3 if no tier found
      };
      
      for (const topic of mention.topics) {
        addMention(topic, mention);
      }
      trackCoOccurrences(mention.topics);
    }
    
    // 2. Fetch Google News with topics
    currentPhase = 'fetch_google_news';
    if (shouldExitEarly()) throw new Error('Timeout guard triggered before Google News fetch');
    
    const { data: googleNews } = await supabase
      .from('google_news_articles')
      .select('id, title, url, canonical_url, content_hash, published_at, ai_sentiment, ai_sentiment_label, ai_topics')
      .eq('ai_processed', true)
      .eq('is_duplicate', false)
      .gte('published_at', hoursWindowAgo.toISOString())
      .not('ai_topics', 'is', null)
      .order('published_at', { ascending: false })
      .limit(PERF_LIMITS.MAX_GOOGLE_NEWS);
    
    console.log(`[detect-trend-events] Fetched ${googleNews?.length || 0} Google News articles (limit: ${PERF_LIMITS.MAX_GOOGLE_NEWS})`);
    
    for (const item of googleNews || []) {
      // PHASE 3 FIX: Use canonical_url for domain if available (item.url may be news.google.com redirect)
      const gnDomain = extractDomain(item.canonical_url || item.url);
      let gnTier: 'tier1' | 'tier2' | 'tier3' | undefined;
      
      // First check canonical source_tiers table
      const canonicalTierInfo = sourceTiers.get(gnDomain);
      if (canonicalTierInfo?.tier) {
        gnTier = canonicalTierInfo.tier as 'tier1' | 'tier2' | 'tier3';
      }
      
      // Fall back to rss_sources tiers by domain
      if (!gnTier) {
        gnTier = rssTiersByDomain.get(gnDomain);
      }
      
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
        domain: gnDomain, // PHASE 3 FIX: Uses canonical_url domain (not news.google.com)
        tier: gnTier || 'tier3', // Default to tier3 if no tier found
      };
      
      for (const topic of mention.topics) {
        addMention(topic, mention);
      }
      trackCoOccurrences(mention.topics);
    }
    
    // 3. Fetch Bluesky posts with topics
    currentPhase = 'fetch_bluesky';
    if (shouldExitEarly()) throw new Error('Timeout guard triggered before Bluesky fetch');
    
    const { data: blueskyPosts } = await supabase
      .from('bluesky_posts')
      .select('id, text, post_uri, created_at, ai_sentiment, ai_sentiment_label, ai_topics')
      .eq('ai_processed', true)
      .gte('created_at', hoursWindowAgo.toISOString())
      .not('ai_topics', 'is', null)
      .order('created_at', { ascending: false })
      .limit(PERF_LIMITS.MAX_BLUESKY_POSTS);
    
    console.log(`[detect-trend-events] Fetched ${blueskyPosts?.length || 0} Bluesky posts (limit: ${PERF_LIMITS.MAX_BLUESKY_POSTS})`);
    
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
        domain: 'bsky.app', // PHASE 3 FIX: Set domain for Bluesky posts to enable source counting
        tier: 'tier3', // Bluesky is always tier3 (social media)
      };
      
      for (const topic of mention.topics) {
        addMention(topic, mention);
      }
      trackCoOccurrences(mention.topics);
    }
    
    console.log(`[detect-trend-events] Aggregated ${topicMap.size} unique topics from sources`);

    // PHASE 3 DEBUG: Log domain distribution to diagnose multi-source rate
    const allDomains = new Map<string, number>();
    for (const [_, agg] of topicMap) {
      for (const mention of agg.dedupedMentions.values()) {
        const domain = mention.domain || 'unknown';
        allDomains.set(domain, (allDomains.get(domain) || 0) + 1);
      }
    }
    const topDomains = [...allDomains.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([d, c]) => `${d}:${c}`);
    console.log(`[detect-trend-events] TOP DOMAINS: ${topDomains.join(', ')}`);

    // Calculate authority scores for each topic
    for (const [key, agg] of topicMap) {
      agg.authority_score = calculateAuthorityScore(agg, sourceTiers);
    }
    
    // ========================================
    // STEP 2.5: Load existing trend events with embeddings for clustering
    // ========================================
    currentPhase = 'load_existing_events';
    if (shouldExitEarly()) throw new Error('Timeout guard triggered before existing events fetch');
    
    const { data: existingEvents } = await supabase
      .from('trend_events')
      .select('id, event_key, event_title, embedding, related_phrases, current_24h')
      .not('embedding', 'is', null)
      .gte('last_seen_at', days7Ago.toISOString())
      .order('current_24h', { ascending: false })
      .limit(PERF_LIMITS.MAX_EXISTING_EVENTS);
    
    console.log(`[detect-trend-events] Loaded ${existingEvents?.length || 0} existing events with embeddings (limit: ${PERF_LIMITS.MAX_EXISTING_EVENTS})`);
    
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
    currentPhase = 'process_topics';
    if (shouldExitEarly()) throw new Error('Timeout guard triggered before topic processing');
    
    const eventsToUpsert: any[] = [];
    const evidenceToInsert: any[] = [];
    const clustersToUpsert: any[] = [];
    const baselineStatsByKey = new Map<string, { hourlyStdDev: number; relativeStdDev: number }>();
    let trendingCount = 0;
    let breakingCount = 0;
    let dedupedSavings = 0;
    
    let qualityGateFiltered = 0;
    let labelDowngradedCount = 0; // FIX 1: Count downgrades from event_phrase → entity_only
    
    // FIX: Label quality audit counters
    let labelAudit = {
      event_phrase: 0,
      fallback_generated: 0,
      entity_only: 0,
      with_metadata_hint: 0, // Topics that had label_quality_hint from extracted_topics
    };
    
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

      // Hourly distribution for baseline std-dev (last 24h)
      const hourlyBuckets = Array.from({ length: 24 }, () => 0);
      for (const mention of dedupedMentions) {
        const diffHours = Math.floor((now.getTime() - new Date(mention.published_at).getTime()) / (1000 * 60 * 60));
        if (diffHours >= 0 && diffHours < 24) {
          hourlyBuckets[diffHours] += 1;
        }
      }
      const hourlyMean = hourlyBuckets.reduce((sum, v) => sum + v, 0) / 24;
      const variance = hourlyBuckets.reduce((sum, v) => sum + Math.pow(v - hourlyMean, 2), 0) / 24;
      const hourlyStdDev = Math.sqrt(variance);
      const relativeStdDev = hourlyMean > 0 ? hourlyStdDev / hourlyMean : 0;
      baselineStatsByKey.set(key, { hourlyStdDev, relativeStdDev });
      
      // Source counts using DEDUPED counts
      const newsCount = agg.by_source_deduped.rss + agg.by_source_deduped.google_news;
      const socialCount = agg.by_source_deduped.bluesky;
      const sourceTypeCount = (agg.by_source_deduped.rss > 0 ? 1 : 0) +
                              (agg.by_source_deduped.google_news > 0 ? 1 : 0) +
                              (agg.by_source_deduped.bluesky > 0 ? 1 : 0);

      // PHASE 3 FIX: Count distinct source domains for better source diversity measurement
      // This counts unique publishers/domains, not just source types
      const distinctDomains = new Set<string>();
      for (const mention of agg.dedupedMentions.values()) {
        if (mention.domain) {
          distinctDomains.add(mention.domain.toLowerCase());
        }
      }
      const sourceCount = Math.max(distinctDomains.size, sourceTypeCount); // At least count source types
      
      // ========================================
      // PHASE 2: Get tier distribution BEFORE quality gates
      // ========================================
      
      // Get tier distribution from aggregate
      const tier1Count = agg.by_tier_deduped.tier1;
      const tier2Count = agg.by_tier_deduped.tier2;
      const tier3Count = agg.by_tier_deduped.tier3;
      
      // ========================================
      // QUALITY GATES: Filter low-quality topics
      // PHASE 2: Now includes tier counts for single-word suppression
      // ========================================
      const qualityResult = passesQualityGates(
        key,
        agg.event_title,
        totalMentionsDeduped,
        sourceCount,
        newsCount,
        socialCount,
        current1h_deduped,
        current24h_deduped,
        tier1Count,  // PHASE 2: Pass tier counts
        tier2Count   // PHASE 2: Pass tier counts
      );
      
      if (!qualityResult.passes) {
        qualityGateFiltered++;
        console.log(`[detect-trend-events] Quality gate filtered: "${agg.event_title}" (${qualityResult.reason})`);
        continue;
      }

      // Context bundles for entity-only trends
      const { contextTerms, contextPhrases } = buildContextBundles(agg);
      const hasContext = contextTerms.length >= 2 || contextPhrases.length >= 1;
      
      // Get rolling baseline from historical data
      const rolling = rollingBaselines.get(key);
      const hasHistoricalBaseline: boolean = !!(rolling && rolling.data_points_7d >= 3);
      
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
      // PHASE 3: EVERGREEN DETECTION & RECENCY DECAY
      // ========================================
      const isEvergreen = isEvergreenTopic(key, baseline7d, baseline30d);
      const recencyDecay = calculateRecencyDecay(agg.last_seen_at, now);
      
      // ========================================
      // PHASE 2: TIER WEIGHTING & CORROBORATION
      // (tier counts already defined above for quality gates)
      // ========================================
      
      // Check if tier1/tier2 source is present (for corroboration)
      const hasTier12Corroboration = tier1Count > 0 || tier2Count > 0;
      const isTier3Only = !hasTier12Corroboration && tier3Count > 0;
      
      // Calculate weighted evidence score
      // Each mention weighted by: tier_weight * source_type_weight
      let weightedEvidenceScore = 0;
      for (const mention of dedupedMentions) {
        const tierWeight = TIER_WEIGHTS[mention.tier || 'unclassified'] || TIER_WEIGHTS['unclassified'];
        const sourceWeight = SOURCE_TYPE_WEIGHTS[mention.source_type] || 1.0;
        weightedEvidenceScore += tierWeight * sourceWeight;
      }
      // Normalize to 0-100 scale (assume 10 perfectly weighted mentions = 100)
      weightedEvidenceScore = Math.min(100, (weightedEvidenceScore / 10) * 100);
      
      // ========================================
      // TWITTER-LIKE RANKING: Velocity vs Baseline (z-score approach)
      // Primary: spike velocity relative to baseline
      // Secondary: corroboration + volume gate
      // Now includes: tier weighting + cross-tier corroboration
      // ========================================
      
      // Baseline quality factor
      const baselineQuality = hasHistoricalBaseline ? 1.0 : 0.6;

      // Calculate z-score for velocity using baseline std-dev when available
      // FIX: Use statistically valid Poisson-based fallback instead of heuristic
      const baselineStdDev = hasHistoricalBaseline ? (rolling?.stddev_7d || 0) : 0;

      let zScoreVelocity: number;
      if (hasHistoricalBaseline && baselineStdDev > 0) {
        // Standard z-score with historical baseline data
        const rawZ = (currentHourlyRate - baseline7d) / baselineStdDev;
        zScoreVelocity = Math.min(10, Math.max(-2, rawZ));
      } else {
        // Poisson-based fallback for new topics without historical baseline
        // For count data, variance ≈ mean under Poisson assumption
        // Use conservative baseline estimate: assume current rate is 3x normal spike
        const conservativeBaseline = Math.max(0.5, currentHourlyRate / 3);
        // Poisson std-dev = sqrt(mean), use max of baseline and 1 to avoid division issues
        const poissonStdDev = Math.sqrt(Math.max(1, conservativeBaseline));
        const rawZ = (currentHourlyRate - conservativeBaseline) / poissonStdDev;
        // Apply baseline quality penalty and clamp
        zScoreVelocity = Math.min(10, Math.max(-2, rawZ * baselineQuality));
      }
      
      // Volume gate: minimum thresholds to prevent low-volume spikes
      // Require either:
      // - 2+ mentions in 1h (recent activity), OR
      // - 5+ mentions in 24h (sustained interest), OR
      // - 2+ sources (corroboration)
      const meetsVolumeGate = current1h_deduped >= 2 || current24h_deduped >= 5 || sourceCount >= 2;
      
      // ========================================
      // PHASE A: Determine label quality EARLY for use in ranking
      // (This needs to happen before rank score calculation)
      // ========================================
      const isSingleWordEntity = agg.event_title.split(/\s+/).length === 1;
      
      // Get cluster info for determining canonical label quality
      const clusterKeyForLabel = keyToCluster.get(key) || key;
      const clusterForLabel = clusters.get(clusterKeyForLabel);
      
      // Determine canonical label from cluster for label quality assessment
      let canonicalLabelForRanking = agg.event_title;
      let canonicalLabelIsEventPhraseForRanking = agg.is_event_phrase;
      
      if (clusterForLabel) {
        canonicalLabelForRanking = clusterForLabel.canonicalTitle;
        canonicalLabelIsEventPhraseForRanking = clusterForLabel.isEventPhrase;
        
        if (!clusterForLabel.isEventPhrase) {
          const clusterEventPhrasesForLabel = Array.from(clusterForLabel.memberTitles)
            .filter(t => t.split(/\s+/).length >= 2);
          if (clusterEventPhrasesForLabel.length > 0) {
            canonicalLabelForRanking = clusterEventPhrasesForLabel[0];
            canonicalLabelIsEventPhraseForRanking = true;
          }
        }
      }
      
      // ========================================
      // MOVED: Get top headline EARLY for fallback generation
      // (dedupedMentions is already computed at line ~1486)
      // ========================================
      const sortedMentionsEarly = [...dedupedMentions].sort((a, b) => {
        if (a.source_type !== 'bluesky' && b.source_type === 'bluesky') return -1;
        if (a.source_type === 'bluesky' && b.source_type !== 'bluesky') return 1;
        return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
      });
      const topHeadlineEarly = sortedMentionsEarly[0]?.title?.substring(0, 200) || '';
      
      // ========================================
      // FIX 1: Validate event phrase labels using verb-required heuristic
      // Downgrade "event phrases" that are actually entity-only patterns
      // FIX: Now includes label_quality_hint AND topHeadline for fallback generation
      // ========================================
      const validationResult = validateEventPhraseLabel(
        canonicalLabelForRanking, 
        canonicalLabelIsEventPhraseForRanking,
        agg.label_quality_hint, // FIX: Pass the hint from extracted_topics metadata
        topHeadlineEarly // NEW: Pass headline for fallback generation
      );
      
      // Update the canonical flag if downgraded
      if (validationResult.downgraded) {
        labelDowngradedCount++;
        console.log(`[detect-trend-events] ⚠️ DOWNGRADED: "${canonicalLabelForRanking}" from event_phrase → entity_only (no verb/event-noun found)`);
      }
      
      // NEW: If fallback was generated, log it and use the fallback label
      let effectiveCanonicalLabel = canonicalLabelForRanking;
      if (validationResult.fallbackLabel) {
        effectiveCanonicalLabel = validationResult.fallbackLabel;
        console.log(`[detect-trend-events] ✅ FALLBACK GENERATED: "${validationResult.fallbackLabel}" for entity "${canonicalLabelForRanking}" from headline`);
      }
      
      // Use the validated label quality for ranking
      const labelQualityForRanking = validationResult.label_quality;
      const validatedIsEventPhrase = validationResult.is_event_phrase;
      const labelSource = validationResult.label_source; // FIX: Track label source for explainability
      
      // ========================================
      // PHASE 3: EVERGREEN PENALTY CALCULATION
      // PHASE A: Now includes single-word entity penalty
      // ========================================
      const evergreenPenalty = calculateEvergreenPenalty(
        isEvergreen, 
        zScoreVelocity, 
        hasHistoricalBaseline,
        isSingleWordEntity && labelQualityForRanking === 'entity_only'  // Only penalize single-word entity-only labels
      );
      
      // ========================================
      // PHASE 3: RANK SCORE - Twitter-like trending formula
      // Primary: z-score (burst above baseline)
      // Secondary: corroboration (cross-source)
      // Modifiers: recency, evergreen suppression, label quality
      // ========================================
      const rankScore = calculateRankScore({
        zScoreVelocity,
        corroborationScore,
        sourceCount,
        hasTier12Corroboration,
        newsCount,
        socialCount,
        recencyDecay,
        evergreenPenalty,
        baselineQuality,
        current1h: current1h_deduped,
        current24h: current24h_deduped,
        labelQuality: labelQualityForRanking,
        hasContext,
      });
      
      // LEGACY TREND_SCORE: Keep for backwards compatibility
      // Components:
      // 1. Z-score velocity (0-100): How much above baseline (primary factor)
      // 2. Corroboration boost (0-30): Cross-source verification
      // 3. Volume bonus (0-20): Raw activity level (secondary)
      // 4. Tier boost (0-20): Weighted by tier distribution
      const velocityScore = zScoreVelocity * 10 * baselineQuality; // 0-100
      const corroborationBoost = sourceCount >= 2 
        ? 15 + (newsCount > 0 && socialCount > 0 ? 15 : 0) // 15-30 for cross-source
        : 0;
      const volumeBonus = Math.min(20, Math.log2(current24h_deduped + 1) * 5);
      
      // Tier boost - higher for tier1/tier2 presence
      const tierBoost = tier1Count > 0 
        ? 20  // Tier1 presence = full boost
        : tier2Count > 0 
          ? 12  // Tier2 presence = moderate boost
          : 0;  // Tier3 only = no boost
      
      // Tier3-only penalty for cross-tier corroboration requirement
      const tier3OnlyPenalty = REQUIRE_TIER12_CORROBORATION && isTier3Only ? 0.5 : 1.0;
      
      // Apply volume gate + tier penalty: demote tier3-only trends
      const trendScore = meetsVolumeGate 
        ? Math.max(0, (velocityScore + corroborationBoost + volumeBonus + tierBoost) * tier3OnlyPenalty)
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
      // NEW: Tier3-only trends with high penalty are not considered "trending" 
      // unless they have very high velocity to overcome the penalty
      const isContextSufficient = labelQualityForRanking !== 'entity_only' || hasContext;
      const isTrending = trendScore >= 20 && meetsVolumeGate && isContextSufficient;
      
      // PHASE C: Breaking detection - adjusted thresholds for real-world cycles
      // Breaking requires: tier1/tier2 corroboration + one of several criteria
      // Relaxed from Phase A/B while maintaining quality via tier requirement
      
      // ========== BREAKING DETECTION (Fix 3) ==========
      // Breaking criteria with explainability - tracks which path triggered
      // Path A: Fresh high-confidence (≤8h, z>3, tier1/2)
      // Path B: Extreme z-score regardless of age (≤24h, z≥4, tier1/2)
      // Path C: High rank + moderate spike + very fresh
      // Path D: Baseline surge (historical data required)
      // Path E: High corroboration volume
      // Path F: Extreme fresh activity (high current_1h even for new topics)
      
      let breakingPath: string | null = null;
      
      // Use current_1h for new topics even without baseline
      // For new topics, current_1h itself indicates breaking potential
      // FIX 5: Improved proxy calculation for topics with stale mentions but high activity
      let effectiveCurrent1h = current1h_deduped;
      
      // If current_1h is 0 but we have significant recent activity, use a proxy
      if (effectiveCurrent1h === 0) {
        // Proxy based on 6h activity + source diversity (more generous than before)
        if (current6h_deduped >= 5 && sourceCount >= 2 && hoursOld < 4) {
          effectiveCurrent1h = Math.ceil(current6h_deduped / 2); // Half of 6h as proxy
          console.log(`[detect-trend-events] current_1h proxy: "${agg.event_title}" 0 → ${effectiveCurrent1h} (from 6h: ${current6h_deduped})`);
        } else if (sourceCount >= 3 && hoursOld < 2) {
          effectiveCurrent1h = Math.min(5, sourceCount + newsCount); // Based on source diversity
          console.log(`[detect-trend-events] current_1h proxy: "${agg.event_title}" 0 → ${effectiveCurrent1h} (from sources: ${sourceCount})`);
        }
      }
      
      // FIX 5: Sanity check log for breaking-candidate topics with null/zero effective current_1h
      if (hasTier12Corroboration && zScoreVelocity >= 2 && effectiveCurrent1h === 0) {
        console.log(`[detect-trend-events] ⚠️ SANITY: Breaking-candidate "${agg.event_title}" has effectiveCurrent1h=0 (raw=${current1h_deduped}, 6h=${current6h_deduped}, 24h=${current24h_deduped})`);
      }
      
      // Check each breaking path
      if (hasTier12Corroboration && meetsVolumeGate) {
        if (zScoreVelocity > 3 && newsCount >= 1 && hoursOld < 8) {
          // Path A: Fresh high-confidence spike (original strict path)
          breakingPath = 'A:fresh_spike';
        } else if (zScoreVelocity >= 4 && newsCount >= 1 && hoursOld < 24) {
          // Path B: Extreme z-score with tier1/2 - allow up to 24h for major events
          // This catches real breaking news that takes time to build but is clearly abnormal
          breakingPath = 'B:extreme_zscore';
        } else if (rankScore >= 60 && zScoreVelocity > 2 && hoursOld < 4) {
          // Path C: High rank score + moderate spike + very recent
          breakingPath = 'C:high_rank_fresh';
        } else if (hasHistoricalBaseline && baselineDelta > 4 && sourceCount >= 2 && hoursOld < 12) {
          // Path D: Baseline comparison - sustained surge
          breakingPath = 'D:baseline_surge';
        } else if (corroborationScore >= 6 && effectiveCurrent1h >= 5 && hoursOld < 6) {
          // Path E: Very high corroboration + activity (multiple quality sources)
          // Now uses effectiveCurrent1h to support new topics
          breakingPath = 'E:high_corroboration';
        } else if (effectiveCurrent1h >= 8 && newsCount >= 2 && hoursOld < 3) {
          // Path F: Extreme fresh activity - new topics with rapid growth
          // High current_1h with multiple news sources = definitely breaking
          breakingPath = 'F:extreme_activity';
        }
      }
      
      const isBreakingCandidate = breakingPath !== null;
      
      // Additional guard: breaking must also be trending (prevents edge cases)
      const isBreaking = isBreakingCandidate && isTrending;
      
      // Log breaking events with path for monitoring
      if (isBreaking) {
        console.log(`[detect-trend-events] 🚨 BREAKING [${breakingPath}]: "${agg.event_title}" (z=${zScoreVelocity.toFixed(2)}, rank=${rankScore.toFixed(1)}, tier1/2=${hasTier12Corroboration}, age=${hoursOld.toFixed(1)}h, current_1h=${effectiveCurrent1h})`);
      } else if (hasTier12Corroboration && zScoreVelocity >= 3 && !isBreaking) {
        // Log near-misses for debugging
        console.log(`[detect-trend-events] ⚠️ NEAR-BREAKING: "${agg.event_title}" (z=${zScoreVelocity.toFixed(2)}, age=${hoursOld.toFixed(1)}h, trending=${isTrending}, volumeGate=${meetsVolumeGate})`);
      }
      
      if (isTrending) trendingCount++;
      if (isBreaking) breakingCount++;
      
      // Log tier3-only trends for monitoring
      if (isTier3Only && trendScore > 10) {
        console.log(`[detect-trend-events] Tier3-only trend demoted: "${agg.event_title}" (score: ${trendScore.toFixed(1)}, penalty applied)`);
      }
      
      // Sentiment
      const avgSentiment = agg.sentiment_count > 0 ? agg.sentiment_sum / agg.sentiment_count : null;
      let sentimentLabel = 'neutral';
      if (avgSentiment !== null) {
        if (avgSentiment > 0.2) sentimentLabel = 'positive';
        else if (avgSentiment < -0.2) sentimentLabel = 'negative';
      }
      
      // Use sortedMentionsEarly computed earlier for consistency
      const sortedMentions = sortedMentionsEarly;
      const topHeadline = topHeadlineEarly;
      const contextSummary = topHeadline ? topHeadline.substring(0, 180) : null;
      
      // Get cluster info for this topic
      const clusterKey = keyToCluster.get(key) || key;
      const cluster = clusters.get(clusterKey);
      
      // Build related phrases from cluster (excluding self)
      const relatedPhrases = cluster 
        ? Array.from(cluster.memberTitles).filter(t => t !== agg.event_title).slice(0, 10)
        : [];
      
      // PHASE 2: Determine canonical label from cluster - ALWAYS prefer event phrases
      // If cluster has an event phrase as canonical, use it; otherwise check if current topic is an event phrase
      // NEW: Also consider effectiveCanonicalLabel from fallback generation
      let canonicalLabel = effectiveCanonicalLabel; // Start with the fallback-enhanced label if available
      let canonicalLabelIsEventPhrase = validatedIsEventPhrase; // Use validated value from Fix 1
      
      if (cluster) {
        // Cluster's canonical is already the highest authority (which now strongly prefers event phrases)
        // Only override if we don't have a fallback-generated label
        if (!validationResult.fallbackLabel) {
          canonicalLabel = cluster.canonicalTitle;
        }
        
        // Validate the cluster's is_event_phrase claim using verb-required heuristic
        const clusterValidation = validateEventPhraseLabel(cluster.canonicalTitle, cluster.isEventPhrase, null);
        canonicalLabelIsEventPhrase = clusterValidation.is_event_phrase;
        
        if (clusterValidation.downgraded) {
          console.log(`[detect-trend-events] ⚠️ Cluster canonical downgraded: "${cluster.canonicalTitle}" from event_phrase → entity_only`);
        }
        
        // PHASE 2 SAFETY: If cluster's canonical is NOT an event phrase but cluster contains one,
        // override to use the best event phrase from the cluster
        // But prefer our fallback label if we have one
        if (!canonicalLabelIsEventPhrase && !validationResult.fallbackLabel) {
          const clusterEventPhrases = Array.from(cluster.memberTitles)
            .filter(t => {
              // Only include phrases that pass the verb-required validation
              const validation = validateEventPhraseLabel(t, isEventPhrase(t), null);
              return validation.is_event_phrase;
            });
          
          if (clusterEventPhrases.length > 0) {
            // Pick the first valid event phrase
            canonicalLabel = clusterEventPhrases[0];
            canonicalLabelIsEventPhrase = true;
            console.log(`[detect-trend-events] PHASE 2: Overrode entity-only canonical "${cluster.canonicalTitle}" with validated event phrase "${canonicalLabel}"`);
          }
        }
        
        // If we had a fallback label, ensure it's used as canonical
        if (validationResult.fallbackLabel) {
          canonicalLabel = validationResult.fallbackLabel;
          canonicalLabelIsEventPhrase = true;
        }
      }
      
      // NEW: For entity-only trends with context_summary, upgrade canonical_label to use the context
      // This ensures entity names like "Hakeem Jeffries" display as "Jeffries calls Noem a liar..."
      if (labelQualityForRanking === 'entity_only' && contextSummary && contextSummary.length > 20) {
        // Use context_summary as the canonical label for better display
        canonicalLabel = contextSummary;
        // FIX: For context summaries (full headlines), just check for verb presence without word count limit
        // Headlines are typically 10+ words but still describe events - isEventPhrase() would fail due to word count
        const contextHasVerb = containsVerbOrEventNoun(contextSummary);
        if (contextHasVerb) {
          canonicalLabelIsEventPhrase = true;
          console.log(`[detect-trend-events] ✅ CONTEXT UPGRADE: "${agg.event_title}" → "${contextSummary.substring(0, 60)}..." (is_event_phrase=true)`);
        } else {
          // Context doesn't have verb - keep is_event_phrase as false
          console.log(`[detect-trend-events] CONTEXT DISPLAY: "${agg.event_title}" → "${contextSummary.substring(0, 60)}..." (is_event_phrase=false, no verb)`);
        }
      }
      
      // PHASE 2/A: labelQuality already computed earlier for ranking - reuse it
      // Use labelQualityForRanking which was computed before rankScore calculation
      const labelQuality = labelQualityForRanking;
      
      // FIX: Track label quality for audit
      if (labelQuality === 'event_phrase') labelAudit.event_phrase++;
      else if (labelQuality === 'fallback_generated') labelAudit.fallback_generated++;
      else labelAudit.entity_only++;
      if (agg.label_quality_hint) labelAudit.with_metadata_hint++;
      
      // Build related entities array from the aggregate
      const relatedEntitiesArray = Array.from(agg.related_entities).slice(0, 10);
      
      // PHASE A: Enhanced logging for evergreen + label quality suppression
      if (evergreenPenalty < 1.0) {
        const penaltyReasons: string[] = [];
        if (isEvergreen) penaltyReasons.push('evergreen');
        if (isSingleWordEntity && labelQuality === 'entity_only') penaltyReasons.push('single-word-entity');
        console.log(`[detect-trend-events] Suppressed "${agg.event_title}" (reasons: ${penaltyReasons.join(', ')}, penalty: ${evergreenPenalty.toFixed(2)}, z-score: ${zScoreVelocity.toFixed(2)}, label: ${labelQuality})`);
      }
      
      // Build event record with clustering info + velocity-based ranking + PHASE 2 label quality + PHASE 3 rank score
      const eventRecord = {
        event_key: key,
        event_title: agg.event_title,
        canonical_label: canonicalLabel, // Best label for display
        is_event_phrase: canonicalLabelIsEventPhrase, // FIX 2: Use final value after fallback/context upgrades
        label_quality: labelQuality,  // PHASE 2: Track label source quality
        label_source: labelSource,  // NEW: Top-level field for audit queries
        related_entities: relatedEntitiesArray,  // PHASE 2: Entities contributing to this phrase
        related_phrases: relatedPhrases, // Alternate phrasings from cluster
        context_terms: contextTerms,
        context_phrases: contextPhrases,
        context_summary: contextSummary,
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
        // Velocity-based ranking fields
        trend_score: Math.round(trendScore * 10) / 10, // Legacy ranking metric
        z_score_velocity: Math.round(zScoreVelocity * 100) / 100, // For explainability
        confidence_score: Math.round(confidenceScore),
        // PHASE 3: New rank_score for Twitter-like ranking
        rank_score: rankScore,
        recency_decay: Math.round(recencyDecay * 1000) / 1000,
        evergreen_penalty: Math.round(evergreenPenalty * 1000) / 1000,
        confidence_factors: {
          ...confidenceFactors,
          baseline_quality: baselineQuality,
          baseline_delta_pct: Math.round(baselineDeltaPct * 10) / 10,
          has_historical_baseline: hasHistoricalBaseline,
          meets_volume_gate: meetsVolumeGate,
          is_event_phrase: canonicalLabelIsEventPhrase, // FIX 2: Use final value after fallback/context upgrades
          label_quality: labelQuality,  // PHASE 2: Include in explainability
          label_source: labelSource,  // FIX: Explicit label source for audit
          label_quality_hint: agg.label_quality_hint || null, // FIX: Original hint from extraction
          single_word_explain: qualityResult.singleWordExplain || null, // PHASE 2: Why single-word passed
          related_entities_count: agg.related_entities.size,
          cluster_size: cluster?.memberKeys.size || 1,
          authority_score: agg.authority_score,
          // Phase 2: Tier weighting explainability
          tier_boost: tierBoost,
          tier3_only_penalty: tier3OnlyPenalty,
          // Phase 3: Rank score explainability
          rank_score_components: {
            recency_decay: recencyDecay,
            evergreen_penalty: evergreenPenalty,
            is_evergreen: isEvergreen,
          },
          // Phase C: Breaking criteria explainability (Fix 3: added breaking_path)
          breaking_criteria: isBreaking ? {
            breaking_path: breakingPath,
            has_tier12: hasTier12Corroboration,
            z_score: zScoreVelocity,
            rank_score: rankScore,
            hours_old: Math.round(hoursOld * 10) / 10,
            news_count: newsCount,
            corroboration_score: corroborationScore,
            current_1h: current1h_deduped,
            effective_current_1h: effectiveCurrent1h,
            baseline_delta: baselineDelta,
            has_historical_baseline: hasHistoricalBaseline,
          } : null,
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
        // Phase 2: Tier distribution fields
        tier1_count: tier1Count,
        tier2_count: tier2Count,
        tier3_count: tier3Count,
        weighted_evidence_score: Math.round(weightedEvidenceScore * 10) / 10,
        has_tier12_corroboration: hasTier12Corroboration,
        is_tier3_only: isTier3Only,
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
          // Phase 4: Include source tier for explainability
          source_tier: mention.tier || tierInfo?.tier || null,
        });
      }
    }
    
    console.log(`[detect-trend-events] Processing ${eventsToUpsert.length} topics, ${trendingCount} trending, ${breakingCount} breaking`);
    console.log(`[detect-trend-events] Quality gates filtered ${qualityGateFiltered} low-quality topics`);
    console.log(`[detect-trend-events] Deduplication removed ${dedupedSavings} duplicate mentions`);
    console.log(`[detect-trend-events] FIX 1: Downgraded ${labelDowngradedCount} entity-only labels from is_event_phrase=true → false`);

    // PHASE 3 FIX: Log source distribution for debugging
    const sourceDistribution = eventsToUpsert.reduce((acc, e) => {
      const sc = e.source_count || 0;
      acc[sc >= 5 ? '5+' : sc.toString()] = (acc[sc >= 5 ? '5+' : sc.toString()] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log(`[detect-trend-events] Source count distribution: ${JSON.stringify(sourceDistribution)}`);
    // FIX: Label quality audit log
    console.log(`[detect-trend-events] LABEL AUDIT: event_phrase=${labelAudit.event_phrase} fallback_generated=${labelAudit.fallback_generated} entity_only=${labelAudit.entity_only} (with_metadata_hint=${labelAudit.with_metadata_hint})`);
    
    // ========================================
    // STEP 4: Upsert trend events and evidence in BATCHES
    // ========================================
    currentPhase = 'upsert_events';
    
    // Emergency flush: if near timeout, flush a smaller priority batch (breaking + high rank_score first)
    let eventsToProcess = eventsToUpsert;
    if (shouldExitEarly()) {
      console.warn(`[detect-trend-events] ⚠️ Near timeout before upsert - triggering emergency flush`);
      // Prioritize breaking events and top rank_score events
      const priorityEvents = eventsToUpsert
        .sort((a, b) => {
          // Breaking first
          if (a.is_breaking && !b.is_breaking) return -1;
          if (!a.is_breaking && b.is_breaking) return 1;
          // Then by rank_score descending
          return (b.rank_score || 0) - (a.rank_score || 0);
        })
        .slice(0, 50); // Flush top 50 priority events
      
      console.log(`[detect-trend-events] 🚨 Emergency flush: ${priorityEvents.length} priority events (${priorityEvents.filter(e => e.is_breaking).length} breaking)`);
      eventsToProcess = priorityEvents;
    }
    
    const eventIdMap = new Map<string, string>();
    let totalUpserted = 0;
    
    if (eventsToProcess.length > 0) {
      // BATCH UPSERT: Process events in chunks to avoid payload limits and reduce CPU
      for (let i = 0; i < eventsToProcess.length; i += PERF_LIMITS.UPSERT_BATCH_SIZE) {
        const batch = eventsToProcess.slice(i, i + PERF_LIMITS.UPSERT_BATCH_SIZE);
        
        const { data: upsertedEvents, error: upsertError } = await supabase
          .from('trend_events')
          .upsert(batch, { onConflict: 'event_key' })
          .select('id, event_key');
        
        if (upsertError) {
          console.error(`[detect-trend-events] Error upserting batch ${i / PERF_LIMITS.UPSERT_BATCH_SIZE + 1}:`, upsertError.message);
        } else {
          totalUpserted += upsertedEvents?.length || 0;
          // Count breaking events in this batch for verification
          const breakingInBatch = batch.filter(e => e.is_breaking === true).length;
          if (breakingInBatch > 0) {
            console.log(`[detect-trend-events] ✅ BREAKING PERSISTED: ${breakingInBatch} breaking events in batch ${Math.floor(i / PERF_LIMITS.UPSERT_BATCH_SIZE) + 1}`);
          }
          for (const e of upsertedEvents || []) {
            eventIdMap.set(e.event_key, e.id);
          }
        }
        
        // Check timeout after each batch
        if (shouldExitEarly()) {
          console.warn(`[detect-trend-events] ⚠️ Timeout guard during upsert - ${totalUpserted} events persisted, ${eventsToProcess.length - i - batch.length} remaining`);
          break;
        }
      }
      
      // Post-upsert verification: count breaking events saved
      const totalBreakingSaved = eventsToProcess.slice(0, totalUpserted).filter(e => e.is_breaking === true).length;
      console.log(`[detect-trend-events] Upserted ${totalUpserted} trend events in batches of ${PERF_LIMITS.UPSERT_BATCH_SIZE}`);
      console.log(`[detect-trend-events] ✅ BREAKING VERIFICATION: ${totalBreakingSaved} breaking events persisted to DB`);
      
      // BATCH INSERT EVIDENCE
      currentPhase = 'insert_evidence';
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
          source_tier: e.source_tier,
        }));
      
      if (resolvedEvidence.length > 0 && !shouldExitEarly()) {
        // Delete old evidence for these events first
        const eventIds = Array.from(new Set(resolvedEvidence.map(e => e.event_id)));
        
        // Delete in batches to avoid too large IN clause
        for (let i = 0; i < eventIds.length; i += 100) {
          const batchIds = eventIds.slice(i, i + 100);
          await supabase
            .from('trend_evidence')
            .delete()
            .in('event_id', batchIds);
        }
        
        // Insert evidence in batches
        for (let i = 0; i < resolvedEvidence.length; i += 200) {
          const batch = resolvedEvidence.slice(i, i + 200);
          const { error: evidenceError } = await supabase
            .from('trend_evidence')
            .insert(batch);
          
          if (evidenceError) {
            console.error(`[detect-trend-events] Error inserting evidence batch:`, evidenceError.message);
          }
          
          if (shouldExitEarly()) break;
        }
        
        console.log(`[detect-trend-events] Inserted ${resolvedEvidence.length} evidence records in batches`);
      }
    }
    
    // ========================================
    // STEP 4.5: Upsert phrase clusters (skip if near timeout)
    // ========================================
    currentPhase = 'upsert_clusters';
    const multiMemberClusters = Array.from(clusters.values()).filter(c => c.memberKeys.size > 1);
    
    if (!shouldExitEarly() && multiMemberClusters.length > 0) {
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
    } else if (shouldExitEarly()) {
      console.warn('[detect-trend-events] ⚠️ Skipping cluster upsert due to timeout guard');
    }
    
    // ========================================
    // STEP 5: Update baselines for today (skip if near timeout)
    // ========================================
    currentPhase = 'update_baselines';
    if (!shouldExitEarly()) {
      const baselineUpdates = eventsToUpsert.slice(0, 200).map(e => {
        const stats = baselineStatsByKey.get(e.event_key);
        return ({
          event_key: e.event_key,
          baseline_date: today,
          mentions_count: e.current_24h,
          hourly_average: e.current_24h / PERF_LIMITS.TIME_WINDOW_HOURS, // Use actual time window
          hourly_std_dev: stats?.hourlyStdDev || 0,
          relative_std_dev: stats?.relativeStdDev || 0,
          news_mentions: (topicMap.get(e.event_key)?.by_source_deduped.rss || 0) + 
                         (topicMap.get(e.event_key)?.by_source_deduped.google_news || 0),
          social_mentions: topicMap.get(e.event_key)?.by_source_deduped.bluesky || 0,
        });
      });
      
      if (baselineUpdates.length > 0) {
        await supabase
          .from('trend_baselines')
          .upsert(baselineUpdates, { onConflict: 'event_key,baseline_date' });
        
        console.log(`[detect-trend-events] Updated ${baselineUpdates.length} baseline records for ${today}`);
      }
    } else {
      console.warn('[detect-trend-events] ⚠️ Skipping baseline update due to timeout guard');
    }
    
    currentPhase = 'complete';
    const duration = Date.now() - startTime;
    
    const result = {
      success: true,
      topics_processed: topicMap.size,
      events_upserted: totalUpserted,  // Use actual count, not array length
      trending_count: trendingCount,
      breaking_count: breakingCount,
      quality_gate_filtered: qualityGateFiltered,
      evidence_count: evidenceToInsert.length,
      clusters_created: multiMemberClusters.length,
      deduped_savings: dedupedSavings,
      baselines_loaded: rollingBaselines.size,
      duration_ms: duration,
      perf_limits: PERF_LIMITS, // Include limits in response for monitoring
    };
    
    console.log('[detect-trend-events] ✅ Complete:', JSON.stringify(result));
    
    // Phase C: Alert when no breaking events detected during active news cycle
    if (breakingCount === 0 && trendingCount >= 5) {
      console.warn(`[detect-trend-events] ⚠️ No breaking events detected despite ${trendingCount} trending topics - may need threshold review`);
    } else if (breakingCount > 0) {
      console.log(`[detect-trend-events] ✅ ${breakingCount} breaking events detected`);
    }
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[detect-trend-events] ❌ Error at phase "${currentPhase}" after ${duration}ms:`, error.message);
    await logJobFailure(supabase, 'detect-trend-events', `${currentPhase}: ${error.message}`);
    
    return new Response(JSON.stringify({ 
      error: error.message, 
      phase: currentPhase,
      duration_ms: duration 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

