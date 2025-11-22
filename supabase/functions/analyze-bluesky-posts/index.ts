import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const VALID_GROUPS = [
  'muslim_american', 'arab_american', 'lgbtq', 'immigrants', 'refugees',
  'black_american', 'latino_hispanic', 'asian_american', 'indigenous',
  'women', 'youth', 'seniors', 'disabled', 'veterans', 'workers'
];

const VALID_CATEGORIES = [
  'civil_rights', 'immigration', 'healthcare', 'education', 'housing',
  'employment', 'criminal_justice', 'voting_rights', 'religious_freedom',
  'lgbtq_rights', 'foreign_policy', 'climate', 'economy', 'other'
];

// Simple hash for caching
function hashContent(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

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

// Topic normalization map (same as news extraction)
const TOPIC_NORMALIZATIONS: Record<string, string> = {
  'donald trump': 'Donald Trump',
  'trump': 'Donald Trump',
  'joe biden': 'Joe Biden',
  'biden': 'Joe Biden',
  'netanyahu': 'Benjamin Netanyahu',
  'israel': 'Israel',
  'palestine': 'Palestine',
  'gaza': 'Gaza',
  'un': 'United Nations',
  'ice': 'ICE',
  'nyc': 'New York City',
  'dc': 'Washington DC',
};

function normalizeTopic(topic: string): string {
  const lower = topic.toLowerCase();
  return TOPIC_NORMALIZATIONS[lower] || topic;
}

// Analyze posts using Claude Sonnet 4.5
async function analyzePosts(posts: BlueSkyPost[]): Promise<any[]> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
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
   - black_american, latino, asian_american, indigenous
   - immigrants, refugees, asylum_seekers
   - disability, elderly, youth, veterans
   - general_public (if broadly applicable)
3. **relevance_category**: Primary category (civil_rights, immigration, healthcare, education, climate, economy, national_security, foreign_policy, criminal_justice, etc.)
4. **sentiment**: Overall sentiment (-1.0 to 1.0, where -1 is very negative, 0 neutral, 1 positive)
5. **sentiment_label**: "positive", "neutral", or "negative"

Return ONLY a JSON array with this exact structure:
[
  {
    "index": 0,
    "topics": ["immigration reform", "border security"],
    "affected_groups": ["immigrants", "latino"],
    "relevance_category": "immigration",
    "sentiment": -0.4,
    "sentiment_label": "negative"
  }
]

Posts:
${postsText}`;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const analysisText = data.content[0].text;
  
  const jsonMatch = analysisText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('No JSON array found in Claude response');
  }

  const analyses = JSON.parse(jsonMatch[0]);

  // Map analyses back to posts
  return posts.map((post, i) => {
    const analysis = analyses.find((a: any) => a.index === i) || {
      topics: [],
      affected_groups: [],
      relevance_category: 'general',
      sentiment: 0,
      sentiment_label: 'neutral'
    };

    return {
      id: post.id,
      ai_topics: analysis.topics,
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

    console.log('🤖 Starting AI analysis of Bluesky posts...');

    const { batchSize = 100 } = await req.json().catch(() => ({ batchSize: 100 })); // OPTIMIZATION: Increased from 20 to 100

    // Get unprocessed posts with relevance > 0.1 (matches bluesky-stream filter)
    const { data: posts, error: fetchError } = await supabase
      .from('bluesky_posts')
      .select('id, text, author_handle, created_at')
      .eq('ai_processed', false)
      .gte('ai_relevance_score', 0.1)
      .order('created_at', { ascending: false })
      .limit(batchSize);

    if (fetchError) {
      throw fetchError;
    }

    if (!posts || posts.length === 0) {
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

    // Update posts with AI analysis - with validation
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
          
          await supabase.from('job_failures').insert({
            function_name: 'analyze-bluesky-posts',
            error_message: 'Validation failed: ' + validation.errors.join('; '),
            context_data: { post_id: analysis.id, analysis }
          });
          
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
          
          await supabase.from('job_failures').insert({
            function_name: 'analyze-bluesky-posts',
            error_message: error.message,
            context_data: { post_id: analysis.id }
          });
        } else {
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

    console.log(`✅ Processed ${successCount} posts successfully, ${validationFailedCount} validation failed, ${errorCount} errors`);

    // Update trends based on newly analyzed posts
    await updateTrends(supabase, analyses.filter(a => a.ai_processed));

    return new Response(
      JSON.stringify({
        success: true,
        processed: successCount,
        validationFailed: validationFailedCount,
        errors: errorCount,
        dataQuality: successCount > 0 ? (successCount / (successCount + validationFailedCount)).toFixed(2) : 0,
        topics_extracted: analyses.flatMap(a => a.ai_topics || []).length
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

// Update trends table based on analyzed posts
async function updateTrends(supabase: any, analyses: any[]) {
  console.log('📈 Updating trends...');

  // Extract all unique topics with normalization
  const topicCounts = new Map<string, { count: number, sentiment: number[] }>();

  for (const analysis of analyses) {
    for (const topic of analysis.ai_topics) {
      const normalizedTopic = normalizeTopic(topic);
      
      if (!topicCounts.has(normalizedTopic)) {
        topicCounts.set(normalizedTopic, { count: 0, sentiment: [] });
      }
      const data = topicCounts.get(normalizedTopic)!;
      data.count++;
      data.sentiment.push(analysis.ai_sentiment);
    }
  }

  // Update or insert trends
  for (const [topic, data] of topicCounts.entries()) {
    const avgSentiment = data.sentiment.reduce((a, b) => a + b, 0) / data.sentiment.length;

    // Calculate sentiment breakdown (positive > 0.3, neutral -0.3 to 0.3, negative < -0.3)
    const sentimentPositive = data.sentiment.filter(s => s > 0.3).length;
    const sentimentNeutral = data.sentiment.filter(s => s >= -0.3 && s <= 0.3).length;
    const sentimentNegative = data.sentiment.filter(s => s < -0.3).length;

    // Calculate counts from database using cs (contains) filter for array queries
    const { count: hourCount, error: hourError } = await supabase
      .from('bluesky_posts')
      .select('*', { count: 'exact', head: true })
      .filter('ai_topics', 'cs', `{${topic}}`)
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

    if (hourError) {
      console.error(`❌ Error counting hourly mentions for "${topic}":`, hourError);
    }

    const { count: dayCount, error: dayError } = await supabase
      .from('bluesky_posts')
      .select('*', { count: 'exact', head: true })
      .filter('ai_topics', 'cs', `{${topic}}`)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (dayError) {
      console.error(`❌ Error counting daily mentions for "${topic}":`, dayError);
    }

    const mentionsLastHour = hourCount || 0;
    const mentionsLast24Hours = dayCount || 0;

    // Calculate velocity
    const dailyAvg = mentionsLast24Hours / 24;
    const velocity = dailyAvg > 0 ? ((mentionsLastHour - dailyAvg) / dailyAvg) * 100 : 0;
    const isTrending = velocity > 200; // 200% = 2x normal rate

    // Upsert trend
    const trendData = {
      topic,
      mentions_last_hour: mentionsLastHour,
      mentions_last_24_hours: mentionsLast24Hours,
      velocity,
      sentiment_avg: avgSentiment,
      sentiment_positive: sentimentPositive,
      sentiment_neutral: sentimentNeutral,
      sentiment_negative: sentimentNegative,
      is_trending: isTrending,
      trending_since: isTrending ? new Date().toISOString() : null,
      last_seen_at: new Date().toISOString(),
      calculated_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log(`📊 Upserting trend: ${topic} (hour: ${mentionsLastHour}, day: ${mentionsLast24Hours}, velocity: ${velocity.toFixed(0)}%)`);

    const { error: upsertError } = await supabase
      .from('bluesky_trends')
      .upsert(trendData, {
        onConflict: 'topic'
      });

    if (upsertError) {
      console.error(`❌ Error upserting trend for "${topic}":`, upsertError);
    } else {
      console.log(`✅ Successfully upserted trend: ${topic}`);
    }
  }

  console.log(`✅ Updated ${topicCounts.size} trends`);
}
