import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateCronOrAdmin, logJobFailure, checkRateLimit } from "../_shared/security.ts";

const corsHeaders = getCorsHeaders();

// COMPREHENSIVE POLITICAL KEYWORDS - Tag all relevant topics
const KEYWORDS = [
  // Communities & Identity
  'muslim american', 'arab american', 'jewish american', 'christian',
  'lgbtq', 'transgender', 'gay rights', 'black lives matter', 
  'latino', 'hispanic', 'asian american', 'indigenous', 'native american',
  'disability rights', 'women rights', 'reproductive rights',
  
  // Civil Rights & Justice
  'civil liberties', 'civil rights', 'discrimination', 'hate crime',
  'police brutality', 'criminal justice', 'voting rights', 'surveillance',
  'profiling', 'first amendment', 'religious freedom', 'islamophobia',
  'antisemitism', 'racism', 'xenophobia', 'homophobia', 'transphobia',
  
  // Immigration
  'immigration', 'refugee', 'asylum', 'deportation', 'border', 'daca',
  'travel ban', 'sanctuary city', 'ice', 'customs',
  
  // Policy Areas
  'healthcare', 'medicare', 'medicaid', 'affordable care act',
  'climate change', 'environment', 'clean energy',
  'education', 'student debt', 'charter schools',
  'economy', 'inflation', 'minimum wage', 'unemployment',
  'housing', 'homelessness', 'affordable housing',
  'gun control', 'second amendment',
  
  // International (US Policy Impact)
  'middle east', 'palestine', 'israel', 'gaza', 'west bank',
  'syria', 'iraq', 'afghanistan', 'iran', 'yemen',
  'ukraine', 'russia', 'china', 'foreign policy',
  
  // Government
  'congress', 'senate', 'house of representatives', 'legislation',
  'executive order', 'supreme court', 'federal court', 'state legislature'
];

// IMPROVED THREAT DETECTION
const THREAT_INDICATORS = {
  critical: [
    'designated as terrorist', 'terrorist designation', 'sanctions against',
    'banned', 'asset freeze', 'criminal charges', 'indictment',
    'sued for', 'investigation into', 'crackdown on', 'shutdown', 'dissolved',
  ],
  high: [
    'accused of', 'alleged', 'controversy', 'criticism', 'protest against',
    'opposition to', 'concerns about', 'questioned', 'challenged',
    'scrutiny', 'under fire', 'backlash',
  ],
  medium: ['debate over', 'discussion about', 'focus on', 'attention to']
};

const ISSUE_KEYWORDS = {
  high_priority: [
    'surveillance', 'profiling', 'discrimination lawsuit', 'hate crime',
    'civil rights violation', 'religious freedom violation', 'deportation',
    'immigration enforcement', 'travel ban', 'refugee ban',
  ],
  medium_priority: [
    'immigration', 'border security', 'national security', 'counterterrorism',
    'religious freedom', 'civil liberties', 'first amendment',
  ]
};

const TRACKED_ORGS: Record<string, string> = {
  'cair': 'CAIR', 'council on american-islamic relations': 'CAIR',
  'mpac': 'MPAC', 'muslim public affairs council': 'MPAC',
  'isna': 'ISNA', 'islamic society of north america': 'ISNA',
  'adc': 'ADC', 'american-arab anti-discrimination committee': 'ADC',
  'aai': 'AAI', 'arab american institute': 'AAI',
  'mas': 'MAS', 'muslim american society': 'MAS',
  'icna': 'ICNA', 'islamic circle of north america': 'ICNA',
  'aclu': 'ACLU', 'american civil liberties union': 'ACLU',
};

function calculateThreatLevel(text: string, sourceName: string): { level: string; score: number; affectedOrgs: string[] } {
  const lowerText = text.toLowerCase();
  const lowerSource = sourceName.toLowerCase();
  const affectedOrgs: string[] = [];
  let score = 0;

  const mentionedOrgs = new Set<string>();
  for (const [pattern, orgName] of Object.entries(TRACKED_ORGS)) {
    if (lowerText.includes(pattern)) {
      mentionedOrgs.add(orgName);
      if (!affectedOrgs.includes(orgName)) affectedOrgs.push(orgName);
    }
  }

  let isFromTrackedOrg = false;
  for (const [pattern] of Object.entries(TRACKED_ORGS)) {
    if (lowerSource.includes(pattern)) {
      isFromTrackedOrg = true;
      break;
    }
  }

  for (const indicator of THREAT_INDICATORS.critical) {
    if (lowerText.includes(indicator) && mentionedOrgs.size > 0) {
      score += 50;
      break;
    }
  }

  if (score < 50) {
    for (const indicator of THREAT_INDICATORS.high) {
      if (lowerText.includes(indicator) && mentionedOrgs.size > 0) {
        score += 20;
        break;
      }
    }
  }

  if (score < 20) {
    for (const indicator of THREAT_INDICATORS.medium) {
      if (lowerText.includes(indicator) && mentionedOrgs.size > 0) {
        score += 10;
        break;
      }
    }
  }

  for (const issue of ISSUE_KEYWORDS.high_priority) {
    if (lowerText.includes(issue)) {
      score += 15;
      break;
    }
  }

  if (score < 15) {
    for (const issue of ISSUE_KEYWORDS.medium_priority) {
      if (lowerText.includes(issue)) {
        score += 5;
        break;
      }
    }
  }

  if (mentionedOrgs.size > 0 && !isFromTrackedOrg) score += 10;

  let level = 'low';
  if (score >= 50) level = 'critical';
  else if (score >= 25) level = 'high';
  else if (score >= 10) level = 'medium';

  return { level, score: Math.min(score, 100), affectedOrgs };
}

