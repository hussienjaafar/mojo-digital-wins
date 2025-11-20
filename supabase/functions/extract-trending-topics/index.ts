import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

interface ExtractedTopic {
  topic: string;
  keywords: string[];
  relevance: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 Extracting trending topics from recent articles...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json().catch(() => ({}));
    const hoursBack = body.hoursBack || 1; // Analyze last N hours

    // ====================================================================
    // 1. FETCH RECENT ARTICLES
    // ====================================================================
    const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

    const { data: articles, error: fetchError } = await supabase
      .from('articles')
      .select('id, title, description, content, source_name, published_date, sentiment_label, sentiment_score')
      .gte('published_date', cutoffTime)
      .order('published_date', { ascending: false })
      .limit(100);

    if (fetchError) throw fetchError;

    if (!articles || articles.length === 0) {
      console.log('No recent articles to analyze');
      return new Response(
        JSON.stringify({ message: 'No articles found', topicCount: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📰 Analyzing ${articles.length} articles from last ${hoursBack} hour(s)`);

    // ====================================================================
    // 2. USE AI TO EXTRACT TOPICS FROM ARTICLE CONTENT
    // ====================================================================

    // Batch articles into groups for AI analysis
    const batchSize = 10;
    const allTopics: Map<string, {
      count: number;
      articleIds: string[];
      sampleTitles: string[];
      keywords: Set<string>;
      sentimentScores: number[];
      sentimentLabels: string[];
    }> = new Map();

    for (let i = 0; i < articles.length; i += batchSize) {
      const batch = articles.slice(i, i + batchSize);

      const articlesText = batch.map(a =>
        `ID: ${a.id}\nTitle: ${a.title}\nContent: ${(a.description || a.content || '').substring(0, 500)}`
      ).join('\n\n---\n\n');

      const extractionPrompt = `Extract SPECIFIC trending topics like Twitter's trending section from these news articles.

${articlesText}

TWITTER-STYLE RULES (CRITICAL):
- Use PROPER NOUNS: specific people, places, bills, events (e.g., "HR 5376", "Nancy Pelosi", "Gaza ceasefire")
- Use EXACT NAMES: bills by number, people by full name, specific events
- BE SPECIFIC: "Epstein files release" NOT "transparency"
- BE CONCRETE: "Dick Cheney funeral" NOT "political events"
- Include BILL NUMBERS: "HR 2847", "S 1234"
- Include PEOPLE: "Donald Trump", "Joe Biden", specific names mentioned
- Include PLACES: "Gaza", "West Bank", specific locations
- AVOID vague terms: "policy", "reform", "debate", "issues"
- Maximum 2-3 words per topic
- Only topics mentioned in at least 1 article (breaking news counts)
- Maximum 10 topics per batch

Examples of GOOD topics:
✅ "HR 5376"
✅ "Epstein documents"
✅ "Dick Cheney"
✅ "Gaza ceasefire"
✅ "Nancy Pelosi"
✅ "Supreme Court"

Examples of BAD topics:
❌ "immigration policy"
❌ "healthcare debate"
❌ "political reform"
❌ "climate issues"

Respond with JSON array:
[
  {
    "topic": "Specific Topic",
    "keywords": ["keyword1", "keyword2"],
    "relevance": 0.9
  }
]`;

      try {
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
                content: 'You are a news analysis AI that extracts trending topics from article content. Always respond with valid JSON arrays.'
              },
              {
                role: 'user',
                content: extractionPrompt
              }
            ],
            response_format: { type: 'json_object' }
          }),
        });

        if (!aiResponse.ok) {
          console.error(`AI API error: ${aiResponse.status}`);
          continue;
        }

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content;

        if (!content) {
          console.error('No content in AI response');
          continue;
        }

        // Parse AI response (it might return an object with topics array or just an array)
        let extractedTopics: ExtractedTopic[] = [];
        try {
          const parsed = JSON.parse(content);
          extractedTopics = Array.isArray(parsed) ? parsed : (parsed.topics || []);
        } catch (e) {
          console.error('Failed to parse AI response:', e);
          continue;
        }

        // Aggregate topics
        for (const extracted of extractedTopics) {
          const topicKey = extracted.topic.toLowerCase();

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
            const topicWords = extracted.topic.toLowerCase().split(/\s+/);
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

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (error) {
        console.error(`Error processing batch ${i}-${i + batchSize}:`, error);
      }
    }

    // ====================================================================
    // 3. STORE TRENDING TOPICS IN DATABASE
    // ====================================================================

    const currentHour = new Date();
    currentHour.setMinutes(0, 0, 0);
    const currentDate = currentHour.toISOString().split('T')[0];

    let topicsInserted = 0;

    for (const [topicKey, data] of allTopics.entries()) {
      // Store topics with at least 1 mention (Twitter-style: even single breaking news counts)
      if (data.count < 1) continue;

      const avgSentiment = data.sentimentScores.reduce((a, b) => a + b, 0) / data.sentimentScores.length;

      const posCount = data.sentimentLabels.filter(s => s === 'positive').length;
      const neuCount = data.sentimentLabels.filter(s => s === 'neutral').length;
      const negCount = data.sentimentLabels.filter(s => s === 'negative').length;

      const topicRecord = {
        topic: topicKey,
        mention_count: data.count,
        hour_timestamp: currentHour.toISOString(),
        day_date: currentDate,
        avg_sentiment_score: avgSentiment,
        positive_count: posCount,
        neutral_count: neuCount,
        negative_count: negCount,
        article_ids: data.articleIds.slice(0, 20), // Limit to 20 articles
        sample_titles: data.sampleTitles.slice(0, 5), // Store 5 sample titles
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
        console.log(`✅ Topic "${topicKey}": ${data.count} mentions, sentiment ${avgSentiment.toFixed(2)}`);
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
