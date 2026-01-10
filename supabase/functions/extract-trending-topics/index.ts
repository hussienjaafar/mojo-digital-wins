import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { getCorsHeaders, validateCronOrAdmin, logJobFailure, checkRateLimit } from "../_shared/security.ts";

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

if (!LOVABLE_API_KEY) {
  console.error('LOVABLE_API_KEY not configured');
}

interface ExtractedTopic {
  topic: string;
  keywords: string[];
  relevance: number;
}

// Topic normalization map - maps variations to canonical forms
const TOPIC_NORMALIZATIONS: Record<string, string> = {
  'donald trump': 'Donald Trump',
  'trump': 'Donald Trump',
  'president trump': 'Donald Trump',
  'joe biden': 'Joe Biden',
  'biden': 'Joe Biden',
  'president biden': 'Joe Biden',
  'netanyahu': 'Benjamin Netanyahu',
  'benjamin netanyahu': 'Benjamin Netanyahu',
  'israel': 'Israel',
  'palestine': 'Palestine',
  'gaza': 'Gaza',
  'gaza strip': 'Gaza',
  'west bank': 'West Bank',
  'un': 'United Nations',
  'united nations': 'United Nations',
  'ice': 'ICE',
  'immigration and customs enforcement': 'ICE',
  'epa': 'EPA',
  'environmental protection agency': 'EPA',
  'fbi': 'FBI',
  'federal bureau of investigation': 'FBI',
  'cia': 'CIA',
  'central intelligence agency': 'CIA',
  'nato': 'NATO',
  'us': 'United States',
  'usa': 'United States',
  'united states': 'United States',
  'new york': 'New York',
  'new york city': 'New York City',
  'nyc': 'New York City',
  'dc': 'Washington DC',
  'washington': 'Washington DC',
  'washington dc': 'Washington DC',
};

// Database-loaded aliases (populated at runtime)
let dbAliases: Map<string, string> = new Map();

/**
 * Normalize topic to canonical form using hybrid resolution:
 * 1. Database aliases (most current)
 * 2. Hardcoded normalizations (fallback)
 */
function normalizeTopic(topic: string): string {
  const lower = topic.toLowerCase().trim();
  
  // Priority 1: Check database aliases
  if (dbAliases.has(lower)) {
    return dbAliases.get(lower)!;
  }
  
  // Priority 2: Check hardcoded normalizations
  if (TOPIC_NORMALIZATIONS[lower]) {
    return TOPIC_NORMALIZATIONS[lower];
  }
  
  return topic;
}

/**
 * Load entity aliases from database
 */
