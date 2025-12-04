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

// Topic aliasing system to unify variations
// Maps variations to canonical names
// Use '__SKIP__' to mark fragment words that should be ignored
const TOPIC_ALIASES: Record<string, string> = {
  // Trump variations
  'trump': 'Donald Trump',
  '#trump': 'Donald Trump',
  '#donaldtrump': 'Donald Trump',
  'president trump': 'Donald Trump',
  'former president trump': 'Donald Trump',
  'trump administration': 'Donald Trump',
  
  // MAGA (keep as related to Trump but separate concept)
  'maga': 'MAGA',
  '#maga': 'MAGA',
  
  // Biden variations
  'biden': 'Joe Biden',
  '#biden': 'Joe Biden',
  '#joebiden': 'Joe Biden',
  'president biden': 'Joe Biden',
  'biden administration': 'Joe Biden',
  
  // Harris variations
  'harris': 'Kamala Harris',
  '#harris': 'Kamala Harris',
  '#kamalaharris': 'Kamala Harris',
  'vp harris': 'Kamala Harris',
  'vice president harris': 'Kamala Harris',
  
  // Musk variations
  'musk': 'Elon Musk',
  '#musk': 'Elon Musk',
  '#elonmusk': 'Elon Musk',
  
  // Supreme Court variations
  'scotus': 'Supreme Court',
  '#scotus': 'Supreme Court',
  '#supremecourt': 'Supreme Court',
  
  // Government agencies (normalize casing)
  'fbi': 'FBI',
  '#fbi': 'FBI',
  'doj': 'DOJ',
  '#doj': 'DOJ',
  'cia': 'CIA',
  '#cia': 'CIA',
  'ice': 'ICE',
  '#ice': 'ICE',
  'dhs': 'DHS',
  '#dhs': 'DHS',
  
  // Congress variations
  '#congress': 'Congress',
  '#senate': 'Senate',
  '#house': 'House',
  'house of representatives': 'House',
  
  // GOP/Republican variations
  'gop': 'Republican Party',
  '#gop': 'Republican Party',
  'republicans': 'Republican Party',
  '#republicans': 'Republican Party',
  'republican': 'Republican Party',
  
  // Democratic Party variations
  'democrats': 'Democratic Party',
  '#democrats': 'Democratic Party',
  'democrat': 'Democratic Party',
  '#democrat': 'Democratic Party',
  
  // White House
  '#whitehouse': 'White House',
  'the white house': 'White House',
  'whitehouse': 'White House',
  
  // Key figures
  'desantis': 'Ron DeSantis',
  '#desantis': 'Ron DeSantis',
  'newsom': 'Gavin Newsom',
  '#newsom': 'Gavin Newsom',
  'pence': 'Mike Pence',
  '#pence': 'Mike Pence',
  'obama': 'Barack Obama',
  '#obama': 'Barack Obama',
  'pelosi': 'Nancy Pelosi',
  '#pelosi': 'Nancy Pelosi',
  'mcconnell': 'Mitch McConnell',
  '#mcconnell': 'Mitch McConnell',
  'schumer': 'Chuck Schumer',
  '#schumer': 'Chuck Schumer',
  
  // Current news figures
  'hegseth': 'Pete Hegseth',
  '#hegseth': 'Pete Hegseth',
  'kash patel': 'Kash Patel',
  '#kashpatel': 'Kash Patel',
  'wray': 'Christopher Wray',
  '#wray': 'Christopher Wray',
  'chris wray': 'Christopher Wray',
  'brian cole': 'Brian Cole',
  '#briancole': 'Brian Cole',
  
  // Israel/Gaza related
  '#israel': 'Israel',
  '#gaza': 'Gaza',
  '#palestine': 'Palestine',
  '#hamas': 'Hamas',
  '#ceasefire': 'Ceasefire',
  
  // Ukraine/Russia related
  '#ukraine': 'Ukraine',
  '#russia': 'Russia',
  '#putin': 'Vladimir Putin',
  'putin': 'Vladimir Putin',
  'zelensky': 'Volodymyr Zelensky',
  '#zelensky': 'Volodymyr Zelensky',
  
  // Events
  'eurovision': 'Eurovision Song Contest',
  '#eurovision': 'Eurovision Song Contest',
  'eurovision song contest': 'Eurovision Song Contest',
  
  // === FRAGMENT WORDS TO SKIP ===
  // These single words are parts of longer phrases and should be ignored
  'york': '__SKIP__',
  'white': '__SKIP__',
  'supreme': '__SKIP__',
  'department': '__SKIP__',
  'new': '__SKIP__',
  'san': '__SKIP__',
  'los': '__SKIP__',
  'las': '__SKIP__',
  'mount': '__SKIP__',
  'saint': '__SKIP__',
  'fort': '__SKIP__',
  'port': '__SKIP__',
  'north': '__SKIP__',
  'south': '__SKIP__',
  'east': '__SKIP__',
  'west': '__SKIP__',
};

