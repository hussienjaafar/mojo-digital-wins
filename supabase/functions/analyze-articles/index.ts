import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting AI analysis of articles...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch articles that haven't been processed
    const { data: articles, error: fetchError } = await supabaseClient
      .from('articles')
      .select('*')
      .eq('processing_status', 'pending')
      .limit(20);

    if (fetchError) throw fetchError;

    if (!articles || articles.length === 0) {
      console.log('No articles to process');
      return new Response(
        JSON.stringify({ message: 'No articles to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${articles.length} articles`);
    let processedCount = 0;
    let duplicateCount = 0;

    for (const article of articles) {
      try {
        // 1. Detect duplicates using hash signature
        if (article.hash_signature) {
          const { data: existingArticles } = await supabaseClient
            .from('articles')
            .select('id, created_at')
            .eq('hash_signature', article.hash_signature)
            .neq('id', article.id)
            .order('created_at', { ascending: true })
            .limit(1);

          if (existingArticles && existingArticles.length > 0) {
            // Mark as duplicate
            await supabaseClient
              .from('articles')
              .update({
                is_duplicate: true,
                duplicate_of: existingArticles[0].id,
                processing_status: 'completed'
              })
              .eq('id', article.id);
            
            duplicateCount++;
            console.log(`Article ${article.id} marked as duplicate`);
            continue;
          }
        }

        // 2. Perform sentiment analysis and generate summary using AI
        const analysisPrompt = `Analyze the following news article and provide:
1. Sentiment (positive, neutral, or negative)
2. Confidence score (0-1)
3. A concise 2-sentence summary

Article Title: ${article.title}
Article Content: ${article.description || article.content?.substring(0, 500) || 'No content available'}

Respond in JSON format:
{
  "sentiment": "positive|neutral|negative",
  "confidence": 0.95,
  "summary": "Your summary here"
}`;

        const aiResponse = await fetch(AI_GATEWAY_URL, {
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
                content: 'You are a news analysis AI. Analyze articles for sentiment and create summaries. Always respond with valid JSON.'
              },
              {
                role: 'user',
                content: analysisPrompt
              }
            ],
            tools: [{
              type: 'function',
              function: {
                name: 'analyze_article',
                description: 'Analyze article sentiment and create summary',
                parameters: {
                  type: 'object',
                  properties: {
                    sentiment: {
                      type: 'string',
                      enum: ['positive', 'neutral', 'negative']
                    },
                    confidence: {
                      type: 'number',
                      minimum: 0,
                      maximum: 1
                    },
                    summary: {
                      type: 'string'
                    }
                  },
                  required: ['sentiment', 'confidence', 'summary'],
                  additionalProperties: false
                }
              }
            }],
            tool_choice: { type: 'function', function: { name: 'analyze_article' } }
          }),
        });

        if (!aiResponse.ok) {
          console.error(`AI API error: ${aiResponse.status}`);
          continue;
        }

        const aiData = await aiResponse.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        
        if (!toolCall) {
          console.error('No tool call in AI response');
          continue;
        }

        const analysis = JSON.parse(toolCall.function.arguments);

        // 3. Calculate numeric sentiment score
        const sentimentScoreMap: Record<string, number> = {
          'positive': 0.75,
          'neutral': 0.5,
          'negative': 0.25
        };

        const sentimentScore = sentimentScoreMap[analysis.sentiment] || 0.5;

        // 4. Update article with analysis results
        const { error: updateError } = await supabaseClient
          .from('articles')
          .update({
            sentiment_label: analysis.sentiment,
            sentiment_confidence: analysis.confidence,
            sentiment_score: sentimentScore,
            ai_summary: analysis.summary,
            processing_status: 'completed',
            is_duplicate: false
          })
          .eq('id', article.id);

        if (updateError) {
          console.error(`Error updating article ${article.id}:`, updateError);
          continue;
        }

        processedCount++;
        console.log(`Article ${article.id} analyzed: ${analysis.sentiment} (${analysis.confidence})`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`Error processing article ${article.id}:`, error);
      }
    }

    // 5. Update sentiment trends
    await updateSentimentTrends(supabaseClient);

    console.log(`Processing complete: ${processedCount} analyzed, ${duplicateCount} duplicates found`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        duplicates: duplicateCount,
        total: articles.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in analyze-articles function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function updateSentimentTrends(supabaseClient: any) {
  try {
    // Get today's date
    const today = new Date().toISOString().split('T')[0];

    // Get all categories
    const { data: categories } = await supabaseClient
      .from('rss_sources')
      .select('category')
      .eq('is_active', true);

    const uniqueCategories = [...new Set(categories?.map((c: any) => c.category))];

    for (const category of uniqueCategories) {
      // Count sentiment by category for today
      const { data: sentimentData } = await supabaseClient
        .from('articles')
        .select('sentiment_label, sentiment_score')
        .eq('category', category)
        .gte('published_date', today)
        .eq('processing_status', 'completed')
        .not('sentiment_label', 'is', null);

      if (!sentimentData || sentimentData.length === 0) continue;

      const counts = {
        positive: 0,
        neutral: 0,
        negative: 0
      };

      let totalScore = 0;

      sentimentData.forEach((item: any) => {
        if (item.sentiment_label in counts) {
          counts[item.sentiment_label as keyof typeof counts]++;
        }
        if (item.sentiment_score) {
          totalScore += item.sentiment_score;
        }
      });

      const avgScore = totalScore / sentimentData.length;

      // Upsert sentiment trends
      await supabaseClient
        .from('sentiment_trends')
        .upsert({
          date: today,
          category: category,
          positive_count: counts.positive,
          neutral_count: counts.neutral,
          negative_count: counts.negative,
          avg_sentiment_score: avgScore
        }, {
          onConflict: 'date,category'
        });
    }

    console.log('Sentiment trends updated');
  } catch (error) {
    console.error('Error updating sentiment trends:', error);
  }
}