async function loadEntityAliases(supabase: any): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('entity_aliases')
      .select('raw_name, canonical_name')
      .order('usage_count', { ascending: false });
    
    if (data && !error) {
      dbAliases = new Map();
      for (const alias of data) {
        dbAliases.set(alias.raw_name.toLowerCase(), alias.canonical_name);
      }
      console.log(`Loaded ${dbAliases.size} entity aliases from database`);
    }
  } catch (e) {
    console.error('Failed to load entity aliases:', e);
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // SECURITY: Require cron secret or admin JWT
    const authResult = await validateCronOrAdmin(req, supabase);
    if (!authResult.valid) {
      console.error('[extract-trending-topics] Unauthorized access attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log(`[extract-trending-topics] Authorized via ${authResult.isAdmin ? 'admin' : 'cron'}`);

    // SECURITY: Rate limiting
    const rateLimit = await checkRateLimit('extract-trending-topics', 20, 60000);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', resetAt: rateLimit.resetAt }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔍 Extracting trending topics from recent articles...');

    // Load entity aliases from database for hybrid resolution
    await loadEntityAliases(supabase);

    const body = await req.json().catch(() => ({}));
    const hoursBack = body.hoursBack || 2; // Analyze last 2 hours (expanded from 30 min to reduce backlog risk)

    // Function timeout tracker
    const startTime = Date.now();
    const FUNCTION_TIMEOUT_MS = 45000; // 45 seconds

    // ====================================================================
    // 1. FETCH RECENT ARTICLES
    // ====================================================================
    const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

    const { data: articles, error: fetchError } = await supabase
      .from('articles')
      .select('id, title, description, content, source_name, published_date, sentiment_label, sentiment_score')
      .eq('topics_extracted', false)
      .gte('published_date', cutoffTime)
      .order('published_date', { ascending: false })
      .limit(200); // Expanded from 50 to reduce backlog risk

    if (fetchError) throw fetchError;

    if (!articles || articles.length === 0) {
      console.log('No new articles to analyze');
      return new Response(
        JSON.stringify({ message: 'No new articles found', topicCount: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📰 Analyzing ${articles.length} NEW articles (never analyzed before) from last ${hoursBack} hour(s)`);

    // ====================================================================
    // 2. USE AI TO EXTRACT TOPICS FROM ARTICLE CONTENT
    // ====================================================================

    // Batch articles into groups for AI analysis (larger batches = fewer API calls)
    const batchSize = 20;
    const AI_TIMEOUT_MS = 30000; // 30 seconds per batch
    const allTopics: Map<string, {
      count: number;
      articleIds: string[];
      sampleTitles: string[];
      keywords: Set<string>;
      sentimentScores: number[];
      sentimentLabels: string[];
    }> = new Map();

    for (let i = 0; i < articles.length; i += batchSize) {
      // Check if we're approaching function timeout
      if (Date.now() - startTime > FUNCTION_TIMEOUT_MS - 5000) {
        console.log(`⏱️ Approaching timeout, stopping after processing ${i} articles`);
        break;
      }

      const batch = articles.slice(i, i + batchSize);

      const articlesText = batch.map(a =>
        `ID: ${a.id}\nTitle: ${a.title}\nContent: ${(a.description || a.content || '').substring(0, 500)}`
      ).join('\n\n---\n\n');

      // PHASE 2: Enhanced NER + Keyphrase extraction prompt - prioritizes event phrases
      const extractionPrompt = `Extract EVENT PHRASES (primary) and named entities (secondary) from these headlines for Twitter-style trending.

${articlesText}

For EACH headline, extract in ORDER OF PRIORITY:

1. **EVENT PHRASES** (PRIMARY - these become the trend labels):
   Multi-word verb-centered phrases (2-5 words) that describe WHAT is happening:
   - GOOD: "House Passes Border Bill", "Trump Fires FBI Director", "Gaza Ceasefire Collapses"
   - GOOD: "Supreme Court Blocks Abortion Ban", "DOJ Indicts Senator", "Texas Sues Biden"
   - BAD: Just names like "Donald Trump", "FBI", "Gaza" (these are entities, not events)
   
   REQUIRE: Subject + Verb + Object pattern when possible
   - "[Who] [Does What] [To Whom/What]"
   
   Mark these with type: "event_phrase"

2. **ENTITIES** (SECONDARY - metadata, not primary labels):
   - PERSON: Full canonical names ("Donald Trump", NOT "Trump")
   - ORG: Organizations ("Supreme Court", "FBI", "Democratic Party")  
   - GPE: Locations ("Gaza", "Texas", "Washington DC")
   - Single-word only for well-known acronyms: "NATO", "FBI", "DOGE", "ICE"
   
   Mark these with appropriate type: "person", "org", "location"

CRITICAL RULES:
- PRIORITIZE event phrases over single entities as the trending topic
- Event phrases MUST describe an action/event, not just a person or place
- Use FULL NAMES for people: "Donald Trump" not "Trump", "Joe Biden" not "Biden"
- DO NOT include news publishers (CNN, Reuters, AP, BBC)
- DO NOT extract categories ("immigration", "politics", "healthcare")
- Each headline should ideally produce at least ONE event phrase

Return JSON array:
[{"topic": "Trump Fires FBI Director", "keywords": ["trump", "fbi", "fired"], "relevance": 0.95, "type": "event_phrase"},
 {"topic": "Donald Trump", "keywords": ["trump", "president"], "relevance": 0.8, "type": "person"},
 {"topic": "FBI", "keywords": ["fbi", "director"], "relevance": 0.7, "type": "org"}]`;

      try {
        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('AI request timeout')), AI_TIMEOUT_MS);
        });

        // Race AI request against timeout
        const aiResponse = await Promise.race([
          fetch(AI_GATEWAY_URL, {
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
                  content: 'You extract verb-centered event phrases (primary) and proper noun entities (secondary) from news headlines. Event phrases describe WHAT HAPPENED with Subject + Verb + Object structure. Entities are metadata. Always respond with valid JSON arrays.'
                },
                {
                  role: 'user',
                  content: extractionPrompt
                }
              ]
            }),
          }),
          timeoutPromise
        ]);

        if (!aiResponse.ok) {
          console.error(`AI API error: ${aiResponse.status} for batch ${i}-${i + batchSize}`);
          // Continue processing other batches instead of failing completely
          continue;
        }

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content;

        if (!content) {
          console.error('No content in AI response');
          continue;
        }

        // Parse AI response with robust JSON extraction
        let extractedTopics: ExtractedTopic[] = [];
        try {
          // Remove markdown code blocks if present
          const cleanedContent = content
            .replace(/```json\s*/g, '')
            .replace(/```\s*/g, '')
            .trim();
          
          const parsed = JSON.parse(cleanedContent);
          extractedTopics = Array.isArray(parsed) ? parsed : (parsed.topics || []);
        } catch (e) {
          console.error('Failed to parse AI response:', e);
          console.error('Raw content:', content.substring(0, 200));
          continue;
        }

        // =================================================================
        // VALIDATION: Event-Phrase-Only Filter (Phase 2 migration)
        // =================================================================
        // This filter now REQUIRES event phrases (2-6 words with action verbs)
        // and REJECTS single-word proper nouns to provide descriptive trend labels.
        
        // Action verbs that indicate an event (Subject + Verb + Object pattern)
        const actionVerbs = [
          'passes', 'pass', 'blocks', 'block', 'rejects', 'reject', 'approves', 'approve',
          'signs', 'sign', 'fires', 'fire', 'resigns', 'resign', 'announces', 'announce',
          'launches', 'launch', 'bans', 'ban', 'arrests', 'arrest', 'indicts', 'indict',
          'sues', 'sue', 'votes', 'vote', 'confirms', 'confirm', 'nominates', 'nominate',
          'withdraws', 'withdraw', 'expands', 'expand', 'cuts', 'cut', 'raises', 'raise',
          'drops', 'drop', 'ends', 'end', 'starts', 'start', 'wins', 'win', 'loses', 'lose',
          'threatens', 'threaten', 'warns', 'warn', 'demands', 'demand', 'orders', 'order',
          'halts', 'halt', 'suspends', 'suspend', 'reverses', 'reverse', 'overturns', 'overturn',
          'strikes', 'strike', 'attacks', 'attack', 'invades', 'invade', 'sanctions', 'sanction',
          'targets', 'target', 'seizes', 'seize', 'raids', 'raid', 'collapses', 'collapse'
        ];
        
        // Event nouns that indicate something happened
        const eventNouns = [
          'ruling', 'trial', 'hearing', 'shooting', 'protest', 'debate', 'speech', 'summit',
          'crisis', 'scandal', 'resignation', 'nomination', 'confirmation', 'sanctions',
          'tariffs', 'investigation', 'indictment', 'verdict', 'vote', 'bill', 'ceasefire',
          'bombing', 'strike', 'raid', 'attack', 'collapse', 'shutdown', 'impeachment',
          'acquittal', 'conviction', 'deportation', 'pardon', 'veto', 'filibuster'
        ];

        // News sources that should NOT be trending topics (they're publishers, not news)
        const newsSources = [
          'associated press', 'ap news', 'reuters', 'bbc', 'cnn', 'fox news', 'nbc', 'cbs', 'abc',
          'washington post', 'new york times', 'wall street journal', 'guardian',
          'al jazeera', 'npr', 'politico', 'the hill', 'daily wire', 'axios',
          'bloomberg', 'cnbc', 'the intercept', 'mondoweiss', 'democracy now',
          'middle east eye', 'electronic intifada', 'cair', 'national review',
          'dropsite news', 'drop site', 'breitbart', 'mediaite', 'abc news',
          'nbc news', 'cbs news', 'world of travel'
        ];

        const beforeFilter = extractedTopics.length;
        extractedTopics = extractedTopics.filter(topic => {
          const topicLower = topic.topic.toLowerCase();
          const words = topicLower.split(/\s+/);

          // CRITICAL: Require 2-6 words (event phrases, NOT single-word entities)
          if (words.length < 2) {
            console.log(`❌ Filtered "${topic.topic}": single-word entity (not an event phrase)`);
            return false;
          }
          if (words.length > 6) {
            console.log(`❌ Filtered "${topic.topic}": too many words (>6)`);
            return false;
          }

          // Must start with capital letter (proper noun or title case)
          if (topic.topic[0] !== topic.topic[0].toUpperCase()) {
            console.log(`❌ Filtered "${topic.topic}": doesn't start with capital`);
            return false;
          }

          // Must not be a news source
          const isNewsSource = newsSources.some(source => {
            const cleanTopic = topicLower.replace(/[!?.,'"-]/g, '').trim();
            const cleanSource = source.replace(/[!?.,'"-]/g, '').trim();
            return cleanTopic.includes(cleanSource) || cleanSource.includes(cleanTopic);
          });

          if (isNewsSource) {
            console.log(`❌ Filtered "${topic.topic}": news source/publisher`);
            return false;
          }

          // Check for action verb OR event noun (what makes it an "event phrase")
          const hasActionVerb = actionVerbs.some(v => words.includes(v));
          const hasEventNoun = eventNouns.some(n => words.includes(n));
          
          // If it has type "event_phrase" from AI, trust it
          const isMarkedEventPhrase = (topic as any).type === 'event_phrase';
          
          // Accept if: marked as event_phrase OR has action verb OR has event noun
          if (!isMarkedEventPhrase && !hasActionVerb && !hasEventNoun) {
            // Last chance: check if it looks like Subject + Verb pattern
            // (2+ words with at least one ending in -s, -ed, -ing which suggests a verb)
            const hasVerbPattern = words.some(w => 
              /(?:s|ed|ing)$/.test(w) && w.length > 3 && !['news', 'states', 'united'].includes(w)
            );
            
            if (!hasVerbPattern) {
              console.log(`❌ Filtered "${topic.topic}": no action verb/event noun (not descriptive)`);
              return false;
            }
          }

          // Must not be just common words
          const commonWords = ['the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'new', 'old', 'and', 'or'];
          if (words.every(word => commonWords.includes(word))) {
            console.log(`❌ Filtered "${topic.topic}": only common words`);
            return false;
          }

          console.log(`✅ Keeping event phrase: "${topic.topic}"`);
          return true;
        });

        console.log(`Validation: ${beforeFilter} extracted → ${extractedTopics.length} valid event phrases`);

        // Aggregate topics
        for (const extracted of extractedTopics) {
          // Normalize topic to canonical form
          const normalizedTopic = normalizeTopic(extracted.topic);
          const topicKey = normalizedTopic.toLowerCase();

          if (!allTopics.has(topicKey)) {
            allTopics.set(topicKey, {
              count: 0,
              articleIds: [],
              sampleTitles: [],
              keywords: new Set(),
              sentimentScores: [],
              sentimentLabels: [],
            });
          }

          const topicData = allTopics.get(topicKey)!;

          // Find which articles in this batch mention this topic
          for (const article of batch) {
            const articleText = `${article.title} ${article.description || ''} ${article.content || ''}`.toLowerCase();
            const topicWords = normalizedTopic.toLowerCase().split(/\s+/);
            const keywordMatches = extracted.keywords.filter(kw =>
              articleText.includes(kw.toLowerCase())
            );

            // Check if article is relevant to this topic
            if (keywordMatches.length >= 2 || topicWords.every(word => articleText.includes(word))) {
              topicData.count++;
              topicData.articleIds.push(article.id);
              topicData.sampleTitles.push(article.title);
              topicData.sentimentScores.push(article.sentiment_score || 0.5);
              topicData.sentimentLabels.push(article.sentiment_label || 'neutral');

              extracted.keywords.forEach(kw => topicData.keywords.add(kw));
            }
          }
        }

        // Mark articles in this batch as analyzed with their extracted topics (normalized)
        const articleUpdates = batch.map(article => ({
          id: article.id,
          topics_extracted: true,
          topics_extracted_at: new Date().toISOString(),
          extracted_topics: extractedTopics.map(topic => ({
            ...topic,
            topic: normalizeTopic(topic.topic) // Store normalized form
          })).filter(topic => {
            const articleText = `${article.title} ${article.description || ''}`.toLowerCase();
            return topic.keywords.some(kw => articleText.includes(kw.toLowerCase()));
          })
        }));

        for (const update of articleUpdates) {
          await supabase
            .from('articles')
            .update({
              topics_extracted: update.topics_extracted,
              topics_extracted_at: update.topics_extracted_at,
              extracted_topics: update.extracted_topics
            })
            .eq('id', update.id);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error(`Error processing batch ${i}-${i + batchSize}:`, error instanceof Error ? error.message : error);
        // Continue processing remaining batches instead of failing completely
        continue;
      }
    }

    // ====================================================================
    // 3. CALCULATE VELOCITY & MOMENTUM, STORE TRENDING TOPICS
    // ====================================================================

    const currentHour = new Date();
    currentHour.setMinutes(0, 0, 0);
    const currentDate = currentHour.toISOString().split('T')[0];

    // Get previous hour's data for velocity calculation
    const previousHour = new Date(currentHour);
    previousHour.setHours(previousHour.getHours() - 1);

    const { data: previousData } = await supabase
      .from('trending_topics')
      .select('topic, mention_count')
      .eq('hour_timestamp', previousHour.toISOString());

    const previousMentions = new Map(
      (previousData || []).map((t: any) => [t.topic, t.mention_count])
    );

    let topicsInserted = 0;

    for (const [topicKey, data] of allTopics.entries()) {
      // Store topics with at least 1 mention (Twitter-style: even single breaking news counts)
      if (data.count < 1) continue;

      const avgSentiment = data.sentimentScores.reduce((a, b) => a + b, 0) / data.sentimentScores.length;

      const posCount = data.sentimentLabels.filter(s => s === 'positive').length;
      const neuCount = data.sentimentLabels.filter(s => s === 'neutral').length;
      const negCount = data.sentimentLabels.filter(s => s === 'negative').length;

      // Calculate velocity: (current - previous) / previous * 100
      const prevCount = previousMentions.get(topicKey) || 0;
      const velocity = prevCount > 0 
        ? ((data.count - prevCount) / prevCount) * 100 
        : data.count > 0 ? 100 : 0; // 100% if new topic with mentions

      // Calculate momentum: change in velocity (acceleration)
      // Get velocity from 2 hours ago to measure acceleration
      const twoHoursAgo = new Date(currentHour);
      twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);
      
      const { data: twoHoursData } = await supabase
        .from('trending_topics')
        .select('mention_count, velocity_score')
        .eq('topic', topicKey)
        .eq('hour_timestamp', twoHoursAgo.toISOString())
        .single();
      
      const previousVelocity = twoHoursData?.velocity_score || 0;
      const momentum = velocity - previousVelocity; // Positive = accelerating, negative = decelerating

      const topicRecord = {
        topic: topicKey,
        mention_count: data.count,
        hour_timestamp: currentHour.toISOString(),
        trending_hour: currentHour.toISOString(),
        day_date: currentDate,
        avg_sentiment_score: avgSentiment,
        positive_count: posCount,
        neutral_count: neuCount,
        negative_count: negCount,
        velocity_score: velocity,
        momentum_score: momentum,
        article_ids: data.articleIds.slice(0, 20),
        sample_titles: data.sampleTitles.slice(0, 5),
        related_keywords: Array.from(data.keywords).slice(0, 10),
      };

      const { error: upsertError } = await supabase
        .from('trending_topics')
        .upsert(topicRecord, {
          onConflict: 'topic,hour_timestamp',
          ignoreDuplicates: false,
        });

      if (upsertError) {
        console.error(`Error upserting topic "${topicKey}":`, upsertError);
      } else {
        topicsInserted++;
        console.log(`✅ Topic "${topicKey}": ${data.count} mentions (${velocity > 0 ? '+' : ''}${velocity.toFixed(0)}% velocity), sentiment ${avgSentiment.toFixed(2)}`);
      }
    }

    // ====================================================================
    // 4. RETURN RESULTS
    // ====================================================================

    const result = {
      articlesAnalyzed: articles.length,
      topicsExtracted: allTopics.size,
      topicsStored: topicsInserted,
      timeRange: `${hoursBack} hour(s)`,
      timestamp: new Date().toISOString(),
      topTopics: Array.from(allTopics.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10)
        .map(([topic, data]) => ({
          topic,
          mentions: data.count,
          avgSentiment: (data.sentimentScores.reduce((a, b) => a + b, 0) / data.sentimentScores.length).toFixed(2)
        }))
    };

    console.log(`\n✨ Extraction complete: ${topicsInserted} topics stored`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-trending-topics:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