// Hashtag to base topic mapping (for merging hashtag counts into main topics)
const HASHTAG_TO_TOPIC: Record<string, string> = {
  '#trump': 'Donald Trump',
  '#donaldtrump': 'Donald Trump',
  '#maga': 'Donald Trump',
  '#biden': 'Joe Biden',
  '#joebiden': 'Joe Biden',
  '#harris': 'Kamala Harris',
  '#kamalaharris': 'Kamala Harris',
  '#musk': 'Elon Musk',
  '#elonmusk': 'Elon Musk',
  '#scotus': 'Supreme Court',
  '#supremecourt': 'Supreme Court',
  '#fbi': 'FBI',
  '#doj': 'DOJ',
  '#cia': 'CIA',
  '#ice': 'ICE',
  '#congress': 'Congress',
  '#senate': 'Senate',
  '#house': 'House',
  '#whitehouse': 'White House',
  '#gop': 'Republican Party',
  '#democrats': 'Democratic Party',
  '#israel': 'Israel',
  '#gaza': 'Gaza',
  '#palestine': 'Palestine',
  '#hamas': 'Hamas',
  '#ukraine': 'Ukraine',
  '#russia': 'Russia',
  '#putin': 'Vladimir Putin',
  '#zelensky': 'Volodymyr Zelensky',
  '#hegseth': 'Pete Hegseth',
  '#desantis': 'Ron DeSantis',
  '#newsom': 'Gavin Newsom',
};

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
  'kagan', 'jackson', 'musk', 'zuckerberg', 'bezos', 'hegseth', 'wray'
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

// Known countries for location classification
const COUNTRIES = new Set([
  'ukraine', 'russia', 'israel', 'gaza', 'palestine', 'china', 'iran', 'syria',
  'venezuela', 'canada', 'mexico', 'germany', 'france', 'spain', 'italy',
  'japan', 'india', 'brazil', 'australia', 'uk', 'united kingdom', 'ireland',
  'netherlands', 'rwanda', 'lebanon', 'yemen', 'iraq', 'afghanistan', 'taiwan',
  'korea', 'egypt', 'turkey', 'poland', 'romania', 'hungary', 'greece', 'portugal',
  'sweden', 'norway', 'denmark', 'finland', 'switzerland', 'austria', 'belgium',
  'cuba', 'haiti', 'jamaica', 'colombia', 'peru', 'chile', 'argentina',
  'philippines', 'indonesia', 'vietnam', 'thailand', 'malaysia', 'singapore',
  'pakistan', 'bangladesh', 'nigeria', 'kenya', 'ethiopia', 'sudan', 'libya'
]);

// Known acronyms that are always valid as single words
const KNOWN_ACRONYMS = new Set([
  'FBI', 'CIA', 'DOJ', 'ICE', 'NATO', 'EU', 'UN', 'CDC', 'FDA', 'EPA', 'SEC',
  'NSA', 'DHS', 'CBP', 'ATF', 'DEA', 'MAGA', 'GOP', 'DNC', 'RNC', 'IRS', 'FCC',
  'FTC', 'USPS', 'NASA', 'FEMA', 'TSA', 'DEA', 'ATF', 'NIH', 'WHO', 'IMF'
]);

// Generic single words that should be blocked unless cross-source confirmed
const BLOCKED_SINGLE_WORDS = new Set([
  'Security', 'Education', 'Committee', 'York', 'National', 'Black', 'High',
  'Good', 'Maybe', 'Please', 'Yeah', 'Additional', 'Song', 'Depth', 'Christmas',
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December', 'Monday', 'Tuesday', 'Wednesday',
  'Thursday', 'Friday', 'Saturday', 'Sunday', 'American', 'President', 'White',
  'Supreme', 'Department', 'Law', 'Bill', 'Government', 'Politics', 'World',
  'Today', 'Week', 'Year', 'Month', 'People', 'Time', 'Way', 'Day', 'Night',
  'Morning', 'Thing', 'Place', 'Question', 'Answer', 'Problem', 'Issue', 'Point',
  'Fact', 'Story', 'Group', 'Family', 'Area', 'System', 'Program', 'Service',
  'Money', 'State', 'Country', 'Company', 'Business', 'Life', 'Work', 'Word',
  'Health', 'Science', 'History', 'Art', 'Music', 'Sports', 'Tech', 'Home',
  'House', 'Building', 'Street', 'Road', 'City', 'Town', 'Federal', 'Institute',
  'Details', 'Report', 'Snow', 'Precip', 'Link', 'Court', 'Party', 'Vote', 'News',
  'Every', 'First', 'Well', 'Thank', 'Missing', 'States', 'United', 'European',
  'Russian', 'Israeli', 'Chinese', 'James', 'John', 'Michael', 'David', 'Robert'
]);

