import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

// Database-loaded entity aliases for canonicalization
let dbAliases: Map<string, { canonical_name: string; entity_type: string }> = new Map();

interface ContentItem {
  id: string;
  title: string;
  description?: string;
  source_type: 'google_news' | 'reddit' | 'bluesky' | 'rss';
}

interface NERResult {
  entities: Array<{
    name: string;
    type: 'PERSON' | 'ORG' | 'GPE' | 'EVENT' | 'LAW' | 'PRODUCT';
    canonical: string;
  }>;
  event_phrases: string[];
  sentiment: number;
  sentiment_label: string;
}

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
      console.log(`Loaded ${dbAliases.size} entity aliases from database`);
    }
  } catch (e) {
    console.error('Failed to load entity aliases:', e);
  }
}

/**
 * Canonicalize entity name using database aliases
 */
function canonicalizeEntity(name: string): { canonical: string; type: string } {
  const lower = name.toLowerCase().trim();
  
  // Check database aliases first
  if (dbAliases.has(lower)) {
    const alias = dbAliases.get(lower)!;
    return { canonical: alias.canonical_name, type: alias.entity_type };
  }
  
  // Normalize: collapse whitespace, title case
  const normalized = name.trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  
  return { canonical: normalized, type: 'unknown' };
}

/**
 * Validate event phrase quality - must be 2-6 words, descriptive, verb-centered preferred
 * PHASE 2: Strengthened validation with expanded verb/noun lists
 */
function isValidEventPhrase(phrase: string): boolean {
  const words = phrase.trim().split(/\s+/);
  if (words.length < 2 || words.length > 6) return false;
  
  // Must contain at least one proper noun or action word
  const hasProperNoun = /[A-Z][a-z]+/.test(phrase);
  
  // PHASE 2: Expanded verb-centered action words
  const actionVerbs = [
    // Legislative actions
    'vote', 'votes', 'pass', 'passes', 'block', 'blocks', 'reject', 'rejects',
    'approve', 'approves', 'sign', 'signs', 'veto', 'vetoes', 'filibuster', 'filibusters',
    // Executive actions
    'fire', 'fires', 'resign', 'resigns', 'nominate', 'nominates', 'appoint', 'appoints',
    'order', 'orders', 'pardon', 'pardons', 'commute', 'commutes', 'revoke', 'revokes',
    // Judicial actions
    'rule', 'rules', 'overturn', 'overturns', 'uphold', 'upholds', 'strike', 'strikes',
    'dismiss', 'dismisses', 'grant', 'grants', 'deny', 'denies', 'affirm', 'affirms',
    // Law enforcement
    'arrest', 'arrests', 'indict', 'indicts', 'sue', 'sues', 'charge', 'charges',
    'convict', 'convicts', 'acquit', 'acquits', 'sentence', 'sentences', 'raid', 'raids',
    'seize', 'seizes', 'deport', 'deports', 'detain', 'detains',
    // Policy/diplomacy
    'announce', 'announces', 'launch', 'launches', 'ban', 'bans', 'sanction', 'sanctions',
    'threaten', 'threatens', 'warn', 'warns', 'demand', 'demands', 'propose', 'proposes',
    'withdraw', 'withdraws', 'suspend', 'suspends', 'expand', 'expands', 'cut', 'cuts',
    // Conflict/crisis
    'attack', 'attacks', 'invade', 'invades', 'strike', 'strikes', 'bomb', 'bombs',
    'collapse', 'collapses', 'halt', 'halts', 'escalate', 'escalates', 'cease', 'ceases',
    // Economic
    'raise', 'raises', 'lower', 'lowers', 'freeze', 'freezes', 'surge', 'surges',
  ];
  const hasActionVerb = actionVerbs.some(v => phrase.toLowerCase().includes(v));
  
  // PHASE 2: Expanded event nouns
  const eventNouns = [
    // Legal/judicial
    'ruling', 'trial', 'hearing', 'verdict', 'indictment', 'conviction', 'acquittal',
    'lawsuit', 'injunction', 'subpoena', 'testimony', 'deposition',
    // Political
    'vote', 'bill', 'election', 'impeachment', 'nomination', 'confirmation', 'veto',
    'filibuster', 'shutdown', 'debate', 'speech', 'summit', 'rally',
    // Crisis/conflict
    'shooting', 'protest', 'crisis', 'scandal', 'attack', 'bombing', 'strike', 'raid',
    'ceasefire', 'invasion', 'collapse', 'evacuation', 'explosion',
    // Policy
    'resignation', 'sanctions', 'tariffs', 'investigation', 'probe', 'audit',
    'deportation', 'pardon', 'ban', 'order', 'mandate', 'regulation',
  ];
  const hasEventNoun = eventNouns.some(w => phrase.toLowerCase().includes(w));
  
  return hasProperNoun && (hasActionVerb || hasEventNoun);
}

