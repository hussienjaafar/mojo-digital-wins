import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateCronOrAdmin, logJobFailure, checkRateLimit } from "../_shared/security.ts";
import { normalizeUrl, generateContentHash, extractCanonicalUrl } from "../_shared/urlNormalizer.ts";

const corsHeaders = getCorsHeaders();

interface NewsItem {
  title: string;
  source_name: string;
  source_url: string | null;
  description: string | null;
  published_at: string;
  url: string;
  canonical_url: string;
  content_hash: string;
}

interface GoogleNewsSource {
  id: string;
  name: string;
  url: string;
  tier: string;
  tags: string[];
  is_active: boolean;
  backoff_until: string | null;
  consecutive_errors: number;
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

/**
 * Check if source is in backoff period
 */
function isInBackoff(source: GoogleNewsSource): boolean {
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
      p_source_type: 'google_news',
      p_success: success,
      p_error_message: errorMessage || null,
      p_items_fetched: itemsFetched || 0
    });
  } catch (err) {
    console.error(`Failed to update source health for ${sourceId}:`, err);
  }
}

/**
 * Register article in dedupe registry for cross-source deduplication
 */
async function registerForDedupe(
  supabase: any,
  contentHash: string,
  canonicalUrl: string,
  sourceId: string,
  articleId: string,
  titleSnippet: string,
  publishedDate: string
): Promise<void> {
  try {
    await supabase.from('article_dedupe_registry').upsert({
      content_hash: contentHash,
      canonical_url: canonicalUrl,
      source_type: 'google_news',
      source_id: sourceId,
      article_id: articleId,
      title_snippet: titleSnippet.substring(0, 100),
      published_date: publishedDate.split('T')[0]
    }, { 
      onConflict: 'content_hash,source_type',
      ignoreDuplicates: true 
    });
  } catch (err) {
    console.warn('Failed to register for dedupe:', err);
  }
}