// === TOPIC QUALITY GATE ===
// Filters out low-quality topics before saving to database
function isHighQualityTopic(
  topic: string,
  entityType: string,
  crossSourceCount: number,
  totalMentions: number
): { pass: boolean; reason?: string } {
  // 1. Block all "category" type entities (generic words)
  if (entityType === 'category') {
    return { pass: false, reason: 'category-type' };
  }
  
  // 2. Single-word topics need extra validation
  if (!topic.includes(' ')) {
    // Allow known acronyms
    if (KNOWN_ACRONYMS.has(topic)) {
      return { pass: true };
    }
    
    // Allow known countries/states as locations
    if (entityType === 'location') {
      return { pass: true };
    }
    
    // Block known bad single words
    if (BLOCKED_SINGLE_WORDS.has(topic)) {
      return { pass: false, reason: 'blocked-single-word' };
    }
    
    // Single words need cross-source confirmation OR high volume
    if (crossSourceCount < 2 && totalMentions < 50) {
      return { pass: false, reason: 'single-word-not-confirmed' };
    }
  }
  
  // 3. Very short topics are suspicious
  if (topic.length < 4 && !KNOWN_ACRONYMS.has(topic)) {
    return { pass: false, reason: 'too-short' };
  }
  
  // 4. Topics with only numbers are not useful
  if (/^\d+$/.test(topic)) {
    return { pass: false, reason: 'numbers-only' };
  }
  
  return { pass: true };
}

