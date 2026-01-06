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
 * Validate event phrase quality - must be 2-5 words, descriptive
 */
function isValidEventPhrase(phrase: string): boolean {
  const words = phrase.trim().split(/\s+/);
  if (words.length < 2 || words.length > 5) return false;
  
  // Must contain at least one proper noun or action word
  const hasProperNoun = /[A-Z][a-z]+/.test(phrase);
  const actionWords = ['vote', 'bill', 'ruling', 'trial', 'hearing', 'arrest', 'shooting', 
                       'protest', 'election', 'debate', 'speech', 'summit', 'policy', 
                       'resignation', 'nomination', 'confirmation', 'sanctions', 'tariffs'];
  const hasAction = actionWords.some(w => phrase.toLowerCase().includes(w));
  
  return hasProperNoun || hasAction;
}

/**
 * NER + Keyphrase extraction using AI
 * Returns canonical entities and multi-word event phrases
 */
async function extractNERWithAI(items: ContentItem[]): Promise<Map<string, NERResult>> {
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY not configured');
  }
  
  const results = new Map<string, NERResult>();
  
  // Batch items (max 20 per request for efficiency)
  const itemsText = items.slice(0, 20).map((item, i) => 
    `[${i}] ${item.title}${item.description ? ` - ${item.description.substring(0, 200)}` : ''}`
  ).join('\n');
  
  const prompt = `Extract named entities and event phrases from these headlines. Output structured data for trend detection.

${itemsText}

For EACH item, extract:

1. **entities**: Named entities with types:
   - PERSON: Full canonical names (e.g., "Donald Trump", NOT "Trump")
   - ORG: Organizations (e.g., "Supreme Court", "FBI", "Democratic Party")
   - GPE: Locations (e.g., "Gaza", "Texas", "Washington DC")
   - EVENT: Specific events (e.g., "Super Bowl", "G20 Summit")
   - LAW: Bills/laws (e.g., "HR 1234", "Affordable Care Act")
   - PRODUCT: Products/services (e.g., "TikTok", "Truth Social")

2. **event_phrases**: Multi-word descriptive phrases (2-5 words) like Twitter trends:
   Examples: "Trump Tariff Policy", "Gaza Ceasefire Talks", "FBI Director Fired", 
             "Supreme Court Abortion Ruling", "Texas Border Crisis"
   These should capture WHAT is happening, not just WHO.

3. **sentiment**: -1.0 to 1.0

CRITICAL RULES:
- Use FULL CANONICAL NAMES for people: "Donald Trump" not "Trump", "Joe Biden" not "Biden"
- Event phrases must be 2-5 words and descriptive of the news event
- DO NOT include news publishers (CNN, Reuters, AP) as entities
- Single-word entities only for well-known acronyms: "NATO", "FBI", "ICE", "DOGE"

Return JSON array:
[{"index": 0, "entities": [{"name": "Donald Trump", "type": "PERSON"}, {"name": "FBI", "type": "ORG"}], "event_phrases": ["Trump FBI Investigation", "DOJ Probe Expands"], "sentiment": -0.3, "sentiment_label": "negative"}]`;

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
            content: 'You are an NER system that extracts canonical entities and multi-word event phrases from news headlines. Output ONLY valid JSON arrays.' 
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
      const eventPhrases = (analysis.event_phrases || [])
        .map((p: string) => p.trim())
        .filter((p: string) => isValidEventPhrase(p));
      
      results.set(item.id, {
        entities,
        event_phrases: eventPhrases,
        sentiment: analysis.sentiment || 0,
        sentiment_label: analysis.sentiment_label || 'neutral'
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
 */
function extractBasicEntities(title: string, description?: string): NERResult {
  const text = `${title} ${description || ''}`;
  const entities: NERResult['entities'] = [];
  const eventPhrases: string[] = [];
  
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
  
  return {
    entities: entities.slice(0, 5),
    event_phrases: eventPhrases,
    sentiment: Math.round(sentiment * 100) / 100,
    sentiment_label: sentiment > 0.2 ? 'positive' : sentiment < -0.2 ? 'negative' : 'neutral'
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
        let nerResults: Map<string, NERResult> = new Map();
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
        
        let nerResults: Map<string, NERResult> = new Map();
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
        
        let nerResults: Map<string, NERResult> = new Map();
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
