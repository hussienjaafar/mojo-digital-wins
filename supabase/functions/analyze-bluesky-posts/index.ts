import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Use Lovable AI Gateway
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

const VALID_GROUPS = [
  'muslim_american', 'arab_american', 'lgbtq', 'immigrants', 'refugees',
  'black_american', 'latino_hispanic', 'asian_american', 'indigenous',
  'women', 'youth', 'seniors', 'disabled', 'veterans', 'workers',
  'general_public'
];

const VALID_CATEGORIES = [
  'civil_rights', 'immigration', 'healthcare', 'education', 'housing',
  'employment', 'criminal_justice', 'voting_rights', 'religious_freedom',
  'lgbtq_rights', 'foreign_policy', 'climate', 'economy', 'politics', 'other'
];

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
  'fbi': 'FBI',
  'cia': 'CIA',
  'nato': 'NATO',
  'nyc': 'New York City',
  'new york city': 'New York City',
  'dc': 'Washington DC',
  'washington dc': 'Washington DC',
};

// Database-loaded aliases (populated at runtime)
let dbAliases: Map<string, string> = new Map();

// Evergreen topics that should NEVER be extracted as trending topics
const EVERGREEN_BLOCKLIST = new Set([
  // Generic categories
  'politics', 'economy', 'government', 'healthcare', 'education', 'immigration',
  'climate', 'technology', 'security', 'military', 'foreign policy', 'civil rights',
  'human rights', 'criminal justice', 'voting rights', 'religious freedom', 'lgbtq rights',
  // Actions/descriptions
  'debate', 'reform', 'crisis', 'investigation', 'legislation', 'announcement',
  'controversy', 'tensions', 'policy', 'strategy', 'approach', 'movement', 'issues',
  'challenges', 'administration', 'campaign', 'election',
  // Demographics (these go in affected_groups, not topics)
  'workers', 'immigrants', 'refugees', 'veterans', 'seniors', 'youth', 'women',
  'disabled', 'general_public', 'muslim_american', 'arab_american', 'black_american',
  'latino_hispanic', 'asian_american', 'indigenous', 'lgbtq',
]);

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

function isValidProperNoun(topic: string): boolean {
  const lower = topic.toLowerCase();
  const words = lower.split(/\s+/);
  
  // Must be 1-4 words
  if (words.length > 4 || words.length === 0) return false;
  
  // Must start with capital letter
  if (topic[0] !== topic[0].toUpperCase()) return false;
  
  // Must not be in blocklist
  if (EVERGREEN_BLOCKLIST.has(lower)) return false;
  
  // Must not contain blocklist words
  for (const word of words) {
    if (EVERGREEN_BLOCKLIST.has(word)) return false;
  }
  
  return true;
}

// Helper function for robust JSON parsing
function tryParseJSON(text: string): any {
  try {
    return JSON.parse(text);
  } catch (e1) {
    const cleaned = text.replace(/```json|```/g, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch (e2) {
      const arrayMatch = text.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        try {
          return JSON.parse(arrayMatch[0]);
        } catch (e3) {
          const normalized = arrayMatch[0]
            .replace(/\r?\n/g, ' ')
            .replace(/\u201c|\u201d/g, '"')
            .replace(/\u2018|\u2019/g, "'")
            .replace(/,\s*([}\]])/g, '$1');
          return JSON.parse(normalized);
        }
      }
      throw new Error('Could not extract valid JSON from response');
    }
  }
}

interface BlueSkyPost {
  id: string;
  text: string;
  author_handle: string;
  created_at: string;
}

