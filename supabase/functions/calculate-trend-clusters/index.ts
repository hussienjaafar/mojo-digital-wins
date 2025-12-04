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
  entity_type: string;
  hashtags: string[];
}

// Entity type classification with specificity scores
// Higher score = more specific = ranked higher
const ENTITY_SPECIFICITY: Record<string, number> = {
  person: 3.0,      // Named individuals (most specific)
  event: 2.5,       // Specific events, arrests, rulings
  hashtag: 2.5,     // Campaign hashtags
  organization: 2.0, // FBI, DOJ, specific orgs
  location: 1.8,    // States, cities
  legislation: 1.5, // Bills, laws
  category: 1.0,    // Generic topics (least specific)
};

// Known person names for entity classification
const KNOWN_PERSONS = new Set([
  'trump', 'biden', 'harris', 'obama', 'pence', 'desantis', 'newsom',
  'pelosi', 'mcconnell', 'schumer', 'cruz', 'sanders', 'warren', 'aoc',
  'ocasio-cortez', 'gaetz', 'greene', 'boebert', 'jordan', 'mccarthy',
  'cheney', 'romney', 'manchin', 'sinema', 'fetterman', 'warnock',
  'kash patel', 'brian cole', 'jack smith', 'merrick garland', 'alito',
  'thomas', 'roberts', 'kavanaugh', 'gorsuch', 'barrett', 'sotomayor',
  'kagan', 'jackson', 'musk', 'zuckerberg', 'bezos'
]);

// Known organizations
const KNOWN_ORGS = new Set([
  'fbi', 'doj', 'cia', 'nsa', 'dhs', 'ice', 'cbp', 'atf', 'dea',
  'supreme court', 'congress', 'senate', 'house', 'white house',
  'pentagon', 'state department', 'treasury', 'federal reserve',
  'nato', 'un', 'eu', 'who', 'cdc', 'fda', 'epa', 'sec',
  'democratic party', 'republican party', 'gop', 'dnc', 'rnc'
]);

// Event indicators (keywords that suggest a specific event)
const EVENT_INDICATORS = [
  'arrest', 'arrested', 'indictment', 'indicted', 'verdict', 'ruling',
  'shooting', 'attack', 'bombing', 'explosion', 'crash', 'fire',
  'resignation', 'fired', 'dies', 'death', 'killed', 'murder',
  'election', 'primary', 'debate', 'rally', 'protest', 'riot',
  'hearing', 'testimony', 'trial', 'sentencing', 'appeal',
  'summit', 'meeting', 'conference', 'speech', 'announcement',
  'scandal', 'leak', 'breach', 'hack', 'exposed'
];

// Location indicators
const LOCATION_PATTERNS = [
  /^[A-Z][a-z]+\s+(?:County|State|City)$/,
  /^(?:North|South|East|West)\s+[A-Z][a-z]+$/,
];

const US_STATES = new Set([
  'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado',
  'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho',
  'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana',
  'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota',
  'mississippi', 'missouri', 'montana', 'nebraska', 'nevada',
  'new hampshire', 'new jersey', 'new mexico', 'new york',
  'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon',
  'pennsylvania', 'rhode island', 'south carolina', 'south dakota',
  'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington',
  'west virginia', 'wisconsin', 'wyoming', 'dc', 'washington dc'
]);

// Classify entity type based on topic name and context
function classifyEntityType(topic: string, headlines: string[]): string {
  const lowerTopic = topic.toLowerCase();
  const headlineText = headlines.join(' ').toLowerCase();
  
  // Check if it's a hashtag
  if (topic.startsWith('#')) {
    return 'hashtag';
  }
  
  // IMPORTANT: Check organizations BEFORE person patterns
  for (const org of KNOWN_ORGS) {
    if (lowerTopic === org || lowerTopic.includes(org)) {
      return 'organization';
    }
  }
  
  // Check if it's a known person
  for (const person of KNOWN_PERSONS) {
    if (lowerTopic.includes(person)) {
      return 'person';
    }
  }
  
  // Check for person-like patterns (First Last, title patterns)
  const personPatterns = [
    /^[A-Z][a-z]+\s+[A-Z][a-z]+$/, // First Last
    /^(?:President|Senator|Rep\.|Gov\.|Mayor|Judge|Justice)\s+/i,
    /^[A-Z][a-z]+\s+[A-Z]\.\s+[A-Z][a-z]+$/, // First M. Last
  ];
  for (const pattern of personPatterns) {
    if (pattern.test(topic)) {
      return 'person';
    }
  }
  
  // Check if it's a known organization
  for (const org of KNOWN_ORGS) {
    if (lowerTopic === org || lowerTopic.includes(org)) {
      return 'organization';
    }
  }
  
  // Check for event indicators in headlines
  for (const indicator of EVENT_INDICATORS) {
    if (headlineText.includes(indicator)) {
      // If topic appears with event indicator, likely an event
      if (headlineText.includes(lowerTopic) && headlineText.includes(indicator)) {
        return 'event';
      }
    }
  }
  
  // Check for location
  if (US_STATES.has(lowerTopic)) {
    return 'location';
  }
  for (const pattern of LOCATION_PATTERNS) {
    if (pattern.test(topic)) {
      return 'location';
    }
  }
  
  // Check for legislation patterns
  if (/^(?:H\.R\.|S\.|HR|SB)\s*\d+/i.test(topic) || 
      lowerTopic.includes(' act') || 
      lowerTopic.includes(' bill')) {
    return 'legislation';
  }
  
  // Default to category
  return 'category';
}

