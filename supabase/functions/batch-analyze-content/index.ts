import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Local keyword extraction (no AI needed)
const POLITICAL_KEYWORDS = {
  // Named entities (people) - highest specificity
  persons: [
    'trump', 'biden', 'harris', 'obama', 'pence', 'desantis', 'newsom',
    'pelosi', 'mcconnell', 'schumer', 'cruz', 'sanders', 'warren', 'aoc',
    'ocasio-cortez', 'gaetz', 'greene', 'boebert', 'jordan', 'mccarthy',
    'kash patel', 'brian cole', 'jack smith', 'merrick garland', 'alito',
    'kavanaugh', 'gorsuch', 'barrett', 'sotomayor', 'kagan', 'jackson',
    'musk', 'zuckerberg', 'buttigieg', 'tuberville', 'vance', 'ramaswamy'
  ],
  // Organizations - high specificity
  organizations: [
    'fbi', 'doj', 'cia', 'nsa', 'dhs', 'ice', 'cbp', 'atf', 'dea',
    'supreme court', 'congress', 'senate', 'house', 'white house',
    'pentagon', 'state department', 'treasury', 'federal reserve',
    'nato', 'democratic party', 'republican party', 'gop', 'dnc', 'rnc'
  ],
  // Event indicators - mark headlines as events
  events: [
    'arrested', 'arrest', 'indicted', 'indictment', 'verdict', 'ruling',
    'shooting', 'bombing', 'explosion', 'crash', 'fire', 'attack',
    'resignation', 'fired', 'dies', 'death', 'killed', 'murder',
    'election', 'primary', 'debate', 'rally', 'protest', 'riot',
    'hearing', 'testimony', 'trial', 'sentencing', 'appeal', 'subpoena',
    'summit', 'meeting', 'conference', 'speech', 'announcement',
    'scandal', 'leak', 'breach', 'hack', 'exposed', 'reveals'
  ],
  // General topics - lower specificity
  topics: [
    'immigration', 'border', 'abortion', 'healthcare', 'climate', 'gun',
    'economy', 'inflation', 'jobs', 'taxes', 'voting', 'ballot',
    'impeachment', 'executive order', 'legislation', 'bill', 'law',
    'policy', 'rights', 'discrimination', 'campaign', 'poll', 'approval'
  ],
  sentiment_positive: [
    'victory', 'win', 'success', 'breakthrough', 'progress', 'bipartisan',
    'agreement', 'support', 'approval', 'praise', 'celebrate', 'unanimous'
  ],
  sentiment_negative: [
    'crisis', 'scandal', 'controversy', 'attack', 'threat', 'failure',
    'reject', 'oppose', 'condemn', 'criticize', 'backlash', 'outrage',
    'chaos', 'disaster', 'collapse', 'corruption', 'fraud', 'abuse'
  ]
};

interface ContentItem {
  id: string;
  title: string;
  description?: string;
  source_type: 'google_news' | 'reddit' | 'bluesky' | 'rss';
}

interface AnalysisResult {
  topics: string[];
  sentiment: number;
  sentiment_label: string;
  relevance_score: number;
  hashtags: string[];
  entity_types: Record<string, string>; // topic -> entity_type
}

// Extract hashtags from text
function extractHashtags(text: string): string[] {
  const hashtags: string[] = [];
  const hashtagRegex = /#[A-Za-z][A-Za-z0-9_]{2,30}/g;
  const matches = text.match(hashtagRegex);
  if (matches) {
    for (const match of matches) {
      const normalized = match.toLowerCase();
      if (!hashtags.includes(normalized)) {
        hashtags.push(normalized);
      }
    }
  }
  return hashtags;
}

