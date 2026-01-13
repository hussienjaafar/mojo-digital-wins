import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { parseJsonBody, z } from "../_shared/validators.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Use Lovable AI Gateway (faster, cheaper than OpenAI)
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

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

// Call Lovable AI Gateway with exponential backoff
async function callAIWithBackoff(prompt: string, retryCount = 0): Promise<any> {
  const MAX_RETRIES = 3;
  const BASE_DELAY = 1000;
  
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY not configured');
  }
  
  try {
    const response = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOVABLE_API_KEY}`
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (response.status === 429 || response.status === 402) {
      const errorType = response.status === 429 ? 'Rate limit' : 'Payment required';
      throw new Error(`${errorType}: ${response.status}`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI Gateway error: ${response.status} - ${errorText}`);
    }

    return await response.json();
    
  } catch (error: any) {
    if ((error.message?.includes('429') || error.message?.includes('Rate limit')) && retryCount < MAX_RETRIES) {
      const delay = BASE_DELAY * Math.pow(2, retryCount);
      console.log(`[analyze-articles] Rate limited. Waiting ${delay}ms before retry ${retryCount + 1}/${MAX_RETRIES}`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callAIWithBackoff(prompt, retryCount + 1);
    }
    throw error;
  }
}

// Semantic hash for better cache hits (title + first 500 chars)
function semanticHash(title: string, content: string): string {
  const normalized = (title + content.substring(0, 500))
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
  
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'sem_' + hash.toString(36);
}

// Check cache for existing analysis
async function getCachedAnalysis(supabase: any, contentHash: string): Promise<any | null> {
  const { data } = await supabase
    .from('ai_analysis_cache')
    .select('response, hit_count')
    .eq('content_hash', contentHash)
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .maybeSingle();

  if (!data) return null;

  // Update hit count asynchronously
  supabase
    .from('ai_analysis_cache')
    .update({ 
      hit_count: (data.hit_count ?? 0) + 1,
      last_used_at: new Date().toISOString()
    })
    .eq('content_hash', contentHash)
    .then(() => {});

  return data.response;
}

// Store analysis in cache
async function cacheAnalysis(supabase: any, contentHash: string, response: any): Promise<void> {
  await supabase
    .from('ai_analysis_cache')
    .upsert({
      content_hash: contentHash,
      model: 'gemini-2.5-flash',
      prompt_hash: 'batch_v3',
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

// Parse JSON from AI response
function extractAnalysisJson(text: string): any[] {
  const cleaned = text.replace(/```json|```/g, '').trim();
  
  // Try to find array first (batch response)
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]);
    } catch (_) {}
  }
  
  // Try single object
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      return [JSON.parse(objMatch[0])];
    } catch (_) {}
  }
  
  throw new Error('No valid JSON found in response');
}