async function fetchRSSFeed(feedUrl: string, sourceName: string): Promise<NewsItem[]> {
  const items: NewsItem[] = [];
  
  try {
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PoliticalIntelBot/1.0)',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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
        const rawUrl = linkMatch[1];
        const normalizedUrl = normalizeUrl(rawUrl);
        const publishedAt = pubDateMatch ? parseRSSDate(pubDateMatch[1]) : new Date().toISOString();
        
        // Generate canonical URL and content hash for deduplication
        const canonicalUrl = extractCanonicalUrl(normalizedUrl);
        const contentHash = generateContentHash(cleanTitle, normalizedUrl, publishedAt, source);
        
        items.push({
          title: cleanTitle,
          source_name: sourceMatch ? sourceMatch[2] : source,
          source_url: sourceMatch ? sourceMatch[1] : null,
          description: descMatch ? (descMatch[1] || descMatch[2] || null) : null,
          published_at: publishedAt,
          url: normalizedUrl,
          canonical_url: canonicalUrl,
          content_hash: contentHash,
        });
      }
    }
  } catch (error) {
    console.error(`Error fetching RSS feed ${feedUrl}:`, error);
    throw error; // Re-throw to handle in caller
  }
  
  return items;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // SECURITY: Require cron secret or admin JWT
    const authResult = await validateCronOrAdmin(req, supabase);
    if (!authResult.valid) {
      console.error('[fetch-google-news] Unauthorized access attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Rate limiting
    const rateLimit = await checkRateLimit('fetch-google-news', 10, 60000);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', resetAt: rateLimit.resetAt }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching Google News sources from database...');
    
    // Limit sources per run to prevent CPU timeout (edge functions have ~30s limit)
    const MAX_SOURCES_PER_RUN = 6;
    
    // Fetch sources from DB (not hardcoded) - skip those in backoff
    // Order by last_fetched_at to ensure round-robin processing
    const { data: allSources, error: sourcesError } = await supabase
      .from('google_news_sources')
      .select('*')
      .eq('is_active', true)
      .or('backoff_until.is.null,backoff_until.lt.now()')
      .order('last_fetched_at', { ascending: true, nullsFirst: true })
      .limit(MAX_SOURCES_PER_RUN);

    if (sourcesError) {
      throw new Error(`Failed to fetch sources: ${sourcesError.message}`);
    }

    if (!allSources || allSources.length === 0) {
      console.log('No active Google News sources found');
      return new Response(
        JSON.stringify({ success: true, message: 'No active sources', fetched: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sources = allSources;
    console.log(`Processing ${sources.length} Google News sources (max ${MAX_SOURCES_PER_RUN} per run)...`);
    
    let totalFetched = 0;
    let totalInserted = 0;
    let totalDuplicates = 0;
    let sourcesProcessed = 0;
    let sourceErrors = 0;

    // Process each source individually with health tracking
    for (const source of sources as GoogleNewsSource[]) {
      // Double-check backoff
      if (isInBackoff(source)) {
        console.log(`Skipping ${source.name} - in backoff until ${source.backoff_until}`);
        continue;
      }

      try {
        console.log(`Fetching ${source.name}...`);
        const items = await fetchRSSFeed(source.url, source.name);
        console.log(`Found ${items.length} items from ${source.name}`);
        
        totalFetched += items.length;

        if (items.length > 0) {
          const itemsByHash = new Map<string, NewsItem>();
          for (const item of items) {
            const dedupeKey = item.content_hash || item.url;
            if (!itemsByHash.has(dedupeKey)) {
              itemsByHash.set(dedupeKey, item);
            }
          }
          const dedupedItems = Array.from(itemsByHash.values());
          const intraBatchDuplicates = items.length - dedupedItems.length;

          const contentHashes = dedupedItems
            .map(item => item.content_hash)
            .filter(hash => hash.length > 0);
          let existingHashes = new Set<string>();

          if (contentHashes.length > 0) {
            const { data: existingRows, error: existingError } = await supabase
              .from('google_news_articles')
              .select('content_hash')
              .in('content_hash', contentHashes);

            if (existingError) {
              console.warn('Content hash lookup failed for ' + source.name + ':', existingError.message);
            } else {
              existingHashes = new Set(
                (existingRows || [])
                  .map(row => row.content_hash)
                  .filter(hash => hash && hash.length > 0)
              );
            }
          }

          const newItems = dedupedItems.filter(
            item => !item.content_hash || !existingHashes.has(item.content_hash)
          );
          const contentHashDuplicates = dedupedItems.length - newItems.length;

          if (newItems.length > 0) {
            // Insert with upsert on URL after content_hash dedupe
            const { data: insertedData, error: insertError } = await supabase
              .from('google_news_articles')
              .upsert(newItems.map(item => ({
                title: item.title,
                source_name: item.source_name,
                source_url: item.source_url,
                description: item.description,
                published_at: item.published_at,
                url: item.url,
                canonical_url: item.canonical_url,
                content_hash: item.content_hash,
              })), { 
                onConflict: 'url',
                ignoreDuplicates: true 
              })
              .select('id, content_hash, canonical_url, title, published_at');

            if (insertError) {
              console.error('Insert error for ' + source.name + ':', insertError.message);
              sourceErrors++;
              await updateSourceHealth(supabase, source.id, false, insertError.message);
            } else {
              const insertedCount = insertedData?.length || 0;
              const urlDuplicates = newItems.length - insertedCount;
              totalInserted += insertedCount;
              totalDuplicates += intraBatchDuplicates + contentHashDuplicates + urlDuplicates;
              
              // Register for cross-source dedupe
              for (const article of insertedData || []) {
                await registerForDedupe(
                  supabase,
                  article.content_hash,
                  article.canonical_url,
                  source.id,
                  article.id,
                  article.title,
                  article.published_at
                );
              }
              
              await updateSourceHealth(supabase, source.id, true, undefined, insertedCount);
            }
          } else {
            totalDuplicates += intraBatchDuplicates + contentHashDuplicates;
            await updateSourceHealth(supabase, source.id, true, undefined, 0);
          }
        } else {
          // No items but successful fetch
          await updateSourceHealth(supabase, source.id, true, undefined, 0);
        }
        sourcesProcessed++;

      } catch (error: any) {
        console.error(`Error processing source ${source.name}:`, error.message);
        sourceErrors++;
        await updateSourceHealth(supabase, source.id, false, error.message);
      }
    }
    
    // Log batch stats
    await supabase.from('processing_batches').insert({
      batch_type: 'google_news',
      items_count: totalFetched,
      unique_items: totalInserted,
      duplicates_removed: totalDuplicates,
      processing_time_ms: Date.now() - startTime,
      completed_at: new Date().toISOString(),
      status: sourceErrors > 0 ? 'completed_with_errors' : 'completed'
    });

    const result = {
      success: true,
      sources_processed: sourcesProcessed,
      source_errors: sourceErrors,
      fetched: totalFetched,
      inserted: totalInserted,
      duplicates: totalDuplicates,
      duration_ms: Date.now() - startTime
    };
    
    console.log('Google News fetch complete:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error in fetch-google-news:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    await logJobFailure(supabase, 'fetch-google-news', message);
    
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});