// Extract hashtags from text
function extractHashtags(text: string): string[] {
  const hashtags: string[] = [];
  const hashtagRegex = /#[A-Za-z][A-Za-z0-9_]{2,30}/g;
  const matches = text.match(hashtagRegex);
  if (matches) {
    for (const match of matches) {
      if (!hashtags.includes(match)) {
        hashtags.push(match);
      }
    }
  }
  return hashtags;
}

// Detect if topic is breaking news
function isBreakingNews(
  velocity: number,
  crossSourceScore: number,
  firstSeen: Date,
  now: Date
): boolean {
  const hoursOld = (now.getTime() - firstSeen.getTime()) / (1000 * 60 * 60);
  
  return (
    (velocity > 200 && hoursOld < 6) ||  // High velocity spike in last 6 hours
    (velocity > 100 && crossSourceScore >= 3 && hoursOld < 12) ||  // Multi-source confirmation
    (velocity > 300)  // Extreme velocity
  );
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

    console.log('Calculating cross-source trend clusters with entity classification...');
    
    const topicMap = new Map<string, TopicData>();
    const hashtagMap = new Map<string, TopicData>(); // Separate map for hashtags
    const now = new Date();
    const hour1Ago = new Date(now.getTime() - 60 * 60 * 1000);
    const hours6Ago = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const hours24Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Helper to normalize topic names (preserve case for proper nouns)
    const normalizeTopic = (topic: string): string => {
      if (!topic || typeof topic !== 'string') return '';
      const trimmed = topic.trim();
      if (trimmed.startsWith('#')) {
        // Keep hashtags as-is but normalized
        return trimmed.toLowerCase();
      }
      return trimmed
        .replace(/[^\w\s'-]/g, '')
        .trim()
        .split(/\s+/)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    };
    
    // Helper to initialize topic data
    const initTopicData = (topic: string, timestamp: Date): TopicData => ({
      topic,
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
      first_seen: timestamp,
      last_seen: timestamp,
      entity_type: 'category',
      hashtags: []
    });
    
    // Process hashtags from text
    const processHashtags = (text: string, itemId: string, source: 'google_news' | 'bluesky' | 'rss', timestamp: Date, sentimentLabel?: string) => {
      const hashtags = extractHashtags(text);
      for (const hashtag of hashtags) {
        const normalized = hashtag.toLowerCase();
        if (!hashtagMap.has(normalized)) {
          hashtagMap.set(normalized, initTopicData(hashtag, timestamp));
          hashtagMap.get(normalized)!.entity_type = 'hashtag';
        }
        
        const data = hashtagMap.get(normalized)!;
        if (source === 'google_news') {
          data.google_news_count++;
          data.google_news_ids.push(itemId);
        } else if (source === 'bluesky') {
          data.bluesky_count++;
          data.bluesky_ids.push(itemId);
        } else {
          data.rss_count++;
          data.article_ids.push(itemId);
        }
        data.total_count++;
        
        if (sentimentLabel === 'positive') data.sentiment_counts.positive++;
        else if (sentimentLabel === 'negative') data.sentiment_counts.negative++;
        else data.sentiment_counts.neutral++;
        
        if (timestamp < data.first_seen) data.first_seen = timestamp;
        if (timestamp > data.last_seen) data.last_seen = timestamp;
      }
    };
    
    // Aggregate Google News topics (last 24h)
    const { data: newsData } = await supabase
      .from('google_news_articles')
      .select('id, title, description, ai_topics, ai_sentiment, ai_sentiment_label, published_at')
      .eq('ai_processed', true)
      .gte('published_at', hours24Ago.toISOString())
      .not('ai_topics', 'is', null);
    
    if (newsData) {
      for (const item of newsData) {
        // Extract hashtags from title and description
        processHashtags(
          `${item.title} ${item.description || ''}`,
          item.id,
          'google_news',
          new Date(item.published_at),
          item.ai_sentiment_label
        );
        
        for (const topic of (item.ai_topics || [])) {
          const normalized = normalizeTopic(topic);
          if (!normalized || normalized.length < 3) continue;
          
          if (!topicMap.has(normalized)) {
            topicMap.set(normalized, initTopicData(normalized, new Date(item.published_at)));
          }
          
          const data = topicMap.get(normalized)!;
          data.google_news_count++;
          data.total_count++;
          data.google_news_ids.push(item.id);
          
          if (data.sample_headlines.length < 5) {
            data.sample_headlines.push(item.title);
          }
          
          if (item.ai_sentiment_label === 'positive') data.sentiment_counts.positive++;
          else if (item.ai_sentiment_label === 'negative') data.sentiment_counts.negative++;
          else data.sentiment_counts.neutral++;
          
          const pubDate = new Date(item.published_at);
          if (pubDate < data.first_seen) data.first_seen = pubDate;
          if (pubDate > data.last_seen) data.last_seen = pubDate;
        }
      }
    }
    
    // Aggregate Reddit topics (keeping for future, but will be empty)
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
            topicMap.set(normalized, initTopicData(normalized, new Date(item.created_utc)));
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
      .select('id, text, ai_topics, ai_sentiment, ai_sentiment_label, created_at, hashtags')
      .eq('ai_processed', true)
      .gte('created_at', hours24Ago.toISOString())
      .not('ai_topics', 'is', null);
    
    if (blueskyData) {
      for (const item of blueskyData) {
        // Process hashtags from text and existing hashtags array
        processHashtags(
          item.text || '',
          item.id,
          'bluesky',
          new Date(item.created_at),
          item.ai_sentiment_label
        );
        
        // Also process stored hashtags
        if (item.hashtags && Array.isArray(item.hashtags)) {
          for (const ht of item.hashtags) {
            const normalized = ht.toLowerCase().startsWith('#') ? ht.toLowerCase() : `#${ht.toLowerCase()}`;
            if (!hashtagMap.has(normalized)) {
              hashtagMap.set(normalized, initTopicData(ht, new Date(item.created_at)));
              hashtagMap.get(normalized)!.entity_type = 'hashtag';
            }
            const data = hashtagMap.get(normalized)!;
            data.bluesky_count++;
            data.bluesky_ids.push(item.id);
            data.total_count++;
          }
        }
        
        for (const topic of (item.ai_topics || [])) {
          const normalized = normalizeTopic(topic);
          if (!normalized || normalized.length < 3) continue;
          
          if (!topicMap.has(normalized)) {
            topicMap.set(normalized, initTopicData(normalized, new Date(item.created_at)));
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
      .select('id, title, description, extracted_topics, sentiment_score, sentiment_label, published_date')
      .gte('published_date', hours24Ago.toISOString())
      .not('extracted_topics', 'is', null);
    
    if (rssData) {
      for (const item of rssData) {
        // Extract hashtags from title and description
        processHashtags(
          `${item.title} ${item.description || ''}`,
          item.id,
          'rss',
          new Date(item.published_date),
          item.sentiment_label
        );
        
        const topics = Array.isArray(item.extracted_topics) 
          ? item.extracted_topics 
          : (item.extracted_topics as any)?.topics || [];
          
        for (const topic of topics) {
          const topicStr = typeof topic === 'string' ? topic : topic?.topic || topic?.name || '';
          const normalized = normalizeTopic(topicStr);
          if (!normalized || normalized.length < 3) continue;
          
          if (!topicMap.has(normalized)) {
            topicMap.set(normalized, initTopicData(normalized, new Date(item.published_date)));
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
    
    // Merge hashtags into main topic map
    for (const [key, data] of hashtagMap) {
      if (!topicMap.has(key)) {
        topicMap.set(key, data);
      } else {
        // Merge counts
        const existing = topicMap.get(key)!;
        existing.google_news_count += data.google_news_count;
        existing.bluesky_count += data.bluesky_count;
        existing.rss_count += data.rss_count;
        existing.total_count += data.total_count;
        existing.entity_type = 'hashtag'; // Prioritize hashtag classification
      }
    }
    
    // Classify entity types and calculate specificity scores
    for (const [key, data] of topicMap) {
      if (data.entity_type !== 'hashtag') {
        data.entity_type = classifyEntityType(data.topic, data.sample_headlines);
      }
    }
    
    // Build co-occurrence map for "Trending with" feature
    const coOccurrenceMap = new Map<string, Map<string, number>>();
    
    // Track which topics appear together in the same articles
    const buildCoOccurrence = (articleTopics: string[]) => {
      for (const topic1 of articleTopics) {
        if (!coOccurrenceMap.has(topic1)) {
          coOccurrenceMap.set(topic1, new Map());
        }
        for (const topic2 of articleTopics) {
          if (topic1 !== topic2) {
            const count = coOccurrenceMap.get(topic1)!.get(topic2) || 0;
            coOccurrenceMap.get(topic1)!.set(topic2, count + 1);
          }
        }
      }
    };
    
    // Process co-occurrences from news data
    if (newsData) {
      for (const item of newsData) {
        const topics = (item.ai_topics || []).map((t: string) => normalizeTopic(t)).filter((t: string) => t.length >= 3);
        buildCoOccurrence(topics);
      }
    }
    
    // Process co-occurrences from RSS data
    if (rssData) {
      for (const item of rssData) {
        const topics = Array.isArray(item.extracted_topics) 
          ? item.extracted_topics 
          : (item.extracted_topics as any)?.topics || [];
        const normalizedTopics = topics
          .map((t: any) => normalizeTopic(typeof t === 'string' ? t : t?.topic || t?.name || ''))
          .filter((t: string) => t.length >= 3);
        buildCoOccurrence(normalizedTopics);
      }
    }
    
    // Filter and process top topics with specificity-weighted ranking
    const significantTopics = Array.from(topicMap.values())
      .filter(t => t.total_count >= 3) // Minimum mentions
      .map(t => {
        const specificityScore = ENTITY_SPECIFICITY[t.entity_type] || 1.0;
        const crossSourceBonus = (
          (t.google_news_count > 0 ? 1 : 0) +
          (t.reddit_count > 0 ? 1 : 0) +
          (t.bluesky_count > 0 ? 1 : 0) +
          (t.rss_count > 0 ? 1 : 0)
        ) * 0.5;
        
        // Calculate ranking score: Volume × Specificity × CrossSource
        const rankScore = t.total_count * specificityScore * (1 + crossSourceBonus);
        
        // Get related topics from co-occurrence
        const relatedMap = coOccurrenceMap.get(t.topic);
        const relatedTopics = relatedMap 
          ? Array.from(relatedMap.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([topic]) => topic)
          : [];
        
        return { ...t, specificityScore, rankScore, relatedTopics };
      })
      .sort((a, b) => b.rankScore - a.rankScore)
      .slice(0, 100); // Top 100 topics
    
    console.log(`Found ${significantTopics.length} significant topics`);
    
    // Log entity type distribution
    const entityTypeCounts: Record<string, number> = {};
    for (const t of significantTopics) {
      entityTypeCounts[t.entity_type] = (entityTypeCounts[t.entity_type] || 0) + 1;
    }
    console.log('Entity type distribution:', entityTypeCounts);
    
    // Calculate velocity and create/update clusters
    let clustersUpdated = 0;
    let breakingCount = 0;
    
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
      
      // Is trending? (with specificity boost)
      const specificityBoost = topicData.specificityScore >= 2.0;
      const isTrending = (velocity > 30 && mentions24h >= 5) || 
                         (crossSourceScore >= 3 && mentions24h >= 10) ||
                         (specificityBoost && velocity > 20 && mentions24h >= 3) ||
                         mentions1h >= 5;
      
      // Check for breaking news
      const isBreaking = isBreakingNews(velocity, crossSourceScore, topicData.first_seen, now);
      if (isBreaking) breakingCount++;
      
      // Collect related hashtags and related topics
      const relatedHashtags = topicData.hashtags.slice(0, 10);
      const relatedTopicsList = topicData.relatedTopics || [];
      
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
              model: 'google/gemini-2.5-flash-lite',
              messages: [
                {
                  role: 'system',
                  content: 'Create a 1-sentence news summary from these headlines. Be SPECIFIC about names, events, and what happened. Never be generic.'
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
      
      // Upsert cluster with new fields
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
          // New fields
          entity_type: topicData.entity_type,
          specificity_score: topicData.specificityScore,
          hashtags: relatedHashtags,
          is_hashtag: topicData.entity_type === 'hashtag',
          is_breaking: isBreaking,
          related_topics: relatedTopicsList,
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
      breaking_topics: breakingCount,
      entity_distribution: entityTypeCounts,
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