// Local analysis with entity type classification
function analyzeContentLocally(title: string, description?: string): AnalysisResult {
  const text = `${title} ${description || ''}`.toLowerCase();
  const topics: string[] = [];
  const entityTypes: Record<string, string> = {};
  let positiveScore = 0;
  let negativeScore = 0;
  let relevanceScore = 0;
  let hasEventIndicator = false;
  
  // Check for event indicators first
  for (const indicator of POLITICAL_KEYWORDS.events) {
    if (text.includes(indicator)) {
      hasEventIndicator = true;
      break;
    }
  }
  
  // Extract persons (highest priority)
  for (const person of POLITICAL_KEYWORDS.persons) {
    if (text.includes(person)) {
      // Proper case the name
      const normalized = person.split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      if (!topics.includes(normalized)) {
        topics.push(normalized);
        entityTypes[normalized] = hasEventIndicator ? 'event' : 'person';
      }
      relevanceScore += 0.2;
    }
  }
  
  // Extract organizations
  for (const org of POLITICAL_KEYWORDS.organizations) {
    if (text.includes(org)) {
      const normalized = org.toUpperCase() === org 
        ? org.toUpperCase() 
        : org.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      if (!topics.includes(normalized)) {
        topics.push(normalized);
        entityTypes[normalized] = 'organization';
      }
      relevanceScore += 0.15;
    }
  }
  
  // Extract general topics
  for (const topic of POLITICAL_KEYWORDS.topics) {
    if (text.includes(topic)) {
      const normalized = topic.charAt(0).toUpperCase() + topic.slice(1);
      if (!topics.includes(normalized)) {
        topics.push(normalized);
        entityTypes[normalized] = 'category';
      }
      relevanceScore += 0.1;
    }
  }
  
  // Extract hashtags as topics
  const hashtags = extractHashtags(`${title} ${description || ''}`);
  for (const hashtag of hashtags) {
    if (!topics.includes(hashtag)) {
      topics.push(hashtag);
      entityTypes[hashtag] = 'hashtag';
    }
    relevanceScore += 0.15;
  }
  
  // Simple sentiment analysis
  for (const word of POLITICAL_KEYWORDS.sentiment_positive) {
    if (text.includes(word)) positiveScore += 1;
  }
  for (const word of POLITICAL_KEYWORDS.sentiment_negative) {
    if (text.includes(word)) negativeScore += 1;
  }
  
  const totalSentimentWords = positiveScore + negativeScore;
  let sentiment = 0;
  if (totalSentimentWords > 0) {
    sentiment = (positiveScore - negativeScore) / totalSentimentWords;
  }
  
  const sentimentLabel = sentiment > 0.2 ? 'positive' : 
                         sentiment < -0.2 ? 'negative' : 'neutral';
  
  return {
    topics: topics.slice(0, 8), // Max 8 topics
    sentiment: Math.round(sentiment * 100) / 100,
    sentiment_label: sentimentLabel,
    relevance_score: Math.min(relevanceScore, 1),
    hashtags,
    entity_types: entityTypes
  };
}

