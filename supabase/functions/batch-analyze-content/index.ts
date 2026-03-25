import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateCronOrAdmin, checkRateLimit } from "../_shared/security.ts";

const corsHeaders = getCorsHeaders();

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

// Known entity-only patterns that should NOT be event phrases
// PERSON: Single or double name (e.g., "Donald Trump", "Trump")
// ORG: Single organization name (e.g., "FBI", "Supreme Court")
// GPE: Geographic/Political entity (e.g., "Gaza", "Texas")
const ENTITY_ONLY_PATTERNS = [
  // Single capitalized word (likely a name or acronym)
  /^[A-Z][a-z]*$/,
  // Two capitalized words (likely a person's name)
  /^[A-Z][a-z]+\s+[A-Z][a-z]+$/,
  // Known titles + name pattern: "President Trump", "Senator Warren"
  /^(?:President|Senator|Rep\.?|Governor|Mayor|Secretary|Director|Chief|Justice)\s+[A-Z][a-z]+$/i,
  // Single org acronym (FBI, CIA, DOJ, etc.)
  /^[A-Z]{2,5}$/,
  // The + Organization pattern: "The Pentagon", "The FBI"
  /^The\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?$/,
];

// Comprehensive action verbs list for verb-centered validation
const ACTION_VERBS = [
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
  // PHASE 3 FIX: Added common headline verbs that were missing
  'reveal', 'reveals', 'revealed', 'revealing', 'confirm', 'confirms', 'confirmed',
  'plan', 'plans', 'planned', 'planning', 'consider', 'considers', 'considered',
  'mull', 'mulls', 'mulled', 'weigh', 'weighs', 'weighed',
  'call', 'calls', 'called', 'calling', 'push', 'pushes', 'pushed', 'pushing',
  'seek', 'seeks', 'sought', 'seeking', 'target', 'targets', 'targeted',
  'slam', 'slams', 'slammed', 'blast', 'blasts', 'blasted',
  'praise', 'praises', 'praised', 'defend', 'defends', 'defended',
  'criticize', 'criticizes', 'criticized', 'condemn', 'condemns', 'condemned',
  'urge', 'urges', 'urged', 'vow', 'vows', 'vowed',
  'claim', 'claims', 'claimed', 'allege', 'alleges', 'alleged',
  'honor', 'honors', 'honored', 'celebrate', 'celebrates', 'celebrated',
  'mourn', 'mourns', 'mourned', 'mark', 'marks', 'marked',
  'hold', 'holds', 'held', 'host', 'hosts', 'hosted',
  'meet', 'meets', 'met', 'visit', 'visits', 'visited',
  'speak', 'speaks', 'spoke', 'address', 'addresses', 'addressed',
  'testify', 'testifies', 'testified', 'appear', 'appears', 'appeared',
  'confirm', 'confirms', 'confirmed', 'confirming', 'release', 'releases', 'released',
  'reveal', 'reveals', 'revealed', 'expose', 'exposes', 'exposed',
  'target', 'targets', 'targeted', 'targeting', 'kill', 'kills', 'killed',
  'end', 'ends', 'ended', 'ending', 'begin', 'begins', 'began', 'beginning',
  'start', 'starts', 'started', 'starting', 'stop', 'stops', 'stopped',
];

// Event nouns that indicate something happened
const EVENT_NOUNS = [
  // Legal/judicial
  'ruling', 'trial', 'hearing', 'verdict', 'indictment', 'conviction', 'acquittal',
  'lawsuit', 'injunction', 'subpoena', 'testimony', 'deposition', 'sentencing',
  // Political
  'vote', 'bill', 'election', 'impeachment', 'nomination', 'confirmation', 'veto',
  'filibuster', 'shutdown', 'debate', 'speech', 'summit', 'rally', 'resignation',
  // Crisis/conflict
  'shooting', 'protest', 'crisis', 'scandal', 'attack', 'bombing', 'strike', 'raid',
  'ceasefire', 'invasion', 'collapse', 'evacuation', 'explosion', 'assassination',
  // Policy
  'sanctions', 'tariffs', 'investigation', 'probe', 'audit', 'deportation',
  'pardon', 'ban', 'order', 'mandate', 'regulation', 'reform',
];