/**
 * Generate fallback event phrase from headline when AI only returns entities
 * PHASE 2: Strengthened with more patterns and better Subject+Verb+Object extraction
 */
function generateFallbackEventPhrase(title: string, entities: Array<{ name: string; type: string; canonical: string }>): string | null {
  if (!title || entities.length === 0) return null;
  
  const titleClean = title.trim();
  
  // PHASE 2: Expanded verb patterns for Subject + Verb + Object extraction
  const verbPatterns = [
    // Active voice: "Trump Fires FBI Director", "House Passes Bill"
    /^(\w+(?:\s+\w+)?)\s+(passes?|blocks?|rejects?|approves?|signs?|fires?|resigns?|announces?|launches?|bans?|arrests?|indicts?|sues?|orders?|vetoes?|strikes?|rules?|overturns?|upholds?|halts?|suspends?|expands?|cuts?|threatens?|warns?|demands?|proposes?|withdraws?|seizes?|raids?|deports?|detains?|pardons?|revokes?|nominates?|appoints?|dismisses?|grants?|denies?|charges?|convicts?|acquits?|sentences?|attacks?|invades?|bombs?|collapses?|escalates?|ceases?|freezes?|raises?|lowers?)\s+(.+)/i,
    // With infinitive: "Biden to Sign Executive Order"
    /^(\w+(?:\s+\w+)?)\s+(?:to|will)\s+(sign|pass|block|reject|approve|fire|ban|launch|order|halt|suspend|expand|cut|withdraw|strike|attack|invade|raid|seize|deport|pardon|revoke|nominate|appoint)\s+(.+)/i,
    // Past tense: "Trump Fired for Ethics Violations"
    /^(\w+(?:\s+\w+)?)\s+(fired|arrested|indicted|charged|convicted|acquitted|sentenced|raided|seized|deported|detained|pardoned|revoked|nominated|appointed|dismissed)\s+(?:for|over|after|by|in|following)\s+(.+)/i,
    // Passive voice: "Bill Passed by House", "Director Fired by Trump"
    /^(.+?)\s+(passed|blocked|rejected|approved|signed|fired|banned|struck|ordered|halted|suspended)\s+by\s+(\w+(?:\s+\w+)?)/i,
    // "X faces Y" pattern: "Trump Faces Indictment"
    /^(\w+(?:\s+\w+)?)\s+(faces?|face)\s+(.+)/i,
    // "X wins/loses Y" pattern: "Democrats Win Senate"
    /^(\w+(?:\s+\w+)?)\s+(wins?|loses?|won|lost)\s+(.+)/i,
  ];
  
  for (const pattern of verbPatterns) {
    const match = titleClean.match(pattern);
    if (match) {
      let subject = match[1];
      let verb = match[2];
      let objectPart = match[3];
      
      // Clean up object: take first phrase segment (before comma, dash, colon)
      objectPart = objectPart.split(/[,.\-–:;]/).map(s => s.trim())[0];
      
      // Build phrase: Subject + Verb + Object (limit to 5 words total)
      const rawPhrase = `${subject} ${verb} ${objectPart}`;
      const phraseWords = rawPhrase.split(/\s+/).slice(0, 5);
      
      if (phraseWords.length >= 2) {
        // Title case each word
        const phrase = phraseWords.map(w => 
          w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
        ).join(' ');
        return phrase;
      }
    }
  }
  
  // PHASE 2: Expanded event noun fallback
  const eventNounPattern = /\b(vote|bill|ruling|crisis|ban|tariff|policy|probe|investigation|hearing|trial|arrest|firing|resignation|indictment|verdict|conviction|acquittal|sanction|ceasefire|attack|bombing|strike|raid|protest|scandal|impeachment|shutdown|veto|deportation|pardon|order|mandate|summit|election|debate)\b/i;
  const actionMatch = title.match(eventNounPattern);
  
  if (actionMatch && entities.length > 0) {
    // Use top entity + event noun
    const topEntity = entities[0].canonical || entities[0].name;
    const action = actionMatch[1];
    const phrase = `${topEntity} ${action.charAt(0).toUpperCase() + action.slice(1).toLowerCase()}`;
    
    // Only return if it's at least 2 words
    if (phrase.split(/\s+/).length >= 2) {
      return phrase;
    }
  }
  
  // PHASE 2: Last resort - combine top 2 entities if multi-word
  if (entities.length >= 2) {
    const e1 = entities[0].canonical || entities[0].name;
    const e2 = entities[1].canonical || entities[1].name;
    // Only if they're different and result is meaningful
    if (e1 !== e2 && e1.length > 2 && e2.length > 2) {
      const combined = `${e1} ${e2}`;
      if (combined.split(/\s+/).length >= 2 && combined.split(/\s+/).length <= 5) {
        return combined;
      }
    }
  }
  
  return null;
}