// Batch AI analysis for clusters (only when needed)
async function analyzeClusterWithAI(
  cluster: { title: string; items: string[] },
  apiKey: string
): Promise<{ summary: string; topics: string[] }> {
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a political news analyst. Extract specific named entities and events.
Output JSON only: {"summary": "2-sentence summary with specific names/events", "topics": ["PersonName", "OrganizationName", "SpecificEvent"]}`
          },
          {
            role: 'user',
            content: `Analyze this cluster of related headlines:\n${cluster.items.slice(0, 10).join('\n')}`
          }
        ],
        max_tokens: 200
      })
    });
    
    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }
    
    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return { summary: cluster.title, topics: [] };
  } catch (error) {
    console.error('AI analysis error:', error);
    return { summary: cluster.title, topics: [] };
  }
}

// Group similar headlines using title hash similarity
function groupSimilarContent(items: ContentItem[]): Map<string, ContentItem[]> {
  const groups = new Map<string, ContentItem[]>();
  
  for (const item of items) {
    // Create a simple fingerprint from key words
    const words = item.title.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3)
      .sort()
      .slice(0, 5)
      .join('_');
    
    const key = words || item.id;
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(item);
  }
  
  return groups;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { source_type, batch_size = 100 } = await req.json().catch(() => ({}));
    
    console.log(`Batch analyzing content with entity classification, source: ${source_type || 'all'}, batch: ${batch_size}`);
    
    let processedCount = 0;
    let clustersCreated = 0;
    let hashtagsExtracted = 0;
    
    // Process Google News
    if (!source_type || source_type === 'google_news') {
      const { data: newsItems } = await supabase
        .from('google_news_articles')
        .select('id, title, description')
        .eq('ai_processed', false)
        .order('published_at', { ascending: false })
        .limit(batch_size);
      
      if (newsItems && newsItems.length > 0) {
        console.log(`Processing ${newsItems.length} Google News items...`);
        
        for (const item of newsItems) {
          const analysis = analyzeContentLocally(item.title, item.description);
          
          await supabase
            .from('google_news_articles')
            .update({
              ai_processed: true,
              ai_topics: analysis.topics,
              ai_sentiment: analysis.sentiment,
              ai_sentiment_label: analysis.sentiment_label,
              relevance_score: analysis.relevance_score,
              extracted_hashtags: analysis.hashtags,
              updated_at: new Date().toISOString()
            })
            .eq('id', item.id);
          
          processedCount++;
          hashtagsExtracted += analysis.hashtags.length;
        }
      }
    }
    
    // Process Reddit posts (keeping for future)
    if (!source_type || source_type === 'reddit') {
      const { data: redditItems } = await supabase
        .from('reddit_posts')
        .select('id, title, selftext')
        .eq('ai_processed', false)
        .order('created_utc', { ascending: false })
        .limit(batch_size);
      
      if (redditItems && redditItems.length > 0) {
        console.log(`Processing ${redditItems.length} Reddit posts...`);
        
        for (const item of redditItems) {
          const analysis = analyzeContentLocally(item.title, item.selftext);
          
          await supabase
            .from('reddit_posts')
            .update({
              ai_processed: true,
              ai_topics: analysis.topics,
              ai_sentiment: analysis.sentiment,
              ai_sentiment_label: analysis.sentiment_label,
              relevance_score: analysis.relevance_score,
              updated_at: new Date().toISOString()
            })
            .eq('id', item.id);
          
          processedCount++;
        }
      }
    }
    
    // Process RSS articles  
    if (!source_type || source_type === 'rss') {
      const { data: rssItems } = await supabase
        .from('articles')
        .select('id, title, description')
        .is('extracted_topics', null)
        .order('published_date', { ascending: false })
        .limit(batch_size);
      
      if (rssItems && rssItems.length > 0) {
        console.log(`Processing ${rssItems.length} RSS articles...`);
        
        for (const item of rssItems) {
          const analysis = analyzeContentLocally(item.title, item.description);
          
          await supabase
            .from('articles')
            .update({
              extracted_topics: analysis.topics.map(t => ({
                topic: t,
                entity_type: analysis.entity_types[t] || 'category'
              })),
              sentiment_score: analysis.sentiment,
              sentiment_label: analysis.sentiment_label,
              extracted_hashtags: analysis.hashtags,
              updated_at: new Date().toISOString()
            })
            .eq('id', item.id);
          
          processedCount++;
          hashtagsExtracted += analysis.hashtags.length;
        }
      }
    }
    
    // Log batch stats
    await supabase.from('processing_batches').insert({
      batch_type: source_type || 'batch_analyze',
      items_count: processedCount,
      unique_items: processedCount,
      clusters_created: clustersCreated,
      ai_tokens_used: 0, // Local processing = 0 tokens
      processing_time_ms: Date.now() - startTime,
      completed_at: new Date().toISOString(),
      status: 'completed'
    });

    const result = {
      success: true,
      processed: processedCount,
      clusters_created: clustersCreated,
      hashtags_extracted: hashtagsExtracted,
      ai_tokens_used: 0,
      duration_ms: Date.now() - startTime
    };
    
    console.log('Batch analysis complete:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error in batch-analyze-content:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
