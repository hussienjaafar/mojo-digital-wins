import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const VALID_GROUPS = [
  'muslim_american', 'arab_american', 'jewish_american', 'christian',
  'lgbtq', 'transgender', 'women', 'reproductive_rights',
  'black_american', 'latino', 'latino_hispanic', 'asian_american', 'indigenous',
  'immigrants', 'refugees', 'asylum_seekers',
  'disability', 'disabled', 'elderly', 'youth', 'seniors', 'students',
  'veterans', 'workers', 'general_public'
];

const VALID_CATEGORIES = [
  'civil_rights', 'immigration', 'healthcare', 'education', 'housing',
  'employment', 'criminal_justice', 'voting_rights', 'religious_freedom',
  'lgbtq_rights', 'foreign_policy', 'climate', 'economy', 'other'
];

const VALID_THREAT_LEVELS = ['critical', 'high', 'medium', 'low'];

// Call Claude API with exponential backoff for rate limits
async function callClaudeWithBackoff(prompt: string, retryCount = 0): Promise<any> {
  const MAX_RETRIES = 5;
  const BASE_DELAY = 1000;
  
  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1024,
        response_format: { type: "json_object" },
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (response.status === 429) {
      throw new Error('Rate limit exceeded');
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
    
  } catch (error: any) {
    if ((error.message?.includes('429') || error.message?.includes('Rate limit')) && retryCount < MAX_RETRIES) {
      // Exponential backoff: 2s, 4s, 8s, 16s, 32s
      const delay = BASE_DELAY * Math.pow(2, retryCount);
      console.log(`[analyze-articles] Rate limited. Waiting ${delay}ms before retry ${retryCount + 1}/${MAX_RETRIES}`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callClaudeWithBackoff(prompt, retryCount + 1);
    }
    throw error;
  }
}

// Simple hash function for cache keys
function hashContent(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

// Check cache for existing analysis
async function getCachedAnalysis(supabase: any, contentHash: string, model: string, promptHash: string): Promise<any | null> {
  const { data } = await supabase
    .from('ai_analysis_cache')
    .select('response, created_at')
    .eq('content_hash', contentHash)
    .eq('model', model)
    .eq('prompt_hash', promptHash)
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // 7 day cache
    .maybeSingle();

  if (!data) return null;

  // Update hit count
  await supabase
    .from('ai_analysis_cache')
    .update({ 
      hit_count: supabase.sql`hit_count + 1`,
      last_used_at: new Date().toISOString()
    })
    .eq('content_hash', contentHash);

  return data.response;
}

// Store analysis in cache
async function cacheAnalysis(supabase: any, contentHash: string, model: string, promptHash: string, response: any): Promise<void> {
  await supabase
    .from('ai_analysis_cache')
    .upsert({
      content_hash: contentHash,
      model: model,
      prompt_hash: promptHash,
      response: response
    }, { 
      onConflict: 'content_hash',
      ignoreDuplicates: true 
    });
}

function validateAnalysis(analysis: any): { valid: boolean; errors: string[]; confidence: number } {
  const errors: string[] = [];
  let confidence = 1.0;

  if (!analysis.affected_groups || !Array.isArray(analysis.affected_groups)) {
    errors.push('Missing or invalid affected_groups');
    return { valid: false, errors, confidence: 0 };
  }

  if (analysis.relevance_category && !VALID_CATEGORIES.includes(analysis.relevance_category)) {
    errors.push(`Invalid category: ${analysis.relevance_category}`);
    confidence -= 0.2;
  }

  const invalidGroups = analysis.affected_groups.filter((g: string) => !VALID_GROUPS.includes(g));
  if (invalidGroups.length > 0) {
    errors.push(`Invalid groups: ${invalidGroups.join(', ')}`);
    confidence -= 0.3;
  }

  if (analysis.sentiment_score !== null && (analysis.sentiment_score < -1 || analysis.sentiment_score > 1)) {
    errors.push('Sentiment score out of range [-1, 1]');
    confidence -= 0.2;
  }

  if (analysis.threat_level && !VALID_THREAT_LEVELS.includes(analysis.threat_level)) {
    errors.push(`Invalid threat level: ${analysis.threat_level}`);
    confidence -= 0.1;
  }

  const valid = errors.length === 0 || confidence >= 0.5;
  return { valid, errors, confidence: Math.max(0, confidence) };
}

// Try to extract and parse JSON from model output with light normalization to handle formatting drift
function extractAnalysisJson(text: string): any {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('No JSON object found in Claude response');
  }

  const tryParse = (candidate: string) => {
    try {
      return JSON.parse(candidate);
    } catch (_err) {
      return null;
    }
  };

  // First attempt as-is
  const direct = tryParse(match[0]);
  if (direct) return direct;

  // Second attempt with light cleanup for newlines, smart quotes, and trailing commas
  const normalized = match[0]
    .replace(/\r?\n/g, ' ')
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/,\s*([}\]])/g, '$1');

  const cleanedParse = tryParse(normalized);
  if (cleanedParse) return cleanedParse;

  throw new Error('Failed to parse Claude JSON');
}

