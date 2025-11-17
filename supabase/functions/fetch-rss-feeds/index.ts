import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Keywords to tag articles
const KEYWORDS = [
  'arab american',
  'muslim american',
  'islamophobia',
  'middle east',
  'palestine',
  'israel',
  'gaza',
  'syria',
  'iraq',
  'civil liberties',
  'discrimination',
  'hate crime',
  'surveillance',
  'profiling'
];

// Simple hash function for deduplication
function generateHash(title: string, content: string): string {
  const text = (title + content).toLowerCase().replace(/\s+/g, '');
  return btoa(text.substring(0, 100)); // Simple hash using first 100 chars
}

// Extract tags from content
function extractTags(title: string, description: string, content: string): string[] {
  const text = `${title} ${description} ${content}`.toLowerCase();
  return KEYWORDS.filter(keyword => text.includes(keyword.toLowerCase()));
}

// Parse RSS feed using XMLHttpRequest response text
async function parseRSSFeed(url: string): Promise<any[]> {
  try {
    const response = await fetch(url);
    const text = await response.text();
    
    // Basic RSS/Atom parsing using regex (Deno-compatible approach)
    const items: any[] = [];
    
    // Extract items from RSS
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
    
    const extractText = (xml: string, tag: string): string => {
      const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
      const match = xml.match(regex);
      return match ? match[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
    };
    
    const extractAttr = (xml: string, tag: string, attr: string): string => {
      const regex = new RegExp(`<${tag}[^>]*${attr}=["']([^"']+)["']`, 'i');
      const match = xml.match(regex);
      return match ? match[1] : '';
    };
    
    // Try RSS items
    let matches = text.matchAll(itemRegex);
    let hasItems = false;
    
    for (const match of matches) {
      hasItems = true;
      const itemXml = match[1];
      
      const title = extractText(itemXml, 'title');
      const description = extractText(itemXml, 'description') || extractText(itemXml, 'content:encoded');
      const link = extractText(itemXml, 'link') || extractAttr(itemXml, 'link', 'href');
      const pubDate = extractText(itemXml, 'pubDate') || extractText(itemXml, 'published');
      
      // Extract image
      let imageUrl = extractAttr(itemXml, 'media:thumbnail', 'url') || 
                     extractAttr(itemXml, 'enclosure', 'url');
      
      if (!imageUrl && description) {
        const imgMatch = description.match(/<img[^>]+src=["']([^"']+)["']/);
        imageUrl = imgMatch ? imgMatch[1] : '';
      }
      
      if (title && link) {
        items.push({
          title,
          description: description.replace(/<[^>]*>/g, '').substring(0, 500),
          link,
          pubDate: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
          imageUrl: imageUrl || null
        });
      }
    }
    
    // Try Atom entries if no RSS items
    if (!hasItems) {
      matches = text.matchAll(entryRegex);
      for (const match of matches) {
        const entryXml = match[1];
        
        const title = extractText(entryXml, 'title');
        const summary = extractText(entryXml, 'summary') || extractText(entryXml, 'content');
        const link = extractAttr(entryXml, 'link', 'href');
        const published = extractText(entryXml, 'published') || extractText(entryXml, 'updated');
        
        if (title && link) {
          items.push({
            title,
            description: summary.replace(/<[^>]*>/g, '').substring(0, 500),
            link,
            pubDate: published ? new Date(published).toISOString() : new Date().toISOString(),
            imageUrl: null
          });
        }
      }
    }
    
    return items;
  } catch (error) {
    console.error(`Error parsing RSS feed ${url}:`, error);
    return [];
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting RSS feed fetch...');

    // Get all active RSS sources
    const { data: sources, error: sourcesError } = await supabase
      .from('rss_sources')
      .select('*')
      .eq('is_active', true);

    if (sourcesError) {
      throw sourcesError;
    }

    console.log(`Found ${sources?.length || 0} active RSS sources`);

    let totalArticles = 0;
    let totalErrors = 0;

    // Process each source
    for (const source of sources || []) {
      try {
        console.log(`Fetching ${source.name}...`);
        
        const items = await parseRSSFeed(source.url);
        console.log(`Found ${items.length} items from ${source.name}`);

        // Insert articles
        for (const item of items) {
          const hash = generateHash(item.title, item.description);
          const tags = extractTags(item.title, item.description, item.description);
          
          const { error: insertError } = await supabase
            .from('articles')
            .insert({
              title: item.title,
              description: item.description,
              content: item.description,
              source_id: source.id,
              source_name: source.name,
              source_url: item.link,
              published_date: item.pubDate,
              image_url: item.imageUrl,
              tags,
              hash_signature: hash,
              category: source.category
            })
            .select()
            .maybeSingle();

          if (!insertError) {
            totalArticles++;
          } else if (!insertError.message?.includes('duplicate key')) {
            console.error(`Error inserting article from ${source.name}:`, insertError);
          }
        }

        // Update source last fetch time
        await supabase
          .from('rss_sources')
          .update({ 
            last_fetched_at: new Date().toISOString(),
            fetch_error: null 
          })
          .eq('id', source.id);

      } catch (error: any) {
        totalErrors++;
        console.error(`Error processing ${source.name}:`, error);
        
        // Update source with error
        await supabase
          .from('rss_sources')
          .update({ 
            fetch_error: error?.message || 'Unknown error',
            last_fetched_at: new Date().toISOString()
          })
          .eq('id', source.id);
      }
    }

    console.log(`Completed: ${totalArticles} new articles, ${totalErrors} errors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        articlesAdded: totalArticles,
        sourcesProcessed: sources?.length || 0,
        errors: totalErrors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in fetch-rss-feeds:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
