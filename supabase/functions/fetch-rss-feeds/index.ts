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

// IMPROVED THREAT DETECTION
// Threat indicators - show something BAD is happening TO an organization
const THREAT_INDICATORS = {
  critical: [
    'designated as terrorist',
    'terrorist designation',
    'sanctions against',
    'banned',
    'asset freeze',
    'criminal charges',
    'indictment',
    'sued for',
    'investigation into',
    'crackdown on',
    'shutdown',
    'dissolved',
  ],
  high: [
    'accused of',
    'alleged',
    'controversy',
    'criticism',
    'protest against',
    'opposition to',
    'concerns about',
    'questioned',
    'challenged',
    'scrutiny',
    'under fire',
    'backlash',
  ],
  medium: [
    'debate over',
    'discussion about',
    'focus on',
    'attention to',
  ]
};

// Issue keywords - topics that are relevant to monitor
const ISSUE_KEYWORDS = {
  high_priority: [
    'surveillance',
    'profiling',
    'discrimination lawsuit',
    'hate crime',
    'civil rights violation',
    'religious freedom violation',
    'deportation',
    'immigration enforcement',
    'travel ban',
    'refugee ban',
  ],
  medium_priority: [
    'immigration',
    'border security',
    'national security',
    'counterterrorism',
    'religious freedom',
    'civil liberties',
    'first amendment',
  ]
};

// Organizations to track (pattern -> display name)
const TRACKED_ORGS: Record<string, string> = {
  'cair': 'CAIR',
  'council on american-islamic relations': 'CAIR',
  'mpac': 'MPAC',
  'muslim public affairs council': 'MPAC',
  'isna': 'ISNA',
  'islamic society of north america': 'ISNA',
  'adc': 'ADC',
  'american-arab anti-discrimination committee': 'ADC',
  'aai': 'AAI',
  'arab american institute': 'AAI',
  'mas': 'MAS',
  'muslim american society': 'MAS',
  'icna': 'ICNA',
  'islamic circle of north america': 'ICNA',
  'aclu': 'ACLU',
  'american civil liberties union': 'ACLU',
};

// Calculate threat level for articles - IMPROVED VERSION
function calculateThreatLevel(text: string, sourceName: string): { level: string; score: number; affectedOrgs: string[] } {
  const lowerText = text.toLowerCase();
  const lowerSource = sourceName.toLowerCase();
  const affectedOrgs: string[] = [];
  let score = 0;

  // 1. IDENTIFY AFFECTED ORGANIZATIONS
  const mentionedOrgs = new Set<string>();
  for (const [pattern, orgName] of Object.entries(TRACKED_ORGS)) {
    if (lowerText.includes(pattern)) {
      mentionedOrgs.add(orgName);
      if (!affectedOrgs.includes(orgName)) {
        affectedOrgs.push(orgName);
      }
    }
  }

  // 2. CHECK IF ARTICLE IS FROM A TRACKED ORG
  let isFromTrackedOrg = false;
  for (const [pattern] of Object.entries(TRACKED_ORGS)) {
    if (lowerSource.includes(pattern)) {
      isFromTrackedOrg = true;
      break;
    }
  }

  // 3. SCORE BASED ON THREAT INDICATORS
  // Critical threats (things happening TO organizations)
  for (const indicator of THREAT_INDICATORS.critical) {
    if (lowerText.includes(indicator)) {
      // Only score if an org is mentioned (threat must target someone)
      if (mentionedOrgs.size > 0) {
        score += 50;
        break; // One critical indicator is enough
      }
    }
  }

  // High threat indicators
  if (score < 50) { // Don't stack if already critical
    for (const indicator of THREAT_INDICATORS.high) {
      if (lowerText.includes(indicator)) {
        if (mentionedOrgs.size > 0) {
          score += 20;
          break; // One high indicator is enough
        }
      }
    }
  }

  // Medium threat indicators
  if (score < 20) { // Don't stack if already high/critical
    for (const indicator of THREAT_INDICATORS.medium) {
      if (lowerText.includes(indicator)) {
        if (mentionedOrgs.size > 0) {
          score += 10;
          break;
        }
      }
    }
  }

  // 4. SCORE BASED ON ISSUE RELEVANCE
  // High priority issues
  for (const issue of ISSUE_KEYWORDS.high_priority) {
    if (lowerText.includes(issue)) {
      score += 15;
      break; // One mention is enough
    }
  }

  // Medium priority issues
  if (score < 15) { // Only if no high-priority issues found
    for (const issue of ISSUE_KEYWORDS.medium_priority) {
      if (lowerText.includes(issue)) {
        score += 5;
        break;
      }
    }
  }

  // 5. BONUS POINTS IF ARTICLE IS ABOUT (NOT FROM) A TRACKED ORG
  if (mentionedOrgs.size > 0 && !isFromTrackedOrg) {
    // Article mentions tracked org but isn't from that org
    // This means outside coverage, which could be significant
    score += 10;
  }

  // 6. DETERMINE THREAT LEVEL
  let level = 'low';
  if (score >= 50) {
    level = 'critical';
  } else if (score >= 25) {
    level = 'high';
  } else if (score >= 10) {
    level = 'medium';
  }

  return { level, score: Math.min(score, 100), affectedOrgs };
}

// Simple hash function for deduplication (UTF-8 safe)
function generateHash(title: string, content: string): string {
  const text = (title + content).toLowerCase().replace(/\s+/g, '');
  // Use a simple hash instead of btoa to avoid encoding issues
  let hash = 0;
  const textSubstring = text.substring(0, 100);
  for (let i = 0; i < textSubstring.length; i++) {
    const char = textSubstring.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
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
    .replace(/&lsquo;/g, '\u2018')
    .replace(/&rsquo;/g, '\u2019')
    .replace(/&hellip;/g, '\u2026')
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

    // Process source helper function
    const processSource = async (source: any) => {
      let articlesAdded = 0;
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
          const { level: threatLevel, score, affectedOrgs } = calculateThreatLevel(textToAnalyze, source.name);

          const { data: insertedArticle, error: insertError } = await supabase
            .from('articles')
            .insert({
              title: sanitizedTitle,
              description: sanitizedDescription,
              content: sanitizedDescription,
              source_id: source.id,
              source_name: source.name,
              source_url: item.link, // Individual article link
              published_date: item.pubDate,
              image_url: item.imageUrl,
              tags,
              hash_signature: hash,
              category: source.category,
              threat_level: threatLevel,
              affected_organizations: affectedOrgs,
              processing_status: 'pending',
            })
            .select()
            .maybeSingle();

          if (!insertError && insertedArticle) {
            articlesAdded++;

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

        return { success: true, articlesAdded };

      } catch (error: any) {
        console.error(`Error processing ${source.name}:`, error);

        // Update source with error
        await supabase
          .from('rss_sources')
          .update({
            fetch_error: error?.message || 'Unknown error',
            last_fetched_at: new Date().toISOString()
          })
          .eq('id', source.id);

        return { success: false, error: error?.message };
      }
    };

    // Process sources in parallel batches of 30
    const BATCH_SIZE = 30;
    const sourcesToProcess = sources || [];

    for (let i = 0; i < sourcesToProcess.length; i += BATCH_SIZE) {
      const batch = sourcesToProcess.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(sourcesToProcess.length / BATCH_SIZE)} (${batch.length} sources)`);

      const results = await Promise.all(batch.map(processSource));

      results.forEach(result => {
        if (result.success) {
          totalArticles += result.articlesAdded || 0;
        } else {
          totalErrors++;
        }
      });
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