// Normalize analysis fields
function normalizeAnalysis(raw: any) {
  if (!raw || typeof raw !== 'object') return raw;
  const copy = { ...raw };

  if (Array.isArray(copy.affected_groups)) {
    copy.affected_groups = copy.affected_groups.map((g: string) =>
      (g || '').toString().trim().toLowerCase().replace(/\s+/g, '_')
    );
  }

  if (copy.relevance_category) {
    const cat = copy.relevance_category.toString().trim().toLowerCase();
    const catMap: Record<string, string> = { politics: 'other', political: 'other', policy: 'other' };
    copy.relevance_category = catMap[cat] || cat;
  }

  return copy;
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

    // BATCH SIZE: 5 articles per API call (80% reduction in API calls)
    const BATCH_SIZE = 5;
    
    const overridesSchema = z.object({
      batchSize: z.coerce.number().int().min(1).max(10).optional(),
    }).passthrough();

    const parsedOverrides = await parseJsonBody(req, overridesSchema, { allowEmpty: true, allowInvalidJson: true });
    if (!parsedOverrides.ok) {
      return new Response(
        JSON.stringify({ error: parsedOverrides.error, details: parsedOverrides.details }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const batchSize = parsedOverrides.data.batchSize ?? BATCH_SIZE;

    console.log(`[analyze-articles] Starting batch analysis (size: ${batchSize})...`);

    // Only analyze recent articles (last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: articles, error: fetchError } = await supabase
      .from('articles')
      .select('id, title, description, content, source_url, source_name, published_date')
      .or('affected_groups.is.null,relevance_category.is.null')
      .gte('published_date', twentyFourHoursAgo)
      .order('published_date', { ascending: false })
      .limit(batchSize);

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
    let cacheHits = 0;
    const results: any[] = [];

    // Check cache first and filter out cached articles
    const uncachedArticles: typeof articles = [];
    const cachedResults: Map<string, any> = new Map();

    for (const article of articles) {
      const contentHash = semanticHash(article.title, article.content || article.description || '');
      const cached = await getCachedAnalysis(supabase, contentHash);
      
      if (cached) {
        cacheHits++;
        cachedResults.set(article.id, cached);
        await supabase.from('articles').update({
          ...cached,
          processing_status: 'completed',
          updated_at: new Date().toISOString()
        }).eq('id', article.id);
        analyzed++;
        results.push({ id: article.id, status: 'success (cached)' });
      } else {
        uncachedArticles.push(article);
      }
    }

    // Process uncached articles in a SINGLE batch API call
    if (uncachedArticles.length > 0) {
      try {
        // Build batch prompt with all articles (truncated to 2000 chars each)
        const articlePrompts = uncachedArticles.map((article, idx) => {
          const content = (article.content || article.description || '').substring(0, 2000);
          return `ARTICLE ${idx + 1}:
ID: ${article.id}
Title: ${article.title}
Source: ${article.source_name}
Content: ${content}`;
        }).join('\n\n---\n\n');

        const batchPrompt = `Analyze these ${uncachedArticles.length} news articles. For EACH article, return a JSON object with:

- article_id: the ID from the article
- affected_groups: array of impacted groups (use ONLY: muslim_american, arab_american, jewish_american, christian, lgbtq, transgender, women, reproductive_rights, black_american, latino, asian_american, indigenous, immigrants, refugees, asylum_seekers, disability, elderly, youth, veterans, workers, students, general_public)
- relevance_category: one of (civil_rights, immigration, healthcare, education, housing, employment, criminal_justice, voting_rights, religious_freedom, lgbtq_rights, foreign_policy, climate, economy, other)
- geographic_scope: national, state, local, or international
- threat_level: critical, high, medium, or low
- sentiment_score: -1.0 to 1.0
- sentiment_label: positive, neutral, or negative
- ai_summary: 1-2 sentence summary

Return a JSON ARRAY with one object per article. Example:
[{"article_id":"abc123","affected_groups":["immigrants"],"relevance_category":"immigration","geographic_scope":"national","threat_level":"high","sentiment_score":-0.5,"sentiment_label":"negative","ai_summary":"Summary here"}]

${articlePrompts}`;

        console.log(`[analyze-articles] Sending batch of ${uncachedArticles.length} articles to AI...`);
        const aiResponse = await callAIWithBackoff(batchPrompt);
        
        const responseText = aiResponse.choices?.[0]?.message?.content || '';
        const analyses = extractAnalysisJson(responseText);

        // Map analyses back to articles
        for (const article of uncachedArticles) {
          const analysis = analyses.find((a: any) => a.article_id === article.id) || analyses[uncachedArticles.indexOf(article)];
          
          if (!analysis) {
            failed++;
            results.push({ id: article.id, status: 'failed', error: 'No analysis returned' });
            continue;
          }

          const normalized = normalizeAnalysis(analysis);
          const validation = validateAnalysis(normalized);

          if (!validation.valid) {
            await supabase.from('articles').update({
              processing_status: 'completed',
              validation_passed: false,
              validation_errors: validation.errors,
              ai_confidence_score: validation.confidence,
              updated_at: new Date().toISOString()
            }).eq('id', article.id);
            failed++;
            results.push({ id: article.id, status: 'validation_failed', errors: validation.errors });
            continue;
          }

          // Cache the analysis
          const contentHash = semanticHash(article.title, article.content || article.description || '');
          await cacheAnalysis(supabase, contentHash, normalized);

          // Update article
          await supabase.from('articles').update({
            affected_groups: normalized.affected_groups || [],
            relevance_category: normalized.relevance_category,
            geographic_scope: normalized.geographic_scope,
            threat_level: normalized.threat_level,
            sentiment_score: normalized.sentiment_score,
            sentiment_label: normalized.sentiment_label,
            ai_summary: normalized.ai_summary,
            processing_status: 'completed',
            validation_passed: true,
            ai_confidence_score: validation.confidence,
            updated_at: new Date().toISOString()
          }).eq('id', article.id);

          // Insert entity mentions
          const entities: Array<{entity_name: string; entity_type: string}> = [];
          if (normalized.affected_groups) {
            for (const group of normalized.affected_groups) {
              entities.push({ entity_name: group, entity_type: 'affected_group' });
            }
          }
          if (normalized.relevance_category) {
            entities.push({ entity_name: normalized.relevance_category, entity_type: 'category' });
          }

          if (entities.length > 0) {
            await supabase.from('entity_mentions').upsert(
              entities.map(e => ({
                entity_name: e.entity_name,
                entity_type: e.entity_type,
                source_type: 'article',
                source_id: article.id,
                source_title: article.title,
                source_url: article.source_url,
                mentioned_at: article.published_date,
                sentiment: normalized.sentiment_score
              })),
              { onConflict: 'entity_name,source_id,source_type', ignoreDuplicates: false }
            );
          }

          analyzed++;
          results.push({ id: article.id, status: 'success' });
        }

      } catch (error: any) {
        console.error(`[analyze-articles] Batch processing error:`, error);
        
        // Mark all uncached articles as failed
        for (const article of uncachedArticles) {
          await supabase.from('articles').update({
            processing_status: 'failed',
            updated_at: new Date().toISOString()
          }).eq('id', article.id);
          failed++;
          results.push({ id: article.id, status: 'failed', error: error.message });
        }

        await supabase.from('job_failures').insert({
          function_name: 'analyze-articles',
          error_message: error.message,
          error_stack: error.stack,
          context_data: { batch_size: uncachedArticles.length }
        });
      }
    }

    const summary = {
      success: true,
      processed: articles.length,
      analyzed,
      failed,
      cache_hits: cacheHits,
      api_calls: uncachedArticles.length > 0 ? 1 : 0, // Now just 1 API call for batch!
      results
    };

    console.log(`[analyze-articles] Complete: ${analyzed} analyzed, ${cacheHits} cached, ${failed} failed, 1 API call`);

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
