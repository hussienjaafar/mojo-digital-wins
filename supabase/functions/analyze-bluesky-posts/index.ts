import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// CRITICAL FIX: Switch to OpenAI GPT-3.5-turbo for 10x rate limits
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Fallback to Lovable AI if OpenAI not configured
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const LOVABLE_API_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

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

// Data validation function
function validateAnalysis(analysis: any): { valid: boolean; errors: string[]; confidence: number } {
  const errors: string[] = [];
  let confidence = 1.0;

  if (!analysis.affected_groups || !Array.isArray(analysis.affected_groups)) {
    errors.push('Missing or invalid affected_groups');
    return { valid: false, errors, confidence: 0 };
  }

  const invalidGroups = analysis.affected_groups.filter(
    (g: string) => !VALID_GROUPS.includes(g)
  );
  if (invalidGroups.length > 0) {
    errors.push(`Invalid groups: ${invalidGroups.join(', ')}`);
    confidence -= 0.3;
  }

  if (analysis.relevance_category && !VALID_CATEGORIES.includes(analysis.relevance_category)) {
    errors.push(`Invalid category: ${analysis.relevance_category}`);
    confidence -= 0.2;
  }

  if (analysis.sentiment !== null && (analysis.sentiment < -1 || analysis.sentiment > 1)) {
    errors.push('Sentiment out of range [-1, 1]');
    confidence -= 0.2;
  }

  const valid = errors.length === 0 || confidence >= 0.5;
  return { valid, errors, confidence: Math.max(0, confidence) };
}

interface BlueSkyPost {
  id: string;
  text: string;
  author_handle: string;
  created_at: string;
}

// Topic normalization map
const TOPIC_NORMALIZATIONS: Record<string, string> = {
  // Political figures
  'donald trump': 'Donald Trump',
  'trump': 'Donald Trump',
  'joe biden': 'Joe Biden',
  'biden': 'Joe Biden',
  'netanyahu': 'Benjamin Netanyahu',
  'benjamin netanyahu': 'Benjamin Netanyahu',

  // Regions & conflicts
  'israel': 'Israel',
  'palestine': 'Palestine',
  'gaza': 'Gaza',
  'west bank': 'West Bank',
  'middle east': 'Middle East',

  // Organizations
  'un': 'United Nations',
  'united nations': 'United Nations',
  'ice': 'ICE',
  'gop': 'Republican Party',
  'republican party': 'Republican Party',
  'democratic party': 'Democratic Party',

  // Cities
  'nyc': 'New York City',
  'new york city': 'New York City',
  'dc': 'Washington DC',
  'washington dc': 'Washington DC',

  // Issues
  'climate change': 'Climate Change',
  'climate crisis': 'Climate Change',
  'human rights': 'Human Rights',
  'civil rights': 'Civil Rights',
  'lgbtq rights': 'LGBTQ Rights',
  'lgbtq': 'LGBTQ Rights',
  'immigration': 'Immigration',
  'surveillance': 'Surveillance',
  'privacy': 'Privacy',
  'genocide': 'Genocide',
  'humanitarian crisis': 'Humanitarian Crisis',
  'occupation': 'Occupation',
  'israel-palestine conflict': 'Israel-Palestine Conflict',
  'palestinian conflict': 'Israel-Palestine Conflict',
};

function normalizeTopic(topic: string): string {
  const lower = topic.toLowerCase();
  return TOPIC_NORMALIZATIONS[lower] || topic;
}

// Helper function for robust JSON parsing
function tryParseJSON(text: string): any {
  // Try direct parse
  try {
    return JSON.parse(text);
  } catch (e1) {
    // Try extracting JSON from markdown
    const cleaned = text.replace(/```json|```/g, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch (e2) {
      // Try extracting first JSON array
      const arrayMatch = text.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        try {
          return JSON.parse(arrayMatch[0]);
        } catch (e3) {
          // Try with light cleanup
          const normalized = arrayMatch[0]
            .replace(/\r?\n/g, ' ')
            .replace(/\u201c|\u201d/g, '"')
            .replace(/\u2018|\u2019/g, "'")
            .replace(/,\s*([}\]])/g, '$1');
          return JSON.parse(normalized);
        }
      }
      // Try extracting first JSON object
      const objMatch = text.match(/\{[\s\S]*\}/);
      if (objMatch) {
        const normalized = objMatch[0]
          .replace(/\r?\n/g, ' ')
          .replace(/\u201c|\u201d/g, '"')
          .replace(/\u2018|\u2019/g, "'")
          .replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(normalized);
      }
      throw new Error('Could not extract valid JSON from response');
    }
  }
}