interface NERResultWithQuality extends NERResult {
  label_quality: 'event_phrase' | 'entity_only' | 'fallback_generated';
}

/**
 * NER + Keyphrase extraction using AI
 * Returns canonical entities and multi-word event phrases
 * PHASE 2: Prioritizes event phrases as primary labels
 */
async function extractNERWithAI(items: ContentItem[]): Promise<Map<string, NERResultWithQuality>> {
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY not configured');
  }
  
  const results = new Map<string, NERResultWithQuality>();
  
  // Batch items (max 20 per request for efficiency)
  const itemsText = items.slice(0, 20).map((item, i) => 
    `[${i}] ${item.title}${item.description ? ` - ${item.description.substring(0, 200)}` : ''}`
  ).join('\n');
  
  // PHASE 2: Enhanced prompt prioritizing event phrases over entities
  const prompt = `Extract EVENT PHRASES (primary) and named entities (secondary) from these headlines for Twitter-style trending.

${itemsText}

For EACH item, extract in ORDER OF PRIORITY:

1. **event_phrases** (PRIMARY - these become the trend labels):
   Multi-word verb-centered phrases (2-5 words) that describe WHAT is happening:
   - GOOD: "House Passes Border Bill", "Trump Fires FBI Director", "Gaza Ceasefire Collapses"
   - GOOD: "Supreme Court Blocks Abortion Ban", "DOJ Indicts Senator", "Texas Sues Biden"
   - BAD: Just names like "Donald Trump", "FBI", "Gaza" (these are entities, not events)
   
   REQUIRE: Subject + Verb + Object pattern when possible
   - "[Who] [Does What] [To Whom/What]"

2. **entities** (SECONDARY - metadata, not primary labels):
   - PERSON: Full canonical names (e.g., "Donald Trump", NOT "Trump")
   - ORG: Organizations (e.g., "Supreme Court", "FBI")
   - GPE: Locations (e.g., "Gaza", "Texas")
   - These should NOT be the trending label if an event phrase exists

3. **sentiment**: -1.0 to 1.0

CRITICAL RULES:
- PRIORITIZE event phrases over single entities as the trending topic
- Event phrases MUST describe an action/event, not just a person or place
- Use FULL CANONICAL NAMES for people: "Donald Trump" not "Trump"
- DO NOT include news publishers (CNN, Reuters, AP) as entities
- Each headline should ideally produce at least ONE event phrase

Return JSON array:
[{"index": 0, "event_phrases": ["Trump Fires FBI Director", "DOJ Investigation Expands"], "entities": [{"name": "Donald Trump", "type": "PERSON"}, {"name": "FBI", "type": "ORG"}], "sentiment": -0.3, "sentiment_label": "negative"}]`;

  try {
    const response = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { 
            role: 'system', 
            content: 'You are an NER system that extracts verb-centered event phrases (primary) and canonical entities (secondary) from news headlines. Event phrases describe WHAT HAPPENED, not just WHO. Output ONLY valid JSON arrays.' 
          },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.warn('Rate limit hit, falling back to basic extraction');
        return results;
      }
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Parse JSON from response
    let analyses: any[] = [];
    try {
      const cleaned = content.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      analyses = Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      // Try to extract JSON array
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        analyses = JSON.parse(jsonMatch[0]);
      }
    }
    
    // Map results back to items
    for (const analysis of analyses) {
      const idx = analysis.index;
      if (idx === undefined || idx >= items.length) continue;
      
      const item = items[idx];
      
      // Canonicalize entities
      const entities = (analysis.entities || []).map((e: any) => {
        const canonicalized = canonicalizeEntity(e.name);
        return {
          name: e.name,
          type: e.type || 'unknown',
          canonical: canonicalized.canonical
        };
      }).filter((e: any) => e.canonical && e.canonical.length > 1);
      
      // Validate event phrases
      let eventPhrases = (analysis.event_phrases || [])
        .map((p: string) => p.trim())
        .filter((p: string) => isValidEventPhrase(p));
      
      // PHASE 2: Determine label quality and apply fallback if needed
      let labelQuality: 'event_phrase' | 'entity_only' | 'fallback_generated' = 'entity_only';
      
      if (eventPhrases.length > 0) {
        labelQuality = 'event_phrase';
      } else if (entities.length > 0) {
        // Try to generate fallback event phrase from headline
        const fallbackPhrase = generateFallbackEventPhrase(item.title, entities);
        if (fallbackPhrase) {
          eventPhrases = [fallbackPhrase];
          labelQuality = 'fallback_generated';
          console.log(`[batch-analyze] Generated fallback phrase: "${fallbackPhrase}" from "${item.title.substring(0, 50)}..."`);
        } else {
          labelQuality = 'entity_only';
        }
      }
      
      results.set(item.id, {
        entities,
        event_phrases: eventPhrases,
        sentiment: analysis.sentiment || 0,
        sentiment_label: analysis.sentiment_label || 'neutral',
        label_quality: labelQuality
      });
    }
    
    console.log(`NER extracted ${results.size} items with entities + event phrases`);
    
  } catch (error) {
    console.error('AI NER extraction error:', error);
  }
  
  return results;
}