/**
 * Check if phrase contains at least one action verb or event noun
 * Returns the matched verb/noun for logging purposes
 */
function containsActionVerb(phrase: string): { hasVerb: boolean; matched?: string } {
  const lower = phrase.toLowerCase();
  const words = lower.split(/\s+/);
  
  // Check for action verbs
  for (const verb of ACTION_VERBS) {
    if (words.includes(verb)) {
      return { hasVerb: true, matched: verb };
    }
  }
  
  // Check for event nouns
  for (const noun of EVENT_NOUNS) {
    if (words.includes(noun)) {
      return { hasVerb: true, matched: noun };
    }
  }
  
  return { hasVerb: false };
}

/**
 * Check if phrase matches entity-only patterns (should be rejected as event phrase)
 */
function isEntityOnlyPattern(phrase: string): boolean {
  for (const pattern of ENTITY_ONLY_PATTERNS) {
    if (pattern.test(phrase.trim())) {
      return true;
    }
  }
  return false;
}

/**
 * Validate event phrase quality - must be 3-6 words, verb-centered, NOT entity-only
 * FIX: Require 3+ words to prevent 2-word entity names like "Joe Biden" from being event phrases
 */
function isValidEventPhrase(phrase: string): boolean {
  const words = phrase.trim().split(/\s+/);
  
  // CRITICAL FIX: Require 3+ words - 2-word phrases are almost always person/org names
  // Examples that should FAIL: "Joe Biden", "Chuck Schumer", "White House"
  // Examples that should PASS: "Trump Fires Director", "House Passes Bill"
  if (words.length < 3 || words.length > 6) return false;
  
  // CRITICAL: Reject entity-only patterns even if multi-word
  if (isEntityOnlyPattern(phrase)) {
    return false;
  }
  
  // REQUIRE: Must contain at least one action verb or event noun
  const verbCheck = containsActionVerb(phrase);
  if (!verbCheck.hasVerb) {
    return false;
  }
  
  // Must have at least one proper noun (subject of the action)
  const hasProperNoun = /[A-Z][a-z]+/.test(phrase);
  
  return hasProperNoun;
}

/**
 * Generate fallback event phrase from headline when AI only returns entities
 * PHASE 3 FIX: Strengthened with more patterns, better extraction, and headline truncation fallback
 */
