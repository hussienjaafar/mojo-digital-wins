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

      const extractionPrompt = `Extract names from these news headlines like Twitter trending. Answer: WHO? WHERE? WHAT specific thing?

${articlesText}

Extract ONLY:
- PEOPLE: "Donald Trump", "Nancy Pelosi", "Dick Cheney"
- PLACES: "Gaza", "Ukraine", "Texas"
- ORGANIZATIONS: "Supreme Court", "FBI", "NATO"
- BILLS: "HR 1234", "S 456"
- PRODUCTS/EVENTS: "iPhone", "Super Bowl", "TikTok"

DO NOT extract:
- Categories: "immigration", "healthcare", "politics"
- Actions: "debate", "reform", "investigation"
- Descriptions: "administration", "crisis", "tensions"

Rules:
1. Must be a proper noun (starts with capital letter)
2. 1-3 words max
3. Would have a Wikipedia page
4. NOT a topic/theme/category

Examples:
✅ "Elon Musk" (person)
✅ "Gaza" (place)
✅ "TikTok" (product)
❌ "social media" (category)
❌ "tech debate" (topic)
❌ "administration" (description)

Return JSON array:
[{"topic": "Name Here", "keywords": ["word1", "word2"], "relevance": 0.9}]`;

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
                content: 'You extract ONLY proper nouns (names) from news. NOT topics, NOT themes, NOT categories - ONLY names of people, places, organizations, events, bills. Think: WHO, WHERE, WHAT specific thing. Always respond with valid JSON arrays.'
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

        // VALIDATION: Filter out non-proper-nouns
        const forbiddenWords = [
          'administration', 'debate', 'reform', 'policy', 'crisis', 'issues', 'tensions',
          'investigation', 'controversy', 'legislation', 'announcement', 'campaign',
          'election', 'politics', 'government', 'movement', 'strategy', 'approach'
        ];

        const beforeFilter = extractedTopics.length;
        extractedTopics = extractedTopics.filter(topic => {
          const topicLower = topic.topic.toLowerCase();
          const words = topicLower.split(/\s+/);

          // Must be 1-3 words
          if (words.length > 3) {
            console.log(`❌ Filtered "${topic.topic}": too many words`);
            return false;
          }

          // Must start with capital letter
          if (topic.topic[0] !== topic.topic[0].toUpperCase()) {
            console.log(`❌ Filtered "${topic.topic}": doesn't start with capital`);
            return false;
          }

          // Must not contain forbidden words
          const hasForbidden = words.find(word => forbiddenWords.includes(word));
          if (hasForbidden) {
            console.log(`❌ Filtered "${topic.topic}": contains forbidden word "${hasForbidden}"`);
            return false;
          }

          // Must not be just common words
          const commonWords = ['the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'new', 'old'];
          if (words.every(word => commonWords.includes(word))) {
            console.log(`❌ Filtered "${topic.topic}": only common words`);
            return false;
          }

          console.log(`✅ Keeping proper noun: "${topic.topic}"`);
          return true;
        });

        console.log(`Validation: ${beforeFilter} extracted → ${extractedTopics.length} valid proper nouns`);

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
