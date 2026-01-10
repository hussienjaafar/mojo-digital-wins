import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateCronOrAdmin, logJobFailure, checkRateLimit } from "../_shared/security.ts";
import { fetchAndParseFeed } from "../_shared/xmlParser.ts";
import { normalizeUrl, generateDedupeKey, generateContentHash, extractCanonicalUrl } from "../_shared/urlNormalizer.ts";

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

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, (match) => `\\${match}`);
}

const KEYWORD_PATTERNS = KEYWORDS.map((keyword) => ({
  keyword,
  regex: new RegExp(`\\b${escapeRegex(keyword).replace(/\s+/g, "\\s+")}\\b`, "i"),
}));

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

function sanitizeText(text: string): string {
  if (!text) return '';
  let decoded = text
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&ndash;/g, '-').replace(/&mdash;/g, '--')
    .replace(/&ldquo;/g, '"').replace(/&rdquo;/g, '"')
    .replace(/&lsquo;/g, "'").replace(/&rsquo;/g, "'")
    .replace(/&hellip;/g, "...")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\u2013/g, '-').replace(/\u2014/g, '--');
  return decoded
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    .replace(/\uFFFD/g, '')
    .trim();
}

function extractTags(title: string, description: string, content: string): string[] {
  const text = `${title} ${description} ${content}`;
  return KEYWORD_PATTERNS
    .filter(({ regex }) => regex.test(text))
    .map(({ keyword }) => keyword);
}

async function parseRSSFeed(url: string): Promise<any[]> {
  try {
    const feed = await fetchAndParseFeed(url, { timeout: 15000 });
    
    return feed.items.map(item => ({
      title: item.title,
      description: item.description.substring(0, 500),
      link: normalizeUrl(item.link),
      pubDate: item.pubDate,
      imageUrl: item.imageUrl || null
    }));
  } catch (error) {
    console.error(`Error parsing RSS feed ${url}:`, error);
    throw error; // Re-throw to handle in caller
  }
}

/**
 * Check if source is in backoff period
 */
function isInBackoff(source: any): boolean {
  if (!source.backoff_until) return false;
  return new Date(source.backoff_until) > new Date();
}

/**
 * Update source health via RPC
 */
async function updateSourceHealth(
  supabase: any,
  sourceId: string,
  success: boolean,
  errorMessage?: string,
  itemsFetched?: number
): Promise<void> {
  try {
    await supabase.rpc('update_source_health', {
      p_source_id: sourceId,
      p_source_type: 'rss',
      p_success: success,
      p_error_message: errorMessage || null,
      p_items_fetched: itemsFetched || 0
    });
  } catch (err) {
    console.error(`Failed to update source health for ${sourceId}:`, err);
  }
}

/**
 * Register article in dedupe registry
 */
async function registerForDedupe(
  supabase: any,
  contentHash: string,
  canonicalUrl: string,
  sourceType: string,
  sourceId: string,
  articleId: string,
  titleSnippet: string,
  publishedDate: string
): Promise<void> {
  try {
    await supabase.from('article_dedupe_registry').upsert({
      content_hash: contentHash,
      canonical_url: canonicalUrl,
      source_type: sourceType,
      source_id: sourceId,
      article_id: articleId,
      title_snippet: titleSnippet.substring(0, 100),
      published_date: publishedDate.split('T')[0]
    }, { 
      onConflict: 'content_hash,source_type',
      ignoreDuplicates: true 
    });
  } catch (err) {
    // Non-critical, just log
    console.warn('Failed to register for dedupe:', err);
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
    console.log(`[fetch-rss-feeds] Authorized via ${authResult.isAdmin ? 'admin' : 'cron'}`);

    // SECURITY: Rate limiting
    const rateLimit = await checkRateLimit('fetch-rss-feeds', 10, 60000);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', resetAt: rateLimit.resetAt }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting incremental RSS feed fetch...');
    
    // Fetch sources from DB (not hardcoded) - skip those in backoff
    const { data: sources, error: sourcesError } = await supabase
      .from('rss_sources')
      .select('*')
      .eq('is_active', true)
      .or('backoff_until.is.null,backoff_until.lt.now()')
      .order('last_fetched_at', { ascending: true, nullsFirst: true })
      .limit(30);

    if (sourcesError) throw sourcesError;

    console.log(`Processing batch: ${sources?.length || 0} sources (oldest first, excluding backoff)`);

    let totalArticles = 0;
    let totalErrors = 0;
    let sourcesProcessed = 0;
    let duplicatesSkipped = 0;

    for (const source of sources || []) {
      // Double-check backoff (in case filter didn't work)
      if (isInBackoff(source)) {
        console.log(`Skipping ${source.name} - in backoff until ${source.backoff_until}`);
        continue;
      }

      try {
        console.log(`Fetching ${source.name}...`);
        const items = await parseRSSFeed(source.url);
        console.log(`Found ${items.length} items from ${source.name}`);

        const articlesToUpsert: any[] = [];

        for (const item of items) {
          const sanitizedTitle = sanitizeText(item.title);
          const sanitizedDescription = sanitizeText(item.description);
          const fullContent = sanitizedDescription.substring(0, 1000);
          
          // Generate canonical URL and content hash for cross-source dedupe
          const canonicalUrl = extractCanonicalUrl(item.link);
          const contentHash = generateContentHash(sanitizedTitle, item.link, item.pubDate, source.name);
          
          // Use robust dedup key combining URL, title, date, and source
          const dedupeKey = generateDedupeKey(item.link, sanitizedTitle, item.pubDate, source.id);
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
            canonical_url: canonicalUrl,
            content_hash: contentHash,
            published_date: item.pubDate,
            image_url: item.imageUrl,
            tags,
            hash_signature: dedupeKey,
            dedupe_key: dedupeKey,
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
            .select('id, hash_signature, content_hash, canonical_url, title, published_date');

          if (upsertError) {
            console.error(`Batch upsert error for ${source.name}:`, upsertError.message);
            totalErrors++;
            await updateSourceHealth(supabase, source.id, false, upsertError.message);
          } else {
            const insertedCount = upsertedArticles?.length || 0;
            totalArticles += insertedCount;
            duplicatesSkipped += articlesToUpsert.length - insertedCount;
            
            // Register new articles in dedupe registry
            for (const article of upsertedArticles || []) {
              await registerForDedupe(
                supabase,
                article.content_hash,
                article.canonical_url,
                'rss',
                source.id,
                article.id,
                article.title,
                article.published_date
              );
            }
            
            // Update source health on success
            await updateSourceHealth(supabase, source.id, true, undefined, insertedCount);
          }
        } else {
          // No items but successful fetch
          await updateSourceHealth(supabase, source.id, true, undefined, 0);
        }

        sourcesProcessed++;

      } catch (sourceError: any) {
        console.error(`Error processing source ${source.name}:`, sourceError.message);
        totalErrors++;
        
        // Update source health with error (triggers exponential backoff)
        await updateSourceHealth(supabase, source.id, false, sourceError.message);
      }
    }

    console.log(`RSS fetch complete: ${totalArticles} articles, ${duplicatesSkipped} duplicates skipped, ${totalErrors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        articles_added: totalArticles,
        duplicates_skipped: duplicatesSkipped,
        sources_processed: sourcesProcessed,
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