function generateFallbackEventPhrase(title: string, entities: Array<{ name: string; type: string; canonical: string }>): string | null {
  if (!title || entities.length === 0) return null;

  const titleClean = title.trim();

  // PHASE 3 FIX: Comprehensive verb patterns for Subject + Verb + Object extraction
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
    // PHASE 3 FIX: Additional patterns for common headline structures
    // "X reveals/confirms Y" pattern
    /^(\w+(?:\s+\w+)?)\s+(reveals?|confirms?|denies?|claims?|alleges?)\s+(.+)/i,
    // "X plans/considers Y" pattern
    /^(\w+(?:\s+\w+)?)\s+(plans?|considers?|mulls?|weighs?|eyes?)\s+(.+)/i,
    // "X calls for/pushes for Y" pattern
    /^(\w+(?:\s+\w+)?)\s+(calls?\s+for|pushes?\s+for|demands?|urges?)\s+(.+)/i,
    // "X slams/blasts Y" pattern
    /^(\w+(?:\s+\w+)?)\s+(slams?|blasts?|criticizes?|condemns?|praises?|defends?)\s+(.+)/i,
    // "X honors/celebrates Y" pattern
    /^(\w+(?:\s+\w+)?)\s+(honors?|celebrates?|mourns?|marks?|commemorates?)\s+(.+)/i,
    // "X meets/visits Y" pattern
    /^(\w+(?:\s+\w+)?)\s+(meets?|visits?|hosts?|addresses?|speaks?\s+to)\s+(.+)/i,
    // "X targets/seeks Y" pattern
    /^(\w+(?:\s+\w+)?)\s+(targets?|seeks?|pursues?|investigates?)\s+(.+)/i,
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
  
  // PHASE 3 FIX: Headline truncation fallback - use first 4-5 meaningful words
  // This ensures we ALWAYS generate something rather than returning null
  const words = titleClean.split(/\s+/).filter(w => w.length > 1);
  if (words.length >= 3) {
    // Take first 4-5 words, title case them
    const truncated = words.slice(0, 5).map(w =>
      w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    ).join(' ');

    // Check if it contains at least one entity (to ensure relevance)
    const topEntity = entities[0]?.canonical || entities[0]?.name || '';
    const entityInTruncated = topEntity && truncated.toLowerCase().includes(topEntity.toLowerCase().split(' ')[0]);

    if (entityInTruncated || words.length >= 4) {
      console.log(`[FALLBACK] Headline truncation: "${truncated}" from "${title.substring(0, 50)}..."`);
      return truncated;
    }
  }

  // PHASE 2: Last resort - combine top entity with context word from headline
  if (entities.length >= 1) {
    const topEntity = entities[0].canonical || entities[0].name;
    // Find a context word from headline that isn't the entity
    const contextWords = words.filter(w =>
      !topEntity.toLowerCase().includes(w.toLowerCase()) &&
      w.length > 3 &&
      !['the', 'and', 'for', 'with', 'from', 'that', 'this', 'have', 'has', 'been', 'were', 'will'].includes(w.toLowerCase())
    );

    if (contextWords.length > 0) {
      const phrase = `${topEntity} ${contextWords[0].charAt(0).toUpperCase() + contextWords[0].slice(1).toLowerCase()}`;
      if (phrase.split(/\s+/).length >= 2) {
        console.log(`[FALLBACK] Entity+context: "${phrase}" from "${title.substring(0, 50)}..."`);
        return phrase;
      }
    }
  }

  // Absolute last resort: just use the top entity name if it's multi-word
  if (entities.length >= 1) {
    const topEntity = entities[0].canonical || entities[0].name;
    if (topEntity.split(/\s+/).length >= 2) {
      return topEntity;
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
  
  // PHASE 3 FIX: Enhanced prompt with MANDATORY event phrase requirement
  const prompt = `Extract EVENT PHRASES (MANDATORY) and named entities from these headlines for Twitter-style trending.

${itemsText}

**MANDATORY REQUIREMENT**: Every headline MUST have at least ONE event_phrase. If you cannot find an obvious event, create one from the headline using this formula:
- Take the SUBJECT (who/what) + VERB (action word) + OBJECT (affected thing)
- Example: "ICE arrests migrants in Chicago" → "ICE Arrests Migrants"

For EACH item, extract:

1. **event_phrases** (REQUIRED - at least ONE per headline):
   3-5 word phrases describing WHAT IS HAPPENING:

   Pattern: [Subject] [Verb] [Object/Target]

   GOOD examples:
   - "House Passes Border Bill"
   - "Trump Fires FBI Director"
   - "ICE Raids Chicago Sanctuary"
   - "Supreme Court Blocks Ban"
   - "Democrats Honor MLK Legacy"
   - "Florida Faces Storm Threat"

   BAD (these are entities, NOT events):
   - "Donald Trump" ❌
   - "ICE" ❌
   - "Gaza" ❌
   - "Democratic Party" ❌

   **IF NO OBVIOUS EVENT**: Use the headline's first 4-5 words if they form a coherent phrase.

2. **entities** (secondary metadata):
   - PERSON: Full names ("Donald Trump", "Joe Biden")
   - ORG: Organizations ("FBI", "Supreme Court")
   - GPE: Places ("Gaza", "Florida")

3. **sentiment**: -1.0 to 1.0

CRITICAL:
- event_phrases array MUST NOT be empty
- DO NOT return only entities - that is a FAILURE
- If unsure, use headline's first meaningful phrase as event_phrase

Return JSON array:
[{"index": 0, "event_phrases": ["Trump Fires FBI Director"], "entities": [{"name": "Donald Trump", "type": "PERSON"}, {"name": "FBI", "type": "ORG"}], "sentiment": -0.3, "sentiment_label": "negative"}]`;

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
            content: 'You are an NER system that MUST extract event phrases from every headline. Event phrases describe WHAT IS HAPPENING (e.g., "Trump Fires Director", "ICE Raids City"). NEVER return empty event_phrases - always generate at least one phrase using Subject+Verb+Object pattern. Output ONLY valid JSON arrays.'
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

    // SECURITY: Require cron secret or admin JWT
    const authResult = await validateCronOrAdmin(req, supabase);
    if (!authResult.valid) {
      console.error('[batch-analyze-content] Unauthorized access attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Rate limiting
    const rateLimit = await checkRateLimit('batch-analyze-content', 6, 60000);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', resetAt: rateLimit.resetAt }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Load entity aliases for canonicalization
    await loadEntityAliases(supabase);

    const { source_type, batch_size = 50, use_ai = true } = await req.json().catch(() => ({}));
    
    console.log(`[batch-analyze-content] NER + keyphrase extraction, source: ${source_type || 'all'}, batch: ${batch_size}, use_ai: ${use_ai}`);
    
    let processedCount = 0;
    let entitiesExtracted = 0;
    let phrasesExtracted = 0;
    
    // Track label quality for Phase F fallback metrics
    let eventPhraseCount = 0;
    let entityOnlyCount = 0;
    let fallbackGeneratedCount = 0;
    
    // Process Google News with AI NER
    // Note: google_news_articles uses ai_processed flag
    if (!source_type || source_type === 'google_news') {
      const { data: newsItems, error: newsError } = await supabase
        .from('google_news_articles')
        .select('id, title, description')
        .eq('ai_processed', false)
        .order('published_at', { ascending: false })
        .limit(batch_size);
      
      console.log(`[BATCH] Google News query: found ${newsItems?.length || 0} unprocessed items${newsError ? `, error: ${newsError.message}` : ''}`);
      
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
          let nerResult = nerResults.get(item.id);
          
          // If AI didn't process this item, use basic extraction
          if (!nerResult) {
            nerResult = extractBasicEntities(item.title, item.description);
          }
          
          // PHASE F: If AI returned entities but no event phrases, trigger fallback
          if (nerResult.label_quality === 'entity_only' && nerResult.entities.length > 0 && nerResult.event_phrases.length === 0) {
            const fallbackPhrase = generateFallbackEventPhrase(item.title, nerResult.entities);
            if (fallbackPhrase) {
              nerResult = {
                ...nerResult,
                event_phrases: [fallbackPhrase],
                label_quality: 'fallback_generated'
              };
              console.log(`[FALLBACK] Google News: Generated "${fallbackPhrase}" from "${item.title.substring(0, 60)}..."`);
            }
          }
          
          // Track label quality metrics
          if (nerResult.label_quality === 'event_phrase') eventPhraseCount++;
          else if (nerResult.label_quality === 'fallback_generated') fallbackGeneratedCount++;
          else entityOnlyCount++;
          
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
    // Note: reddit_posts uses ai_processed flag
    if (!source_type || source_type === 'reddit') {
      const { data: redditItems, error: redditError } = await supabase
        .from('reddit_posts')
        .select('id, title, selftext')
        .eq('ai_processed', false)
        .order('created_utc', { ascending: false })
        .limit(batch_size);
      
      console.log(`[BATCH] Reddit query: found ${redditItems?.length || 0} unprocessed items${redditError ? `, error: ${redditError.message}` : ''}`);
      
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
          let nerResult = nerResults.get(item.id);
          
          if (!nerResult) {
            nerResult = extractBasicEntities(item.title, item.selftext);
          }
          
          // PHASE F: If AI returned entities but no event phrases, trigger fallback
          if (nerResult.label_quality === 'entity_only' && nerResult.entities.length > 0 && nerResult.event_phrases.length === 0) {
            const fallbackPhrase = generateFallbackEventPhrase(item.title, nerResult.entities);
            if (fallbackPhrase) {
              nerResult = {
                ...nerResult,
                event_phrases: [fallbackPhrase],
                label_quality: 'fallback_generated'
              };
              console.log(`[FALLBACK] Reddit: Generated "${fallbackPhrase}" from "${item.title.substring(0, 60)}..."`);
            }
          }
          
          // Track label quality metrics
          if (nerResult.label_quality === 'event_phrase') eventPhraseCount++;
          else if (nerResult.label_quality === 'fallback_generated') fallbackGeneratedCount++;
          else entityOnlyCount++;
          
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
    // FIX: Use topics_extracted = false instead of extracted_topics IS NULL
    // because articles may have an empty array [] which is NOT NULL
    if (!source_type || source_type === 'rss') {
      const { data: rssItems, error: rssError } = await supabase
        .from('articles')
        .select('id, title, description')
        .or('topics_extracted.eq.false,topics_extracted.is.null')
        .order('published_date', { ascending: false })
        .limit(batch_size);
      
      console.log(`[BATCH] RSS query: found ${rssItems?.length || 0} unprocessed items${rssError ? `, error: ${rssError.message}` : ''}`);
      
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
          let nerResult = nerResults.get(item.id);
          
          if (!nerResult) {
            nerResult = extractBasicEntities(item.title, item.description);
          }
          
          // PHASE F: If AI returned entities but no event phrases, trigger fallback
          if (nerResult.label_quality === 'entity_only' && nerResult.entities.length > 0 && nerResult.event_phrases.length === 0) {
            const fallbackPhrase = generateFallbackEventPhrase(item.title, nerResult.entities);
            if (fallbackPhrase) {
              nerResult = {
                ...nerResult,
                event_phrases: [fallbackPhrase],
                label_quality: 'fallback_generated'
              };
              console.log(`[FALLBACK] RSS: Generated "${fallbackPhrase}" from "${item.title.substring(0, 60)}..."`);
            }
          }
          
          // Track label quality metrics
          if (nerResult.label_quality === 'event_phrase') eventPhraseCount++;
          else if (nerResult.label_quality === 'fallback_generated') fallbackGeneratedCount++;
          else entityOnlyCount++;
          
          // Build extracted_topics with entity types and label_quality
          const extractedTopics = [
            ...nerResult.entities.map(e => ({
              topic: e.canonical,
              entity_type: e.type,
              is_event_phrase: false,
              label_quality: nerResult.label_quality
            })),
            ...nerResult.event_phrases.map(p => ({
              topic: p,
              entity_type: 'EVENT_PHRASE',
              is_event_phrase: true,
              label_quality: nerResult.label_quality
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
    
    // PHASE F: Log label quality metrics for verification
    const totalLabeled = eventPhraseCount + entityOnlyCount + fallbackGeneratedCount;
    const fallbackPct = totalLabeled > 0 ? ((fallbackGeneratedCount / totalLabeled) * 100).toFixed(1) : '0';
    const eventPhrasePct = totalLabeled > 0 ? ((eventPhraseCount / totalLabeled) * 100).toFixed(1) : '0';
    const entityOnlyPct = totalLabeled > 0 ? ((entityOnlyCount / totalLabeled) * 100).toFixed(1) : '0';
    
    console.log(`[LABEL QUALITY] event_phrase: ${eventPhraseCount} (${eventPhrasePct}%), entity_only: ${entityOnlyCount} (${entityOnlyPct}%), fallback_generated: ${fallbackGeneratedCount} (${fallbackPct}%)`);
    
    if (fallbackGeneratedCount > 0) {
      console.log(`[FALLBACK SUCCESS] Generated ${fallbackGeneratedCount} fallback phrases from entity-only results`);
    } else if (entityOnlyCount > 5) {
      console.warn(`[FALLBACK WARNING] ${entityOnlyCount} entity-only results without fallback generation - check generateFallbackEventPhrase patterns`);
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
      label_quality: {
        event_phrase: eventPhraseCount,
        entity_only: entityOnlyCount,
        fallback_generated: fallbackGeneratedCount,
        fallback_pct: parseFloat(fallbackPct)
      },
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

