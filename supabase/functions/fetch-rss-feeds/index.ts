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

// Enhanced threat detection keywords
const THREAT_KEYWORDS = {
  critical: [
    'terrorist designation',
    'terrorist organization',
    'material support',
    'foreign terrorist',
    'designated entity',
    'sanctions',
    'asset freeze',
    'travel ban',
    'muslim ban',
    'immigration ban',
    'mosque surveillance',
    'religious registry',
  ],
  high: [
    'muslim',
    'islam',
    'islamic',
    'arab',
    'cair',
    'mpac',
    'immigration enforcement',
    'deportation',
    'visa restriction',
    'refugee ban',
    'asylum',
    'surveillance program',
    'counterterrorism',
    'radicalization',
    'extremism',
    'religious freedom',
    'civil liberties violation',
    'discrimination lawsuit',
    'hate crime',
    'profiling',
    'executive order',
  ],
  medium: [
    'immigration',
    'border security',
    'national security',
    'homeland security',
    'nonprofit',
    'charitable organization',
    'religious organization',
    'first amendment',
    'free speech',
  ]
};

// Organizations to specifically track
const TRACKED_ORGANIZATIONS = [
  'cair', 'council on american-islamic relations',
  'mpac', 'muslim public affairs council',
  'isna', 'islamic society of north america',
  'adc', 'american-arab anti-discrimination committee',
  'aai', 'arab american institute',
  'mas', 'muslim american society',
  'icna', 'islamic circle of north america',
  'aclu',
];

// Calculate threat level for articles
function calculateThreatLevel(text: string): { level: string; score: number; affectedOrgs: string[] } {
  const lowerText = text.toLowerCase();
  const affectedOrgs: string[] = [];
  let score = 0;

  // Check critical keywords
  for (const keyword of THREAT_KEYWORDS.critical) {
    if (lowerText.includes(keyword)) {
      score += 50;
    }
  }

  // Check high-priority keywords
  for (const keyword of THREAT_KEYWORDS.high) {
    if (lowerText.includes(keyword)) {
      score += 15;
    }
  }

  // Check medium-priority keywords
  for (const keyword of THREAT_KEYWORDS.medium) {
    if (lowerText.includes(keyword)) {
      score += 5;
    }
  }

  // Check for tracked organizations
  for (const org of TRACKED_ORGANIZATIONS) {
    if (lowerText.includes(org)) {
      score += 30;
      // Extract org name for affected_organizations
      const orgName = org.includes('cair') ? 'CAIR' :
                      org.includes('mpac') ? 'MPAC' :
                      org.includes('isna') ? 'ISNA' :
                      org.includes('adc') ? 'ADC' :
                      org.includes('aai') ? 'AAI' :
                      org.includes('mas') ? 'MAS' :
                      org.includes('icna') ? 'ICNA' :
                      org.includes('aclu') ? 'ACLU' : org.toUpperCase();
      if (!affectedOrgs.includes(orgName)) {
        affectedOrgs.push(orgName);
      }
    }
  }

  // Determine threat level
  let level = 'low';
  if (score >= 50) {
    level = 'critical';
  } else if (score >= 30) {
    level = 'high';
  } else if (score >= 15) {
    level = 'medium';
  }

  return { level, score: Math.min(score, 100), affectedOrgs };
}

// Simple hash function for deduplication
function generateHash(title: string, content: string): string {
  const text = (title + content).toLowerCase().replace(/\s+/g, '');
  return btoa(text.substring(0, 100)); // Simple hash using first 100 chars
}

// Sanitize text to handle special characters and prevent encoding errors
function sanitizeText(text: string): string {
  if (!text) return '';

  // First decode HTML entities
  let decoded = text
    // Named entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&lsquo;/g, ''')
    .replace(/&rsquo;/g, ''')
    .replace(/&hellip;/g, '…')
    // Numeric entities (decimal)
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    // Numeric entities (hex)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  // Remove problematic characters while preserving content
  return decoded
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '') // Remove control characters
    .replace(/\uFFFD/g, '') // Remove replacement characters
    .trim();
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
          const sanitizedTitle = sanitizeText(item.title);
          const sanitizedDescription = sanitizeText(item.description);
          const hash = generateHash(sanitizedTitle, sanitizedDescription);
          const tags = extractTags(sanitizedTitle, sanitizedDescription, sanitizedDescription);

          // Calculate threat level
          const textToAnalyze = `${sanitizedTitle} ${sanitizedDescription}`;
          const { level: threatLevel, score, affectedOrgs } = calculateThreatLevel(textToAnalyze);

          const { data: insertedArticle, error: insertError } = await supabase
            .from('articles')
            .insert({
              title: sanitizedTitle,
              description: sanitizedDescription,
              content: sanitizedDescription,
              source_id: source.id,
              source_name: source.name,
              source_url: item.link,
              published_date: item.pubDate,
              image_url: item.imageUrl,
              tags,
              hash_signature: hash,
              category: source.category,
              threat_level: threatLevel,
              affected_organizations: affectedOrgs,
            })
            .select()
            .maybeSingle();

          if (!insertError && insertedArticle) {
            totalArticles++;

            // Create notifications for critical/high threat articles
            if (threatLevel === 'critical' || threatLevel === 'high') {
              const { data: users } = await supabase
                .from('user_article_preferences')
                .select('user_id')
                .limit(100);

              if (users && users.length > 0) {
                const priorityEmoji = threatLevel === 'critical' ? '🚨' : '⚠️';
                const notifications = users.map((user: any) => ({
                  user_id: user.user_id,
                  title: `${priorityEmoji} ${threatLevel.toUpperCase()}: ${source.name}`,
                  message: sanitizedTitle.substring(0, 200),
                  priority: threatLevel,
                  source_type: 'article',
                  source_id: insertedArticle.id,
                  link: item.link,
                }));

                await supabase
                  .from('notifications')
                  .insert(notifications);
              }
            }
          } else if (insertError && !insertError.message?.includes('duplicate key')) {
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
