import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

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

const VALID_THREAT_LEVELS = ['critical', 'high', 'medium', 'low'];

// Data validation function
function validateAnalysis(analysis: any): { valid: boolean; errors: string[]; confidence: number } {
  const errors: string[] = [];
  let confidence = 1.0;

  // Check required fields
  if (!analysis.affected_groups || !Array.isArray(analysis.affected_groups)) {
    errors.push('Missing or invalid affected_groups');
    return { valid: false, errors, confidence: 0 };
  }

  if (!analysis.relevance_category) {
    errors.push('Missing relevance_category');
    confidence -= 0.2;
  }

  // Validate group labels
  const invalidGroups = analysis.affected_groups.filter(
    (g: string) => !VALID_GROUPS.includes(g)
  );
  if (invalidGroups.length > 0) {
    errors.push(`Invalid groups: ${invalidGroups.join(', ')}`);
    confidence -= 0.3;
  }

  // Validate category
  if (analysis.relevance_category && !VALID_CATEGORIES.includes(analysis.relevance_category)) {
    errors.push(`Invalid category: ${analysis.relevance_category}`);
    confidence -= 0.2;
  }

  // Validate sentiment range
  if (analysis.sentiment_score !== null && (analysis.sentiment_score < -1 || analysis.sentiment_score > 1)) {
    errors.push('Sentiment score out of range [-1, 1]');
    confidence -= 0.2;
  }

  // Validate threat level
  if (analysis.threat_level && !VALID_THREAT_LEVELS.includes(analysis.threat_level)) {
    errors.push(`Invalid threat level: ${analysis.threat_level}`);
    confidence -= 0.1;
  }

  const valid = errors.length === 0 || confidence >= 0.5;
  return { valid, errors, confidence: Math.max(0, confidence) };
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
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    return text.substring(0, 3000);
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

    const { batchSize = 30 } = await req.json().catch(() => ({}));

    console.log(`Starting comprehensive article analysis (batch: ${batchSize})...`);

    // Fetch unanalyzed articles
    const { data: articles, error: fetchError } = await supabase
      .from('articles')
      .select('id, title, description, content, source_url, source_name, published_date')
      .or('affected_groups.is.null,relevance_category.is.null')
      .order('published_date', { ascending: false })
      .limit(batchSize);

    if (fetchError) throw fetchError;
    if (!articles || articles.length === 0) {
      console.log('No articles to analyze');
      return new Response(
        JSON.stringify({ success: true, analyzed: 0, message: 'No articles pending analysis' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Analyzing ${articles.length} articles...`);

    let analyzed = 0;
    let failed = 0;
    let validationFailed = 0;

    for (const article of articles) {
      try {
        // Fetch full content if needed
        let fullContent = article.content || article.description || '';
        if (article.source_url && (!fullContent || fullContent.length < 500)) {
          console.log(`Fetching full content for article ${article.id} from ${article.source_url}`);
          const fetchedContent = await fetchArticleContent(article.source_url);
          if (fetchedContent) {
            fullContent = fetchedContent;
            await supabase.from('articles').update({ content: fetchedContent }).eq('id', article.id);
          }
        }

        const contentForAnalysis = fullContent.substring(0, 3000) || article.description || '';

        const prompt = `Analyze this news article comprehensively for political impact across ALL demographic groups and policy areas.

Article: "${article.title}"
Description: ${article.description || 'N/A'}
Source: ${article.source_name}
Content: ${contentForAnalysis}

Extract the following in JSON format:
{
  "affected_groups": ["array of affected demographic groups"],
  "relevance_category": "primary policy category",
  "sentiment_score": -1 to 1 (negative to positive),
  "sentiment_label": "positive/neutral/negative",
  "threat_level": "critical/high/medium/low",
  "key_topics": ["array of 3-5 key topics"],
  "ai_summary": "2-3 sentence summary focusing on impact"
}

Valid groups: ${VALID_GROUPS.join(', ')}
Valid categories: ${VALID_CATEGORIES.join(', ')}

Consider ALL affected communities, not just obvious ones. Be comprehensive but accurate.`;

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
          throw new Error(`Claude API error: ${response.status}`);
        }

        const data = await response.json();
        const analysisText = data.content[0].text;
        const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) {
          throw new Error('No JSON found in Claude response');
        }

        const analysis = JSON.parse(jsonMatch[0]);

        // VALIDATION: Check data quality before storing
        const validation = validateAnalysis(analysis);
        
        if (!validation.valid && validation.confidence < 0.5) {
          console.log(`Article ${article.id} failed validation:`, validation.errors);
          validationFailed++;
          
          await supabase.from('articles').update({
            validation_passed: false,
            validation_errors: validation.errors,
            ai_confidence_score: validation.confidence
          }).eq('id', article.id);
          
          await supabase.from('job_failures').insert({
            function_name: 'analyze-articles',
            error_message: 'Validation failed: ' + validation.errors.join('; '),
            context_data: { article_id: article.id, analysis }
          });
          
          continue;
        }

        // Store validated analysis
        const { error: updateError } = await supabase
          .from('articles')
          .update({
            affected_groups: analysis.affected_groups || [],
            relevance_category: analysis.relevance_category,
            sentiment_score: analysis.sentiment_score,
            sentiment_label: analysis.sentiment_label,
            sentiment_confidence: validation.confidence >= 0.8 ? 0.9 : 0.7,
            threat_level: analysis.threat_level,
            extracted_topics: { topics: analysis.key_topics || [] },
            ai_summary: analysis.ai_summary,
            ai_confidence_score: validation.confidence,
            validation_passed: true,
            validation_errors: validation.errors.length > 0 ? validation.errors : null,
            topics_extracted: true,
            topics_extracted_at: new Date().toISOString(),
            processing_status: 'completed'
          })
          .eq('id', article.id);

        if (updateError) throw updateError;

        analyzed++;
        console.log(`Article ${article.id} analyzed: ${analysis.relevance_category}, confidence: ${validation.confidence.toFixed(2)}`);

      } catch (error: any) {
        console.error(`Error analyzing article ${article.id}:`, error);
        failed++;
        
        // Log failure for retry
        await supabase.from('job_failures').insert({
          function_name: 'analyze-articles',
          error_message: error?.message || 'Unknown error',
          error_stack: error?.stack,
          context_data: { article_id: article.id }
        });
      }
    }

    // Update checkpoint
    await supabase.from('processing_checkpoints').upsert({
      function_name: 'analyze-articles',
      last_processed_at: new Date().toISOString(),
      records_processed: analyzed,
      updated_at: new Date().toISOString()
    });

    console.log(`Analysis complete: ${analyzed} successful, ${failed} failed, ${validationFailed} validation failed`);

    return new Response(
      JSON.stringify({
        success: true,
        analyzed,
        failed,
        validationFailed,
        totalProcessed: articles.length,
        dataQuality: analyzed > 0 ? (analyzed / (analyzed + validationFailed)).toFixed(2) : 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in analyze-articles:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});