function generateHash(title: string, content: string): string {
  const text = (title + content).toLowerCase().replace(/\s+/g, '');
  let hash = 0;
  const textSubstring = text.substring(0, 100);
  for (let i = 0; i < textSubstring.length; i++) {
    const char = textSubstring.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

function sanitizeText(text: string): string {
  if (!text) return '';
  let decoded = text
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—')
    .replace(/&ldquo;/g, '"').replace(/&rdquo;/g, '"')
    .replace(/&lsquo;/g, '\u2018').replace(/&rsquo;/g, '\u2019')
    .replace(/&hellip;/g, '\u2026')
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  return decoded
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    .replace(/\uFFFD/g, '')
    .trim();
}

function extractTags(title: string, description: string, content: string): string[] {
  const text = `${title} ${description} ${content}`.toLowerCase();
  return KEYWORDS.filter(keyword => text.includes(keyword.toLowerCase()));
}

async function parseRSSFeed(url: string): Promise<any[]> {
  try {
    const response = await fetch(url);
    const text = await response.text();
    const items: any[] = [];
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
    
    let matches = text.matchAll(itemRegex);
    let hasItems = false;
    
    for (const match of matches) {
      hasItems = true;
      const itemXml = match[1];
      const title = extractText(itemXml, 'title');
      const description = extractText(itemXml, 'description') || extractText(itemXml, 'content:encoded');
      const link = extractText(itemXml, 'link') || extractAttr(itemXml, 'link', 'href');
      const pubDate = extractText(itemXml, 'pubDate') || extractText(itemXml, 'published');
      let imageUrl = extractAttr(itemXml, 'media:thumbnail', 'url') || extractAttr(itemXml, 'enclosure', 'url');
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

    // SECURITY: Validate cron secret or admin JWT
    const authResult = await validateCronOrAdmin(req, supabase);
    if (!authResult.valid) {
      console.error('[fetch-rss-feeds] Unauthorized access attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log(`[fetch-rss-feeds] Authorized via ${authResult.source}`);

    // SECURITY: Rate limiting
    const rateLimit = checkRateLimit('fetch-rss-feeds', 10, 60000);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', resetAt: rateLimit.resetAt }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting incremental RSS feed fetch...');
    
    const { data: sources, error: sourcesError } = await supabase
      .from('rss_sources')
      .select('*')
      .eq('is_active', true)
      .order('last_fetched_at', { ascending: true, nullsFirst: true })
      .limit(30);

    if (sourcesError) throw sourcesError;

    console.log(`Processing batch: ${sources?.length || 0} sources (oldest first)`);

    let totalArticles = 0;
    let totalErrors = 0;

    for (const source of sources || []) {
      try {
        console.log(`Fetching ${source.name}...`);
        const items = await parseRSSFeed(source.url);
        console.log(`Found ${items.length} items from ${source.name}`);

        const articlesToUpsert: any[] = [];

        for (const item of items) {
          const sanitizedTitle = sanitizeText(item.title);
          const sanitizedDescription = sanitizeText(item.description);
          const fullContent = sanitizedDescription.substring(0, 1000);
          const hash = generateHash(sanitizedTitle, sanitizedDescription);
          const tags = extractTags(sanitizedTitle, sanitizedDescription, sanitizedDescription);
          const textToAnalyze = `${sanitizedTitle} ${fullContent}`;
          const { level: threatLevel, affectedOrgs } = calculateThreatLevel(textToAnalyze, source.name);

          articlesToUpsert.push({
            title: sanitizedTitle,
            description: sanitizedDescription.substring(0, 500),
            content: fullContent,
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
            processing_status: 'pending',
          });
        }

        if (articlesToUpsert.length > 0) {
          const { data: upsertedArticles, error: upsertError } = await supabase
            .from('articles')
            .upsert(articlesToUpsert, { onConflict: 'hash_signature', ignoreDuplicates: true })
            .select('id, hash_signature');

          if (upsertError) {
            console.error(`Batch upsert error for ${source.name}:`, upsertError.message);
            totalErrors++;
          } else {
            totalArticles += upsertedArticles?.length || 0;
          }
        }

        await supabase
          .from('rss_sources')
          .update({ last_fetched_at: new Date().toISOString(), fetch_error: null })
          .eq('id', source.id);

      } catch (sourceError: any) {
        console.error(`Error processing source ${source.name}:`, sourceError.message);
        totalErrors++;
        await supabase
          .from('rss_sources')
          .update({ fetch_error: sourceError.message, last_fetched_at: new Date().toISOString() })
          .eq('id', source.id);
      }
    }

    console.log(`RSS fetch complete: ${totalArticles} articles, ${totalErrors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        articles_added: totalArticles,
        sources_processed: sources?.length || 0,
        errors: totalErrors,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[fetch-rss-feeds] Error:', error);
    
    // Log failure for monitoring
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    await logJobFailure(supabase, 'fetch-rss-feeds', error.message);
    
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