// Classify entity type based on topic name and context
function classifyEntityType(topic: string, headlines: string[]): string {
  const lowerTopic = topic.toLowerCase();
  const headlineText = headlines.join(' ').toLowerCase();
  
  // Check if it's a hashtag
  if (topic.startsWith('#')) {
    return 'hashtag';
  }
  
  // PRIORITY 1: Check countries FIRST (before other checks)
  if (COUNTRIES.has(lowerTopic)) {
    return 'location';
  }
  
  // PRIORITY 2: Check US states
  if (US_STATES.has(lowerTopic)) {
    return 'location';
  }
  
  // Check if it's a known organization
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
  
  // Check for event indicators in headlines
  for (const indicator of EVENT_INDICATORS) {
    if (headlineText.includes(indicator)) {
      // If topic appears with event indicator, likely an event
      if (headlineText.includes(lowerTopic) && headlineText.includes(indicator)) {
        return 'event';
      }
    }
  }
  
  // Check for location patterns
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
  
  // Default to category (will be filtered by quality gate)
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

// Enhanced velocity calculation
interface VelocityMetrics {
  velocity1h: number;   // Current hour vs avg
  velocity6h: number;   // 6h window vs daily avg
  velocity24h: number;  // Overall velocity
  acceleration: number; // Change in velocity (speeding up or slowing down)
  trendStage: 'emerging' | 'surging' | 'peaking' | 'declining' | 'stable';
  peakHour: Date | null;
  spikeDetectedAt: Date | null;
}

function calculateEnhancedVelocity(
  mentions15m: number,
  mentions1h: number,
  mentions6h: number,
  mentions24h: number,
  previousVelocity: number | null,
  firstSeen: Date,
  now: Date
): VelocityMetrics {
  // Calculate rates at different windows
  const rate15m = mentions15m * 4; // Normalized to hourly
  const rate1h = mentions1h;
  const rate6h = mentions6h / 6;
  const rate24h = mentions24h / 24;
  
  // Calculate velocity at each window (% above/below average)
  const velocity1h = rate24h > 0 
    ? ((rate1h - rate24h) / rate24h) * 100 
    : (rate1h > 0 ? 500 : 0);
    
  const velocity6h = rate24h > 0 
    ? ((rate6h - rate24h) / rate24h) * 100 
    : (rate6h > 0 ? 300 : 0);
    
  const velocity24h = velocity1h; // Primary velocity metric
  
  // Calculate acceleration (change in velocity)
  // Compare 15-min rate extrapolated vs 1h rate
  const shortTermRate = rate15m;
  const mediumTermRate = rate1h;
  const acceleration = mediumTermRate > 0 
    ? ((shortTermRate - mediumTermRate) / mediumTermRate) * 100
    : (shortTermRate > 0 ? 100 : 0);
  
  // Determine trend stage based on velocity and acceleration
  let trendStage: VelocityMetrics['trendStage'] = 'stable';
  const hoursOld = (now.getTime() - firstSeen.getTime()) / (1000 * 60 * 60);
  
  if (velocity1h > 100 && acceleration > 50 && hoursOld < 3) {
    trendStage = 'emerging'; // New topic gaining fast
  } else if (velocity1h > 150 && acceleration > 20) {
    trendStage = 'surging'; // Strong upward momentum
  } else if (velocity1h > 100 && acceleration < -20) {
    trendStage = 'peaking'; // High but slowing down
  } else if (velocity1h < -20 || (velocity1h < 50 && acceleration < -30)) {
    trendStage = 'declining'; // Losing momentum
  } else if (velocity1h > 30) {
    trendStage = 'surging'; // Moderate but growing
  }
  
  // Detect spike (significant jump in recent window)
  let spikeDetectedAt: Date | null = null;
  if (rate15m > rate1h * 2 || (rate1h > rate6h * 1.5 && velocity1h > 100)) {
    spikeDetectedAt = now;
  }
  
  // Detect peak hour (when was activity highest?)
  let peakHour: Date | null = null;
  if (trendStage === 'peaking' || velocity1h > 100) {
    peakHour = now; // Mark current as peak if high velocity
  }
  
  return {
    velocity1h: Math.round(velocity1h * 100) / 100,
    velocity6h: Math.round(velocity6h * 100) / 100,
    velocity24h: Math.round(velocity24h * 100) / 100,
    acceleration: Math.round(acceleration * 100) / 100,
    trendStage,
    peakHour,
    spikeDetectedAt
  };
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

    console.log('Calculating cross-source trend clusters with hybrid entity resolution...');
    
    // Load entity aliases from database (hybrid resolution system)
    const dbAliases = new Map<string, string>();
    const { data: aliasData, error: aliasError } = await supabase
      .from('entity_aliases')
      .select('raw_name, canonical_name')
      .order('usage_count', { ascending: false });
    
    if (aliasData && !aliasError) {
      for (const alias of aliasData) {
        dbAliases.set(alias.raw_name.toLowerCase(), alias.canonical_name);
      }
      console.log(`Loaded ${dbAliases.size} entity aliases from database`);
    } else {
      console.log('Using hardcoded aliases only (db load failed):', aliasError?.message);
    }
    
    const topicMap = new Map<string, TopicData>();
    const hashtagMap = new Map<string, TopicData>(); // Separate map for hashtags
    const unresolvedEntities = new Set<string>(); // Track entities for potential resolution
    const now = new Date();
    const hour1Ago = new Date(now.getTime() - 60 * 60 * 1000);
    const hours6Ago = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const hours24Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Hybrid topic normalization: DB aliases > Hardcoded aliases > Standard normalization
    const normalizeTopic = (topic: string): string => {
      if (!topic || typeof topic !== 'string') return '';
      const trimmed = topic.trim();
      const lowerTrimmed = trimmed.toLowerCase();
      
      // Priority 1: Check database aliases (most up-to-date)
      if (dbAliases.has(lowerTrimmed)) {
        const alias = dbAliases.get(lowerTrimmed)!;
        // Handle skip markers
        if (alias === '__SKIP__') return '';
        return alias;
      }
      
      // Priority 2: Check hardcoded aliases (fallback)
      if (TOPIC_ALIASES[lowerTrimmed]) {
        const alias = TOPIC_ALIASES[lowerTrimmed];
        // Handle skip markers - these are fragment words that should be ignored
        if (alias === '__SKIP__') return '';
        return alias;
      }
      
      // Priority 3: Check hashtag mappings
      if (trimmed.startsWith('#')) {
        const hashLower = lowerTrimmed;
        // Check DB for hashtag
        if (dbAliases.has(hashLower)) {
          const alias = dbAliases.get(hashLower)!;
          if (alias === '__SKIP__') return '';
          return alias;
        }
        if (HASHTAG_TO_TOPIC[hashLower]) {
          return HASHTAG_TO_TOPIC[hashLower];
        }
        // For unmapped hashtags, keep as-is but lowercase
        return hashLower;
      }
      
      // Standard normalization for non-aliased topics
      const normalized = trimmed
        .replace(/[^\w\s'-]/g, '')
        .trim()
        .split(/\s+/)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
      
      // Check DB and hardcoded aliases after normalization
      const normalizedLower = normalized.toLowerCase();
      if (dbAliases.has(normalizedLower)) {
        const alias = dbAliases.get(normalizedLower)!;
        if (alias === '__SKIP__') return '';
        return alias;
      }
      if (TOPIC_ALIASES[normalizedLower]) {
        const alias = TOPIC_ALIASES[normalizedLower];
        if (alias === '__SKIP__') return '';
        return alias;
      }
      
      // Track unresolved entity for potential future resolution
      if (normalized.length >= 3 && /^[A-Z]/.test(normalized)) {
        unresolvedEntities.add(normalized);
      }
      
      return normalized;
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
    
    // ========================================
    // HYBRID KEYWORD DISCOVERY
    // Discover trending keywords from RAW TEXT to catch topics AI missed
    // This helps detect breaking news like "Eurovision", "Chris Wray", etc.
    // ========================================
    console.log('Starting hybrid keyword discovery...');
    
    try {
      // Call the SQL function to discover high-frequency keywords from raw text
      const { data: discoveredKeywords, error: keywordError } = await supabase
        .rpc('discover_trending_keywords', {
          time_window: '6 hours',
          min_frequency: 15  // Lower threshold to catch more trends
        });
      
      if (keywordError) {
        console.error('Keyword discovery error:', keywordError);
      } else if (discoveredKeywords && discoveredKeywords.length > 0) {
        console.log(`Discovered ${discoveredKeywords.length} potential trending keywords from raw text`);
        
        // Group by keyword (some appear from multiple sources)
        const keywordCounts = new Map<string, { totalFreq: number; sources: string[] }>();
        for (const kw of discoveredKeywords) {
          const normalized = normalizeTopic(kw.keyword);
          if (!normalized || normalized.length < 3) continue;
          
          if (!keywordCounts.has(normalized)) {
            keywordCounts.set(normalized, { totalFreq: 0, sources: [] });
          }
          const entry = keywordCounts.get(normalized)!;
          entry.totalFreq += Number(kw.frequency);
          if (!entry.sources.includes(kw.source_type)) {
            entry.sources.push(kw.source_type);
          }
        }
        
        // Process keywords - both NEW topics and BOOST existing AI-discovered topics
        let newKeywordsAdded = 0;
        let topicsBoosted = 0;
        const keywordsToProcess: string[] = [];
        const existingTopicsToBoost: string[] = [];
        
        // Priority topics to always boost with keyword counts (trending news topics)
        const priorityTopics = ['Eurovision', 'Obamacare', 'Christopher Wray', 'Brian Cole'];
        for (const pt of priorityTopics) {
          if (topicMap.has(pt)) {
            existingTopicsToBoost.push(pt);
          } else {
            keywordsToProcess.push(pt);
          }
        }
        
        for (const [keyword, info] of keywordCounts) {
          if (topicMap.has(keyword)) {
            // Existing topic - boost if from multiple sources or high frequency
            if (info.sources.length >= 2 || info.totalFreq >= 50) {
              existingTopicsToBoost.push(keyword);
            }
            continue;
          }
          
          // Skip generic single words
          if (!keyword.includes(' ') && info.sources.length === 1 && info.totalFreq < 30) {
            continue;
          }
          
          keywordsToProcess.push(keyword);
        }
        
        console.log(`Processing ${keywordsToProcess.length} new keywords, boosting ${existingTopicsToBoost.length} existing...`);
        
        // Boost existing topics with keyword-based counts
        const BATCH_SIZE = 15;
        for (let i = 0; i < existingTopicsToBoost.length; i += BATCH_SIZE) {
          const batch = existingTopicsToBoost.slice(i, i + BATCH_SIZE);
          await Promise.all(batch.map(async (keyword) => {
            try {
              const { data: counts } = await supabase.rpc('count_keyword_mentions', {
                search_keyword: keyword, time_window: '24 hours'
              });
              if (counts?.[0]) {
                const existing = topicMap.get(keyword)!;
                const keywordTotal = Number(counts[0].total_count) || 0;
                if (keywordTotal > existing.total_count) {
                  existing.bluesky_count = Math.max(existing.bluesky_count, Number(counts[0].bluesky_count) || 0);
                  existing.google_news_count = Math.max(existing.google_news_count, Number(counts[0].news_count) || 0);
                  existing.rss_count = Math.max(existing.rss_count, Number(counts[0].rss_count) || 0);
                  existing.total_count = keywordTotal;
                  topicsBoosted++;
                  console.log(`Boosted ${keyword}: AI=${existing.total_count} -> Keyword=${keywordTotal}`);
                }
              }
            } catch (err) { /* ignore */ }
          }));
        }
        
        // Add new keyword-discovered topics
        for (let i = 0; i < Math.min(keywordsToProcess.length, 30); i += BATCH_SIZE) {
          const batch = keywordsToProcess.slice(i, i + BATCH_SIZE);
          await Promise.all(batch.map(async (keyword) => {
            try {
              const { data: counts } = await supabase.rpc('count_keyword_mentions', {
                search_keyword: keyword, time_window: '24 hours'
              });
              if (counts?.[0] && Number(counts[0].total_count) >= 15) {
                const newData = initTopicData(keyword, new Date());
                newData.bluesky_count = Number(counts[0].bluesky_count) || 0;
                newData.google_news_count = Number(counts[0].news_count) || 0;
                newData.rss_count = Number(counts[0].rss_count) || 0;
                newData.total_count = Number(counts[0].total_count);
                newData.entity_type = classifyEntityType(keyword, []);
                topicMap.set(keyword, newData);
                newKeywordsAdded++;
                console.log(`Added: ${keyword} (${newData.total_count} mentions)`);
              }
            } catch (err) { /* ignore */ }
          }));
        }
        
        console.log(`Hybrid: ${newKeywordsAdded} new topics, ${topicsBoosted} boosted`);
      }
    } catch (hybridError) {
      console.error('Hybrid keyword discovery failed:', hybridError);
      // Continue with AI-discovered topics only
    }
    
    // ========================================
    // END HYBRID KEYWORD DISCOVERY
    // ========================================
    
    // Merge hashtags into main topic map (with aliasing to base topics)
    for (const [key, data] of hashtagMap) {
      // Check if this hashtag should be merged into a base topic
      const baseTopic = HASHTAG_TO_TOPIC[key];
      
      if (baseTopic && topicMap.has(baseTopic)) {
        // Merge hashtag counts into the base topic
        const existing = topicMap.get(baseTopic)!;
        existing.google_news_count += data.google_news_count;
        existing.bluesky_count += data.bluesky_count;
        existing.rss_count += data.rss_count;
        existing.total_count += data.total_count;
        existing.sentiment_counts.positive += data.sentiment_counts.positive;
        existing.sentiment_counts.negative += data.sentiment_counts.negative;
        existing.sentiment_counts.neutral += data.sentiment_counts.neutral;
        // Track that this topic has related hashtags
        if (!existing.hashtags.includes(key)) {
          existing.hashtags.push(key);
        }
        console.log(`Merged hashtag ${key} (${data.total_count} mentions) into ${baseTopic}`);
      } else if (baseTopic && !topicMap.has(baseTopic)) {
        // Base topic doesn't exist yet, create it with hashtag data
        const newData = { ...data, topic: baseTopic };
        newData.hashtags = [key];
        topicMap.set(baseTopic, newData);
        console.log(`Created base topic ${baseTopic} from hashtag ${key}`);
      } else if (!topicMap.has(key)) {
        // No alias, add hashtag as its own topic
        topicMap.set(key, data);
      } else {
        // Hashtag key already exists in topicMap, merge counts
        const existing = topicMap.get(key)!;
        existing.google_news_count += data.google_news_count;
        existing.bluesky_count += data.bluesky_count;
        existing.rss_count += data.rss_count;
        existing.total_count += data.total_count;
        existing.entity_type = 'hashtag';
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
      
      // === QUALITY GATE: Filter out low-quality topics ===
      const qualityCheck = isHighQualityTopic(
        topicData.topic,
        topicData.entity_type,
        crossSourceScore,
        topicData.total_count
      );
      
      if (!qualityCheck.pass) {
        console.log(`[QUALITY-GATE] Filtered: "${topicData.topic}" (${qualityCheck.reason}, type=${topicData.entity_type}, cross=${crossSourceScore})`);
        continue; // Skip this topic
      }
      
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
      
      // Get counts for velocity at multiple time windows (include Google News, RSS, AND Bluesky)
      const mins15Ago = new Date(now.getTime() - 15 * 60 * 1000);
      
      // Escape special characters for ILIKE queries
      const escapedTopic = topicData.topic.replace(/[%_]/g, '\\$&');
      
      const [
        newsResult15m, rssResult15m, blueskyResult15m,
        newsResult1h, rssResult1h, blueskyResult1h,
        newsResult6h, rssResult6h, blueskyResult6h,
        newsResult24h, rssResult24h, blueskyResult24h,
        existingCluster,
        blueskyUniqueAuthors
      ] = await Promise.all([
        // Google News counts (15m)
        supabase
          .from('google_news_articles')
          .select('id', { count: 'exact', head: true })
          .eq('ai_processed', true)
          .contains('ai_topics', [topicData.topic])
          .gte('published_at', mins15Ago.toISOString()),
        // RSS article counts (15m) - use title ILIKE as primary since extracted_topics is JSONB
        supabase
          .from('articles')
          .select('id', { count: 'exact', head: true })
          .gte('published_date', mins15Ago.toISOString())
          .ilike('title', `%${escapedTopic}%`),
        // Bluesky counts (15m) - CRITICAL: Include bluesky in time windows!
        supabase
          .from('bluesky_posts')
          .select('id', { count: 'exact', head: true })
          .eq('ai_processed', true)
          .contains('ai_topics', [topicData.topic])
          .gte('created_at', mins15Ago.toISOString()),
          
        // Google News 1h
        supabase
          .from('google_news_articles')
          .select('id', { count: 'exact', head: true })
          .eq('ai_processed', true)
          .contains('ai_topics', [topicData.topic])
          .gte('published_at', hour1Ago.toISOString()),
        // RSS 1h
        supabase
          .from('articles')
          .select('id', { count: 'exact', head: true })
          .gte('published_date', hour1Ago.toISOString())
          .ilike('title', `%${escapedTopic}%`),
        // Bluesky 1h
        supabase
          .from('bluesky_posts')
          .select('id', { count: 'exact', head: true })
          .eq('ai_processed', true)
          .contains('ai_topics', [topicData.topic])
          .gte('created_at', hour1Ago.toISOString()),
          
        // Google News 6h
        supabase
          .from('google_news_articles')
          .select('id', { count: 'exact', head: true })
          .eq('ai_processed', true)
          .contains('ai_topics', [topicData.topic])
          .gte('published_at', hours6Ago.toISOString()),
        // RSS 6h (keyword-based for consistency)
        supabase
          .from('articles')
          .select('id', { count: 'exact', head: true })
          .gte('published_date', hours6Ago.toISOString())
          .ilike('title', `%${escapedTopic}%`),
        // Bluesky 6h
        supabase
          .from('bluesky_posts')
          .select('id', { count: 'exact', head: true })
          .eq('ai_processed', true)
          .contains('ai_topics', [topicData.topic])
          .gte('created_at', hours6Ago.toISOString()),
          
        // Google News 24h (AI-based like 6h to avoid false positives)
        supabase
          .from('google_news_articles')
          .select('id', { count: 'exact', head: true })
          .eq('ai_processed', true)
          .contains('ai_topics', [topicData.topic])
          .gte('published_at', hours24Ago.toISOString()),
        // RSS 24h (keyword-based in title - reliable)
        supabase
          .from('articles')
          .select('id', { count: 'exact', head: true })
          .gte('published_date', hours24Ago.toISOString())
          .ilike('title', `%${escapedTopic}%`),
        // Bluesky 24h (AI-based like 6h to avoid false positives from short words like ICE)
        supabase
          .from('bluesky_posts')
          .select('id', { count: 'exact', head: true })
          .eq('ai_processed', true)
          .contains('ai_topics', [topicData.topic])
          .gte('created_at', hours24Ago.toISOString()),
          
        // Existing cluster
        supabase
          .from('trend_clusters')
          .select('velocity_score')
          .eq('cluster_title', topicData.topic)
          .maybeSingle(),
          
        // Spam detection: count unique authors for this topic in bluesky (last 24h)
        supabase
          .from('bluesky_posts')
          .select('author_did')
          .eq('ai_processed', true)
          .contains('ai_topics', [topicData.topic])
          .gte('created_at', hours24Ago.toISOString())
      ]);
      
      // Calculate unique authors for spam detection
      const uniqueAuthors = blueskyUniqueAuthors.data 
        ? new Set(blueskyUniqueAuthors.data.map((p: any) => p.author_did)).size
        : 0;
      const blueskyMentionCount = topicData.bluesky_count;
      
      // Spam detection: if single author contributes >50% of mentions, it's likely spam
      const isSpammy = uniqueAuthors > 0 && blueskyMentionCount > 10 && 
                       (blueskyMentionCount / uniqueAuthors) > 5; // avg >5 posts per author suggests spam
      
      // Weight bluesky counts lower if spammy, but still include
      const blueskyWeight = isSpammy ? 0.3 : 1.0;
      
      // Sum counts from all three sources (Google News, RSS, and Bluesky) using keyword-based queries
      const raw15m = (newsResult15m.count || 0) + 
                     (rssResult15m.count || 0) + 
                     Math.round((blueskyResult15m.count || 0) * blueskyWeight);
      const raw1h = (newsResult1h.count || 0) + 
                    (rssResult1h.count || 0) + 
                    Math.round((blueskyResult1h.count || 0) * blueskyWeight);
      const raw6h = (newsResult6h.count || 0) + 
                    (rssResult6h.count || 0) + 
                    Math.round((blueskyResult6h.count || 0) * blueskyWeight);
      // 24h: use keyword-based counts and ensure >= AI-based total_count
      const keyword24h = (newsResult24h.count || 0) + 
                         (rssResult24h.count || 0) + 
                         Math.round((blueskyResult24h.count || 0) * blueskyWeight);
      const raw24h = Math.max(keyword24h, topicData.total_count);
      
      // CRITICAL: Ensure logical hierarchy - 24h >= 6h >= 1h >= 15m
      // This prevents the impossible case where 6h > 24h
      const mentions24h = Math.max(raw24h, raw6h, raw1h, raw15m);
      const mentions6h = Math.max(raw6h, raw1h, raw15m);
      const mentions1h = Math.max(raw1h, raw15m);
      const mentions15m = raw15m;
      
      const previousVelocity = existingCluster.data?.velocity_score ?? null;
      
      // Log time-window breakdown for debugging top topics
      if (topicData.rankScore > 100) {
        console.log(`[TIME-WINDOWS] ${topicData.topic}: 15m=${mentions15m}, 1h=${mentions1h}, 6h=${mentions6h}, 24h=${mentions24h} (kw24h=${keyword24h}, ai24h=${topicData.total_count})${isSpammy ? ' [SPAM]' : ''}`);
      }
      
      // Calculate enhanced velocity metrics
      const velocityMetrics = calculateEnhancedVelocity(
        mentions15m,
        mentions1h,
        mentions6h,
        mentions24h,
        previousVelocity,
        topicData.first_seen,
        now
      );
      
      // Determine momentum from trend stage
      const momentum = velocityMetrics.trendStage === 'surging' || velocityMetrics.trendStage === 'emerging' 
        ? 'up' 
        : velocityMetrics.trendStage === 'declining' 
          ? 'down' 
          : 'stable';
      
      // Is trending? (with specificity boost and enhanced velocity)
      const specificityBoost = topicData.specificityScore >= 2.0;
      const isTrending = (velocityMetrics.velocity1h > 30 && mentions24h >= 5) || 
                         (crossSourceScore >= 3 && mentions24h >= 10) ||
                         (specificityBoost && velocityMetrics.velocity1h > 20 && mentions24h >= 3) ||
                         mentions1h >= 5 ||
                         velocityMetrics.trendStage === 'emerging' ||
                         velocityMetrics.trendStage === 'surging';
      
      // Check for breaking news (use enhanced velocity)
      const isBreaking = isBreakingNews(velocityMetrics.velocity1h, crossSourceScore, topicData.first_seen, now);
      if (isBreaking) breakingCount++;
      
      // Track surging/emerging topics
      if (velocityMetrics.trendStage === 'surging' || velocityMetrics.trendStage === 'emerging') {
        console.log(`[${velocityMetrics.trendStage.toUpperCase()}] ${topicData.topic}: vel=${velocityMetrics.velocity1h.toFixed(0)}%, acc=${velocityMetrics.acceleration.toFixed(0)}%`);
      }
      
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
      
      // Upsert cluster with enhanced velocity fields and spam detection
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
          mentions_last_15m: mentions15m,
          velocity_score: velocityMetrics.velocity24h,
          velocity_1h: velocityMetrics.velocity1h,
          velocity_6h: velocityMetrics.velocity6h,
          acceleration: velocityMetrics.acceleration,
          trend_stage: velocityMetrics.trendStage,
          peak_hour: velocityMetrics.peakHour?.toISOString() || null,
          spike_detected_at: velocityMetrics.spikeDetectedAt?.toISOString() || null,
          momentum,
          source_distribution: {
            google_news: topicData.google_news_count,
            reddit: topicData.reddit_count,
            bluesky: topicData.bluesky_count,
            bluesky_unique_authors: uniqueAuthors,
            bluesky_spam_detected: isSpammy,
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

    // Log unresolved entities for future alias addition
    if (unresolvedEntities.size > 0) {
      console.log(`Found ${unresolvedEntities.size} unresolved entities (potential future aliases):`);
      const topUnresolved = Array.from(unresolvedEntities)
        .filter(e => topicMap.has(e) && (topicMap.get(e)?.total_count || 0) >= 5)
        .slice(0, 20);
      if (topUnresolved.length > 0) {
        console.log('High-volume unresolved:', topUnresolved.join(', '));
      }
    }

    const result = {
      success: true,
      total_topics: topicMap.size,
      significant_topics: significantTopics.length,
      clusters_updated: clustersUpdated,
      breaking_topics: breakingCount,
      entity_distribution: entityTypeCounts,
      db_aliases_loaded: dbAliases.size,
      unresolved_entities: unresolvedEntities.size,
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