// FIXED: Extract proper nouns ONLY, like Twitter trending
async function analyzePosts(posts: BlueSkyPost[]): Promise<any[]> {
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY not configured');
  }

  const postsText = posts.map((p, i) =>
    `[${i}] @${p.author_handle}: ${p.text}`
  ).join('\n\n');

  // CRITICAL FIX: New prompt that extracts proper nouns only, matching extract-trending-topics
  const prompt = `Analyze these Bluesky posts. Extract ONLY FULL CANONICAL NAMES (proper nouns) - NOT themes or categories.

${postsText}

For EACH post, extract:

1. **topics**: Array of 1-4 PROPER NOUNS with FULL CANONICAL NAMES. Ask: WHO? WHERE? WHAT specific thing?
   EXTRACT with FULL NAMES: 
   - People: "Donald Trump" (NOT "Trump"), "Joe Biden" (NOT "Biden"), "Elon Musk" (NOT "Musk")
   - Places: "Gaza", "Ukraine", "Washington DC"
   - Organizations: "FBI", "Supreme Court", "NATO"
   - Bills: "HR 1234", "S 456"
   
   CRITICAL - USE FULL NAMES:
   ✅ "Donald Trump" (NOT "Trump")
   ✅ "Joe Biden" (NOT "Biden")
   ✅ "Pete Hegseth" (NOT "Hegseth")
   ✅ "Ron DeSantis" (NOT "DeSantis")
   ✅ "Vladimir Putin" (NOT "Putin")
   
   DO NOT EXTRACT: Categories ("immigration"), Actions ("debate"), Descriptions ("crisis")

2. **affected_groups**: Which communities are discussed? Use ONLY these labels:
   muslim_american, arab_american, lgbtq, immigrants, refugees, black_american, 
   latino_hispanic, asian_american, indigenous, women, youth, seniors, disabled, veterans, workers, general_public

3. **relevance_category**: Primary category (civil_rights, immigration, healthcare, education, climate, economy, foreign_policy, criminal_justice, politics, other)

4. **sentiment**: -1.0 to 1.0 (negative to positive)

5. **sentiment_label**: "positive", "neutral", or "negative"

VALIDATION RULES for topics:
- Must be a proper noun (would have a Wikipedia page)
- Must use FULL CANONICAL NAME (First Last for people)
- Must be 1-4 words max
- Must start with capital letter
- NOT a theme/category/action word
- NOT a news publisher
- NEVER use last name alone

Return JSON array:
[{"index": 0, "topics": ["Pete Hegseth", "Pentagon"], "affected_groups": ["veterans"], "relevance_category": "politics", "sentiment": -0.3, "sentiment_label": "negative"}]`;

  const response = await fetch(AI_GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: 'You extract ONLY proper nouns from social posts - names of people, places, organizations, events. NOT themes, categories, or generic terms. Think: WHO, WHERE, WHAT specific thing.' },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) {
    if (response.status === 429) {
      console.log('⚠️ Rate limit hit');
      throw new Error('RATE_LIMIT');
    }
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json();
  const analysisText = data.choices[0].message.content;

  let analyses;
  try {
    analyses = tryParseJSON(analysisText);
  } catch (parseError: any) {
    console.error('[analyze-bluesky-posts] Failed to parse AI response:', parseError.message);
    throw new Error(`JSON parse failed: ${parseError.message}`);
  }

  if (!Array.isArray(analyses)) {
    if (typeof analyses === 'object' && analyses.results) {
      analyses = analyses.results;
    } else {
      throw new Error('AI response is not an array');
    }
  }

  // Map and validate topics
  return posts.map((post, i) => {
    const analysis = analyses.find((a: any) => a.index === i) || {
      topics: [],
      affected_groups: [],
      relevance_category: 'other',
      sentiment: 0,
      sentiment_label: 'neutral'
    };

    // CRITICAL: Filter and normalize topics to proper nouns only
    const validTopics = (analysis.topics || [])
      .map((t: string) => normalizeTopic(t))
      .filter((t: string) => isValidProperNoun(t));

    // Validate affected_groups
    const validGroups = (analysis.affected_groups || [])
      .filter((g: string) => VALID_GROUPS.includes(g));

    // Validate category
    const category = VALID_CATEGORIES.includes(analysis.relevance_category) 
      ? analysis.relevance_category 
      : 'other';

    console.log(`Post ${i}: Extracted ${validTopics.length} proper nouns: ${validTopics.join(', ')}`);

    return {
      id: post.id,
      ai_topics: validTopics,
      affected_groups: validGroups,
      relevance_category: category,
      ai_sentiment: analysis.sentiment,
      ai_sentiment_label: analysis.sentiment_label,
      ai_processed: true,
      ai_processed_at: new Date().toISOString()
    };
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Load entity aliases from database for hybrid resolution
    await loadEntityAliases(supabase);

    // Best-effort status updates
    const markJob = async (status: 'running' | 'success' | 'failed') => {
      await supabase
        .from('scheduled_jobs')
        .update({
          last_run_status: status,
          last_run_at: new Date().toISOString(),
          ...(status === 'success' ? { next_run_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() } : {})
        })
        .eq('job_type', 'analyze_bluesky');
    };

    await markJob('running').catch(() => {});

    console.log('🤖 Starting AI analysis of Bluesky posts (proper nouns only)...');

    const { batchSize = 30, minRelevance = 0.01 } = await req.json().catch(() => ({ batchSize: 30, minRelevance: 0.01 }));

    // Get unprocessed posts
    const { data: posts, error: fetchError } = await supabase
      .from('bluesky_posts')
      .select('id, text, author_handle, created_at')
      .eq('ai_processed', false)
      .gte('ai_relevance_score', Math.max(0, minRelevance))
      .order('created_at', { ascending: false })
      .limit(batchSize);

    if (fetchError) {
      await markJob('failed').catch(() => {});
      throw fetchError;
    }

    if (!posts || posts.length === 0) {
      await markJob('success').catch(() => {});
      return new Response(
        JSON.stringify({ success: true, message: 'No unprocessed posts found', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Found ${posts.length} posts to analyze`);

    // Analyze with timeout
    let analyses: any[];
    try {
      const timeout = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('AI analysis timeout')), 50000)
      );
      analyses = await Promise.race([analyzePosts(posts), timeout]) as any[];
    } catch (error: any) {
      if (error.message === 'AI analysis timeout') {
        console.log('⏱️ Analysis timed out');
        await markJob('success').catch(() => {});
        return new Response(
          JSON.stringify({ success: true, message: 'Timeout', processed: 0, timeout: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }

    // Update posts
    let successCount = 0;
    let errorCount = 0;

    for (const analysis of analyses) {
      try {
        const { error } = await supabase
          .from('bluesky_posts')
          .update({
            ai_topics: analysis.ai_topics,
            affected_groups: analysis.affected_groups,
            relevance_category: analysis.relevance_category,
            ai_sentiment: analysis.ai_sentiment,
            ai_sentiment_label: analysis.ai_sentiment_label,
            ai_processed: true,
            ai_processed_at: analysis.ai_processed_at,
            validation_passed: true
          })
          .eq('id', analysis.id);

        if (error) {
          console.error(`❌ Error updating post ${analysis.id}:`, error);
          errorCount++;
        } else {
          // Insert entity mentions for proper noun topics only
          if (analysis.ai_topics && analysis.ai_topics.length > 0) {
            const post = posts.find(p => p.id === analysis.id);
            const mentions = analysis.ai_topics.map((topic: string) => ({
              entity_name: topic,
              entity_type: 'topic',
              source_type: 'bluesky',
              source_id: analysis.id,
              mentioned_at: post?.created_at || new Date().toISOString(),
              sentiment: analysis.ai_sentiment
            }));

            await supabase.from('entity_mentions').upsert(mentions, {
              onConflict: 'entity_name,source_id,source_type',
              ignoreDuplicates: false
            });
          }
          successCount++;
        }
      } catch (error) {
        console.error(`Error processing post ${analysis.id}:`, error);
        errorCount++;
      }
    }

    // Update checkpoint
    await supabase.from('processing_checkpoints').upsert({
      function_name: 'analyze-bluesky-posts',
      last_processed_at: new Date().toISOString(),
      records_processed: successCount,
      updated_at: new Date().toISOString()
    });

    console.log(`✅ Processed ${successCount} posts, ${errorCount} errors`);

    // Update trends
    let trendResults: any[] | null = null;
    try {
      const result = await supabase.rpc('update_bluesky_trends_optimized', { batch_limit: 20 });
      trendResults = result.data;
      if (result.error) console.error('Trends update error:', result.error);
    } catch (e) {
      console.error('Trends calculation failed:', e);
    }

    // Refresh unified trends view (best effort)
    try {
      await supabase.rpc('refresh_materialized_view', { view_name: 'mv_unified_trends' });
    } catch (e) {
      console.log('Materialized view refresh skipped:', e);
    }

    await markJob('success').catch(() => {});

    return new Response(
      JSON.stringify({
        success: true,
        processed: successCount,
        errors: errorCount,
        topics_extracted: analyses.flatMap(a => a.ai_topics || []).length,
        trends_updated: trendResults?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in analyze-bluesky-posts:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