/**
 * Fallback: Extract basic entities from text without AI (for rate-limit scenarios)
 * PHASE 2: Also attempts to generate fallback event phrases
 */
function extractBasicEntities(title: string, description?: string): NERResultWithQuality {
  const text = `${title} ${description || ''}`;
  const entities: NERResult['entities'] = [];
  let eventPhrases: string[] = [];
  
  // Basic proper noun extraction via regex
  const properNouns = text.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) || [];
  
  for (const noun of properNouns) {
    if (noun.length < 2) continue;
    const canonicalized = canonicalizeEntity(noun);
    
    // Skip common words that look like proper nouns
    const skipWords = ['The', 'This', 'That', 'Monday', 'Tuesday', 'Wednesday', 
                       'Thursday', 'Friday', 'Saturday', 'Sunday', 'January', 
                       'February', 'March', 'April', 'May', 'June', 'July', 
                       'August', 'September', 'October', 'November', 'December'];
    if (skipWords.includes(noun)) continue;
    
    entities.push({
      name: noun,
      type: 'PERSON', // Default, may be overridden by alias
      canonical: canonicalized.canonical
    });
  }
  
  // Simple sentiment
  const posWords = ['win', 'victory', 'success', 'agree', 'support', 'approve'];
  const negWords = ['crisis', 'scandal', 'attack', 'threat', 'fail', 'reject', 'oppose'];
  const textLower = text.toLowerCase();
  let sentiment = 0;
  posWords.forEach(w => { if (textLower.includes(w)) sentiment += 0.2; });
  negWords.forEach(w => { if (textLower.includes(w)) sentiment -= 0.2; });
  sentiment = Math.max(-1, Math.min(1, sentiment));
  
  // PHASE 2: Try to generate fallback event phrase
  let labelQuality: 'event_phrase' | 'entity_only' | 'fallback_generated' = 'entity_only';
  
  if (entities.length > 0) {
    const fallbackPhrase = generateFallbackEventPhrase(title, entities.slice(0, 5));
    if (fallbackPhrase) {
      eventPhrases = [fallbackPhrase];
      labelQuality = 'fallback_generated';
    }
  }
  
  return {
    entities: entities.slice(0, 5),
    event_phrases: eventPhrases,
    sentiment: Math.round(sentiment * 100) / 100,
    sentiment_label: sentiment > 0.2 ? 'positive' : sentiment < -0.2 ? 'negative' : 'neutral',
    label_quality: labelQuality
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
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Load entity aliases for canonicalization
    await loadEntityAliases(supabase);

    const { source_type, batch_size = 50, use_ai = true } = await req.json().catch(() => ({}));
    
    console.log(`[batch-analyze-content] NER + keyphrase extraction, source: ${source_type || 'all'}, batch: ${batch_size}, use_ai: ${use_ai}`);
    
    let processedCount = 0;
    let entitiesExtracted = 0;
    let phrasesExtracted = 0;
    
    // Process Google News with AI NER
    if (!source_type || source_type === 'google_news') {
      const { data: newsItems } = await supabase
        .from('google_news_articles')
        .select('id, title, description')
        .eq('ai_processed', false)
        .order('published_at', { ascending: false })
        .limit(batch_size);
      
      if (newsItems && newsItems.length > 0) {
        console.log(`Processing ${newsItems.length} Google News items with NER...`);
        
        // Use AI for NER extraction
        let nerResults: Map<string, NERResultWithQuality> = new Map();
        if (use_ai && LOVABLE_API_KEY) {
          nerResults = await extractNERWithAI(newsItems.map(item => ({
            id: item.id,
            title: item.title,
            description: item.description,
            source_type: 'google_news' as const
          })));
        }
        
        for (const item of newsItems) {
          // Get AI result or fallback to basic extraction
          const nerResult = nerResults.get(item.id) || extractBasicEntities(item.title, item.description);
          
          // Build topics array from entities + event phrases
          const topics: string[] = [];
          const entityTypes: Record<string, string> = {};
          
          // Add canonical entity names
          for (const entity of nerResult.entities) {
            if (!topics.includes(entity.canonical)) {
              topics.push(entity.canonical);
              entityTypes[entity.canonical] = entity.type;
            }
          }
          
          // Add event phrases (these become trend labels)
          for (const phrase of nerResult.event_phrases) {
            if (!topics.includes(phrase)) {
              topics.push(phrase);
              entityTypes[phrase] = 'EVENT_PHRASE';
            }
          }
          
          entitiesExtracted += nerResult.entities.length;
          phrasesExtracted += nerResult.event_phrases.length;
          
          await supabase
            .from('google_news_articles')
            .update({
              ai_processed: true,
              ai_topics: topics.slice(0, 10),
              ai_sentiment: nerResult.sentiment,
              ai_sentiment_label: nerResult.sentiment_label,
              relevance_score: Math.min(1, topics.length * 0.15),
              updated_at: new Date().toISOString()
            })
            .eq('id', item.id);
          
          processedCount++;
        }
      }
    }
    
    // Process Reddit posts with AI NER
    if (!source_type || source_type === 'reddit') {
      const { data: redditItems } = await supabase
        .from('reddit_posts')
        .select('id, title, selftext')
        .eq('ai_processed', false)
        .order('created_utc', { ascending: false })
        .limit(batch_size);
      
      if (redditItems && redditItems.length > 0) {
        console.log(`Processing ${redditItems.length} Reddit posts with NER...`);
        
        let nerResults: Map<string, NERResultWithQuality> = new Map();
        if (use_ai && LOVABLE_API_KEY) {
          nerResults = await extractNERWithAI(redditItems.map(item => ({
            id: item.id,
            title: item.title,
            description: item.selftext,
            source_type: 'reddit' as const
          })));
        }
        
        for (const item of redditItems) {
          const nerResult = nerResults.get(item.id) || extractBasicEntities(item.title, item.selftext);
          
          const topics: string[] = [];
          for (const entity of nerResult.entities) {
            if (!topics.includes(entity.canonical)) {
              topics.push(entity.canonical);
            }
          }
          for (const phrase of nerResult.event_phrases) {
            if (!topics.includes(phrase)) {
              topics.push(phrase);
            }
          }
          
          entitiesExtracted += nerResult.entities.length;
          phrasesExtracted += nerResult.event_phrases.length;
          
          await supabase
            .from('reddit_posts')
            .update({
              ai_processed: true,
              ai_topics: topics.slice(0, 10),
              ai_sentiment: nerResult.sentiment,
              ai_sentiment_label: nerResult.sentiment_label,
              relevance_score: Math.min(1, topics.length * 0.15),
              updated_at: new Date().toISOString()
            })
            .eq('id', item.id);
          
          processedCount++;
        }
      }
    }
    
    // Process RSS articles with AI NER
    if (!source_type || source_type === 'rss') {
      const { data: rssItems } = await supabase
        .from('articles')
        .select('id, title, description')
        .is('extracted_topics', null)
        .order('published_date', { ascending: false })
        .limit(batch_size);
      
      if (rssItems && rssItems.length > 0) {
        console.log(`Processing ${rssItems.length} RSS articles with NER...`);
        
        let nerResults: Map<string, NERResultWithQuality> = new Map();
        if (use_ai && LOVABLE_API_KEY) {
          nerResults = await extractNERWithAI(rssItems.map(item => ({
            id: item.id,
            title: item.title,
            description: item.description,
            source_type: 'rss' as const
          })));
        }
        
        for (const item of rssItems) {
          const nerResult = nerResults.get(item.id) || extractBasicEntities(item.title, item.description);
          
          // Build extracted_topics with entity types
          const extractedTopics = [
            ...nerResult.entities.map(e => ({
              topic: e.canonical,
              entity_type: e.type,
              is_event_phrase: false
            })),
            ...nerResult.event_phrases.map(p => ({
              topic: p,
              entity_type: 'EVENT_PHRASE',
              is_event_phrase: true
            }))
          ];
          
          entitiesExtracted += nerResult.entities.length;
          phrasesExtracted += nerResult.event_phrases.length;
          
          await supabase
            .from('articles')
            .update({
              extracted_topics: extractedTopics.slice(0, 10),
              sentiment_score: nerResult.sentiment,
              sentiment_label: nerResult.sentiment_label,
              topics_extracted: true,
              topics_extracted_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', item.id);
          
          processedCount++;
        }
      }
    }
    
    // Log batch stats
    await supabase.from('processing_batches').insert({
      batch_type: source_type || 'batch_analyze_ner',
      items_count: processedCount,
      unique_items: processedCount,
      clusters_created: 0,
      ai_tokens_used: use_ai ? processedCount * 50 : 0, // Estimate
      processing_time_ms: Date.now() - startTime,
      completed_at: new Date().toISOString(),
      status: 'completed'
    });

    const result = {
      success: true,
      processed: processedCount,
      entities_extracted: entitiesExtracted,
      event_phrases_extracted: phrasesExtracted,
      ai_used: use_ai && !!LOVABLE_API_KEY,
      duration_ms: Date.now() - startTime
    };
    
    console.log('[batch-analyze-content] NER extraction complete:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error in batch-analyze-content:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