// Analyze posts using GPT-3.5-turbo (10x rate limits vs Claude)
async function analyzePosts(posts: BlueSkyPost[]): Promise<any[]> {
  // Prefer OpenAI for better rate limits
  const useOpenAI = !!OPENAI_API_KEY;
  const apiKey = useOpenAI ? OPENAI_API_KEY : LOVABLE_API_KEY;
  const apiUrl = useOpenAI ? OPENAI_API_URL : LOVABLE_API_URL;

  if (!apiKey) {
    throw new Error('No API key configured (OPENAI_API_KEY or LOVABLE_API_KEY)');
  }

  // Prepare batch analysis prompt
  const postsText = posts.map((p, i) =>
    `[${i}] @${p.author_handle}: ${p.text}`
  ).join('\n\n');

  const prompt = `Analyze these Bluesky posts comprehensively. Extract:

1. **topics**: Array of 1-5 specific topics (e.g., "immigration policy", "lgbtq rights", "climate legislation")
2. **affected_groups**: Which communities are discussed? Use standardized labels:
   - muslim_american, arab_american, jewish_american, christian
   - lgbtq, transgender, women, reproductive_rights
   - black_american, latino_hispanic, asian_american, indigenous
   - immigrants, refugees, asylum_seekers
   - disabled, seniors, youth, veterans, workers
3. **relevance_category**: Primary category (civil_rights, immigration, healthcare, education, climate, economy, foreign_policy, criminal_justice, etc.)
4. **sentiment**: Overall sentiment (-1.0 to 1.0, where -1 is very negative, 0 neutral, 1 positive)
5. **sentiment_label**: "positive", "neutral", or "negative"

Return ONLY a JSON array with this exact structure:
[
  {
    "index": 0,
    "topics": ["immigration reform", "border security"],
    "affected_groups": ["immigrants", "latino_hispanic"],
    "relevance_category": "immigration",
    "sentiment": -0.4,
    "sentiment_label": "negative"
  }
]

Posts:
${postsText}`;

  const requestBody = useOpenAI
    ? {
        model: 'gpt-3.5-turbo-1106', // Fast, cheap, 10x Claude rate limits
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: "json_object" } // Ensures JSON response
      }
    : {
        model: 'google/gemini-2.0-flash', // Fallback
        messages: [{ role: 'user', content: prompt }]
      };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();

    // Handle rate limits gracefully
    if (response.status === 429) {
      console.log('⚠️ Rate limit hit, will retry later');
      throw new Error('RATE_LIMIT');
    }

    throw new Error(`AI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const analysisText = data.choices[0].message.content;

  // Robust JSON parsing with multiple fallback attempts
  let analyses;
  try {
    analyses = tryParseJSON(analysisText);
  } catch (parseError: any) {
    console.error('[analyze-bluesky-posts] Failed to parse AI response:', parseError.message);
    throw new Error(`JSON parse failed: ${parseError.message}`);
  }

  // Ensure we have an array
  if (!Array.isArray(analyses)) {
    if (typeof analyses === 'object' && analyses.results) {
      analyses = analyses.results; // Sometimes wrapped in { results: [...] }
    } else {
      throw new Error('AI response is not an array');
    }
  }

  // Map analyses back to posts with normalization
  return posts.map((post, i) => {
    const analysis = analyses.find((a: any) => a.index === i) || {
      topics: [],
      affected_groups: [],
      relevance_category: 'general',
      sentiment: 0,
      sentiment_label: 'neutral'
    };

    // Normalize topics
    const normalizedTopics = analysis.topics.map((t: string) => normalizeTopic(t));

    return {
      id: post.id,
      ai_topics: normalizedTopics,
      affected_groups: analysis.affected_groups,
      relevance_category: analysis.relevance_category,
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

    // Best-effort status updates for ops dashboard
    const markJob = async (status: 'running' | 'success' | 'failed') => {
      const nextRun = status === 'success'
        ? new Date(Date.now() + 10 * 60 * 1000).toISOString()
        : null;
      await supabase
        .from('scheduled_jobs')
        .update({
          last_run_status: status,
          last_run_at: new Date().toISOString(),
          ...(nextRun ? { next_run_at: nextRun } : {})
        })
        .eq('job_type', 'analyze_bluesky');
    };

    await markJob('running').catch(() => {});

    console.log('🤖 Starting AI analysis of Bluesky posts...');

    // Increased batch size for GPT-3.5 (better rate limits) and tunable relevance floor
    const { batchSize = 100, minRelevance = 0.01 } = await req.json().catch(() => ({ batchSize: 100, minRelevance: 0.01 }));
    const effectiveMinRelevance = Math.max(0, Number(minRelevance) || 0);

    // Get unprocessed posts with relevance above threshold (default very low to avoid starvation)
    const { data: posts, error: fetchError } = await supabase
      .from('bluesky_posts')
      .select('id, text, author_handle, created_at')
      .eq('ai_processed', false)
      .gte('ai_relevance_score', effectiveMinRelevance)
      .order('created_at', { ascending: false })
      .limit(batchSize);

    if (fetchError) {
      await markJob('failed').catch(() => {});
      throw fetchError;
    }

    if (!posts || posts.length === 0) {
      await markJob('success').catch(() => {});
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No unprocessed posts found',
          processed: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Found ${posts.length} posts to analyze`);

    // Analyze posts using AI
    const analyses = await analyzePosts(posts);

    // Update posts with AI analysis
    let successCount = 0;
    let errorCount = 0;
    let validationFailedCount = 0;

    for (const analysis of analyses) {
      try {
        // Validate analysis
        const validation = validateAnalysis(analysis);

        if (!validation.valid && validation.confidence < 0.5) {
          console.log(`Post ${analysis.id} failed validation:`, validation.errors);
          validationFailedCount++;

          await supabase.from('bluesky_posts').update({
            validation_passed: false,
            validation_errors: validation.errors,
            ai_confidence_score: validation.confidence
          }).eq('id', analysis.id);

          continue;
        }

        const { error } = await supabase
          .from('bluesky_posts')
          .update({
            ai_topics: analysis.ai_topics,
            affected_groups: analysis.affected_groups,
            relevance_category: analysis.relevance_category,
            ai_sentiment: analysis.ai_sentiment,
            ai_sentiment_label: analysis.ai_sentiment_label,
            ai_confidence_score: validation.confidence,
            validation_passed: true,
            validation_errors: validation.errors.length > 0 ? validation.errors : null,
            ai_processed: true,
            ai_processed_at: analysis.ai_processed_at
          })
          .eq('id', analysis.id);

        if (error) {
          console.error(`❌ Error updating post ${analysis.id}:`, error);
          errorCount++;
        } else {
          // Extract and insert entities into entity_mentions
          const entities: Array<{entity_name: string; entity_type: string}> = [];
          
          // Extract from topics
          if (analysis.ai_topics) {
            for (const topic of analysis.ai_topics) {
              entities.push({
                entity_name: topic,
                entity_type: 'topic'
              });
            }
          }

          // Extract from affected groups
          if (analysis.affected_groups) {
            for (const group of analysis.affected_groups) {
              entities.push({
                entity_name: group,
                entity_type: 'affected_group'
              });
            }
          }

          // Insert entity mentions
          if (entities.length > 0) {
            const post = posts.find(p => p.id === analysis.id);
            await supabase.from('entity_mentions').insert(
              entities.map(e => ({
                entity_name: e.entity_name,
                entity_type: e.entity_type,
                source_type: 'bluesky_post',
                source_id: analysis.id,
                mentioned_at: post?.created_at || new Date().toISOString(),
                sentiment: analysis.ai_sentiment
              }))
            );
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

    console.log(`✅ Processed ${successCount} posts, ${validationFailedCount} validation failed, ${errorCount} errors`);

    // FIXED: Use new database function to update trends
    const { data: trendResults, error: trendError } = await supabase
      .rpc('update_bluesky_trends');

    if (trendError) {
      console.error('❌ Error updating trends:', trendError);
    } else {
      console.log(`✅ Updated ${trendResults?.length || 0} trends with proper velocity calculations`);
    }

    // Record performance metrics
    await supabase.from('bluesky_velocity_metrics').insert({
      topics_processed: trendResults?.length || 0,
      trending_detected: trendResults?.filter((t: any) => t.is_trending).length || 0,
      error_count: trendError ? 1 : 0
    });

    const responseBody = {
      success: true,
      processed: successCount,
      validationFailed: validationFailedCount,
      errors: errorCount,
      dataQuality: successCount > 0 ? (successCount / (successCount + validationFailedCount)).toFixed(2) : 0,
      topics_extracted: analyses.flatMap(a => a.ai_topics || []).length,
      trends_updated: trendResults?.length || 0,
      trending_detected: trendResults?.filter((t: any) => t.is_trending).length || 0
    };

    await markJob('success').catch(() => {});

    return new Response(
      JSON.stringify(responseBody),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in analyze-bluesky-posts:', error);
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      await supabase
        .from('scheduled_jobs')
        .update({
          last_run_status: 'failed',
          last_run_at: new Date().toISOString()
        })
        .eq('job_type', 'analyze_bluesky');
    } catch (_err) {}
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