// Fetch article content from URL
async function fetchArticleContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IntelligenceBot/1.0)' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return '';

    const html = await response.text();
    let text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return text.substring(0, 5000);
  } catch (error) {
    console.error(`Error fetching content from ${url}:`, error);
    return '';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Batch size and pacing; can be overridden via request body for backfills
    let BATCH_SIZE = 5;
    let REQUEST_DELAY = 1000; // ms between requests

    // Allow overrides via request body for backfills
    const overrides = await req.json().catch(() => ({}));
    if (overrides.batchSize && typeof overrides.batchSize === 'number') {
      BATCH_SIZE = Math.min(Math.max(1, overrides.batchSize), 100); // clamp 1..100
    }
    if (overrides.requestDelayMs && typeof overrides.requestDelayMs === 'number') {
      REQUEST_DELAY = Math.min(Math.max(0, overrides.requestDelayMs), 5000); // clamp 0..5000ms
    }

    console.log(`[analyze-articles] Starting analysis (batch: ${BATCH_SIZE}, delay: ${REQUEST_DELAY}ms)...`);

    // Fetch unanalyzed articles
    const { data: articles, error: fetchError } = await supabase
      .from('articles')
      .select('id, title, description, content, source_url, source_name, published_date')
      .or('affected_groups.is.null,relevance_category.is.null')
      .order('published_date', { ascending: false })
      .limit(BATCH_SIZE);

    if (fetchError) throw fetchError;
    if (!articles || articles.length === 0) {
      console.log('[analyze-articles] No articles to analyze');
      return new Response(
        JSON.stringify({ success: true, analyzed: 0, message: 'No articles pending analysis' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let analyzed = 0;
    let failed = 0;
    let validationFailed = 0;
    let cacheHits = 0;
    const results: any[] = [];

    for (const article of articles) {
      try {
        if (REQUEST_DELAY > 0) {
          await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));
        }

        // Fetch full content if needed
        let fullContent = article.content || article.description || '';
        if (article.source_url && (!fullContent || fullContent.length < 500)) {
          const fetchedContent = await fetchArticleContent(article.source_url);
          if (fetchedContent) {
            fullContent = fetchedContent;
            await supabase.from('articles').update({ content: fetchedContent }).eq('id', article.id);
          }
        }

        const textToAnalyze = (article.title + '\n\n' + fullContent).substring(0, 4000);
        const contentHash = hashContent(textToAnalyze);
        const promptHash = hashContent('v2-comprehensive-analysis');

        // Check cache
        const cached = await getCachedAnalysis(supabase, contentHash, 'claude-3-haiku', promptHash);
        if (cached) {
          cacheHits++;
          await supabase.from('articles').update({
            ...cached,
            processing_status: 'completed',
            updated_at: new Date().toISOString()
          }).eq('id', article.id);
          analyzed++;
          results.push({ id: article.id, status: 'success (cached)' });
          continue;
        }

        // Build comprehensive analysis prompt
        const prompt = `Analyze this news article comprehensively. Extract:

1. **affected_groups**: Which communities/demographics are directly impacted? Use ONLY these standardized labels:
   - muslim_american, arab_american, jewish_american, christian
   - lgbtq, transgender, women, reproductive_rights
   - black_american, latino, asian_american, indigenous
   - immigrants, refugees, asylum_seekers
   - disability, elderly, youth, veterans
   - workers, students, general_public

2. **relevance_category**: Primary policy category:
   - civil_rights, immigration, healthcare, education, housing
   - employment, criminal_justice, voting_rights, religious_freedom
   - lgbtq_rights, foreign_policy, climate, economy, other

3. **geographic_scope**: national, state, local, or international

4. **threat_level**: critical, high, medium, or low (based on severity of impact)

5. **sentiment_score**: Overall sentiment (-1.0 to 1.0, where -1 is very negative, 0 neutral, 1 positive)

6. **sentiment_label**: "positive", "neutral", or "negative"

7. **ai_summary**: 2-3 sentence summary of the article

Return ONLY valid JSON (no markdown, no code fences, no extra text). Example:
{"affected_groups":["muslim_american","arab_american"],"relevance_category":"civil_rights","geographic_scope":"national","threat_level":"high","sentiment_score":-0.6,"sentiment_label":"negative","ai_summary":"Brief summary here..."}

Article:
Title: ${article.title}
Source: ${article.source_name}
Content: ${textToAnalyze}`;

        const data = await callClaudeWithBackoff(prompt);
        const analysis =
          data?.content?.[0]?.json ??
          extractAnalysisJson(data?.content?.[0]?.text ?? '');
        const validation = validateAnalysis(analysis);
        if (!validation.valid) {
          await supabase.from('articles').update({
            processing_status: 'completed',
            validation_passed: false,
            validation_errors: validation.errors,
            ai_confidence_score: validation.confidence,
            updated_at: new Date().toISOString()
          }).eq('id', article.id);
          validationFailed++;
          results.push({ id: article.id, status: 'validation_failed', errors: validation.errors });
          continue;
        }

        await cacheAnalysis(supabase, contentHash, 'claude-3-haiku', promptHash, analysis);

        await supabase.from('articles').update({
          affected_groups: analysis.affected_groups || [],
          relevance_category: analysis.relevance_category,
          geographic_scope: analysis.geographic_scope,
          threat_level: analysis.threat_level,
          sentiment_score: analysis.sentiment_score,
          sentiment_label: analysis.sentiment_label,
          ai_summary: analysis.ai_summary,
          processing_status: 'completed',
          validation_passed: true,
          ai_confidence_score: validation.confidence,
          updated_at: new Date().toISOString()
        }).eq('id', article.id);

        analyzed++;
        results.push({ id: article.id, status: 'success' });

      } catch (error: any) {
        console.error(`[analyze-articles] Error processing article ${article.id}:`, error);
        await supabase.from('job_failures').insert({
          function_name: 'analyze-articles',
          error_message: error.message,
          error_stack: error.stack,
          context_data: { article_id: article.id, title: article.title }
        });
        await supabase
          .from('articles')
          .update({ processing_status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', article.id);
        failed++;
        results.push({ id: article.id, status: 'failed', error: error.message });
      }
    }

    const summary = {
      success: true,
      processed: articles.length,
      analyzed,
      failed,
      validation_failed: validationFailed,
      cache_hits: cacheHits,
      results
    };

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[analyze-articles] Error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

