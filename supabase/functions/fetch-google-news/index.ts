import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Google News RSS feeds for political topics (FREE - no API key needed)
const GOOGLE_NEWS_RSS_FEEDS = [
  'https://news.google.com/rss/topics/CAAqIggKIhxDQkFTRHdvSkwyMHZNRFZ4ZERBU0FtVnVLQUFQAQ?hl=en-US&gl=US&ceid=US:en', // US Politics
  'https://news.google.com/rss/search?q=congress+legislation&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=white+house+biden+trump&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=supreme+court+ruling&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=election+2024+campaign&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=immigration+policy+border&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=civil+rights+discrimination&hl=en-US&gl=US&ceid=US:en',
];

interface NewsItem {
  title: string;
  source_name: string;
  source_url: string | null;
  description: string | null;
  published_at: string;
  url: string;
}

function parseRSSDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function extractSourceFromTitle(title: string): { cleanTitle: string; source: string } {
  // Google News format: "Article Title - Source Name"
  const parts = title.split(' - ');
  if (parts.length > 1) {
    const source = parts.pop() || 'Unknown';
    return { cleanTitle: parts.join(' - '), source };
  }
  return { cleanTitle: title, source: 'Unknown' };
}

async function fetchRSSFeed(feedUrl: string): Promise<NewsItem[]> {
  const items: NewsItem[] = [];
  
  try {
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PoliticalIntelBot/1.0)',
      },
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch ${feedUrl}: ${response.status}`);
      return items;
    }
    
    const xml = await response.text();
    
    // Parse RSS XML
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const titleRegex = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/;
    const linkRegex = /<link>(.*?)<\/link>/;
    const pubDateRegex = /<pubDate>(.*?)<\/pubDate>/;
    const descRegex = /<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/;
    const sourceRegex = /<source[^>]*url="([^"]*)"[^>]*>(.*?)<\/source>/;
    
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1];
      
      const titleMatch = itemXml.match(titleRegex);
      const linkMatch = itemXml.match(linkRegex);
      const pubDateMatch = itemXml.match(pubDateRegex);
      const descMatch = itemXml.match(descRegex);
      const sourceMatch = itemXml.match(sourceRegex);
      
      if (titleMatch && linkMatch) {
        const rawTitle = titleMatch[1] || titleMatch[2] || '';
        const { cleanTitle, source } = extractSourceFromTitle(rawTitle);
        
        items.push({
          title: cleanTitle,
          source_name: sourceMatch ? sourceMatch[2] : source,
          source_url: sourceMatch ? sourceMatch[1] : null,
          description: descMatch ? (descMatch[1] || descMatch[2] || null) : null,
          published_at: pubDateMatch ? parseRSSDate(pubDateMatch[1]) : new Date().toISOString(),
          url: linkMatch[1],
        });
      }
    }
  } catch (error) {
    console.error(`Error fetching RSS feed ${feedUrl}:`, error);
  }
  
  return items;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Fetching Google News RSS feeds...');
    
    // Fetch all feeds in parallel
    const feedPromises = GOOGLE_NEWS_RSS_FEEDS.map(feed => fetchRSSFeed(feed));
    const feedResults = await Promise.all(feedPromises);
    
    // Flatten and deduplicate
    const allItems = feedResults.flat();
    const uniqueItems = new Map<string, NewsItem>();
    
    for (const item of allItems) {
      if (!uniqueItems.has(item.url)) {
        uniqueItems.set(item.url, item);
      }
    }
    
    const itemsToInsert = Array.from(uniqueItems.values());
    console.log(`Found ${allItems.length} items, ${itemsToInsert.length} unique`);
    
    // Insert in batches, ignoring duplicates
    let inserted = 0;
    let duplicates = 0;
    const batchSize = 50;
    
    for (let i = 0; i < itemsToInsert.length; i += batchSize) {
      const batch = itemsToInsert.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('google_news_articles')
        .upsert(batch, { 
          onConflict: 'url',
          ignoreDuplicates: true 
        })
        .select('id');
      
      if (error) {
        console.error('Insert error:', error);
      } else {
        inserted += data?.length || 0;
      }
    }
    
    duplicates = itemsToInsert.length - inserted;
    
    // Log batch stats
    await supabase.from('processing_batches').insert({
      batch_type: 'google_news',
      items_count: allItems.length,
      unique_items: itemsToInsert.length,
      duplicates_removed: duplicates,
      processing_time_ms: Date.now() - startTime,
      completed_at: new Date().toISOString(),
      status: 'completed'
    });

    const result = {
      success: true,
      fetched: allItems.length,
      unique: itemsToInsert.length,
      inserted,
      duplicates,
      duration_ms: Date.now() - startTime
    };
    
    console.log('Google News fetch complete:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error in fetch-google-news:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
