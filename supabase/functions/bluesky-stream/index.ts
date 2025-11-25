import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// BROAD POLITICAL KEYWORDS - Collect comprehensive political discourse
// Categories: Politics, Policy, Rights, Justice, Community, Identity
const POLITICAL_KEYWORDS = [
  // US Politics
  'congress', 'senate', 'house', 'biden', 'trump', 'democrats', 'republicans',
  'election', 'vote', 'campaign', 'legislation', 'bill', 'executive order',
  'white house', 'supreme court', 'federal', 'state legislature',
  
  // Policy Areas
  'immigration', 'healthcare', 'climate', 'education', 'economy', 'inflation',
  'housing', 'minimum wage', 'social security', 'medicare', 'medicaid',
  'student debt', 'tax', 'regulation', 'foreign policy',
  
  // Civil Rights & Justice
  'civil rights', 'civil liberties', 'discrimination', 'equality', 'justice',
  'hate crime', 'police', 'criminal justice', 'prison', 'surveillance',
  'voting rights', 'gerrymandering', 'protest', 'first amendment',
  
  // Communities & Identity
  'muslim', 'arab', 'jewish', 'christian', 'lgbtq', 'transgender', 'gay rights',
  'black lives matter', 'latino', 'hispanic', 'asian american', 'indigenous',
  'native american', 'disability', 'women rights', 'abortion', 'reproductive',
  
  // International (affecting US policy)
  'israel', 'palestine', 'gaza', 'middle east', 'ukraine', 'russia', 'china',
  'iran', 'iraq', 'afghanistan', 'syria', 'yemen'
];

// Lowercase keywords for fast matching (case-insensitive O(1) lookup)
const POLITICAL_KEYWORDS_LOWER = POLITICAL_KEYWORDS.map(k => k.toLowerCase());

interface JetStreamEvent {
  did: string;
  time_us: number;
  kind: string;
  commit?: {
    rev: string;
    operation: string;
    collection: string;
    rkey: string;
    record: {
      $type: string;
      text: string;
      createdAt: string;
      langs?: string[];
      reply?: { parent: { uri: string } };
      embed?: any;
    };
    cid: string;
  };
}

// Extract hashtags from text
function extractHashtags(text: string): string[] {
  const hashtagRegex = /#(\w+)/g;
  const matches = text.matchAll(hashtagRegex);
  return Array.from(matches, m => m[1].toLowerCase());
}

// Extract mentions from text
function extractMentions(text: string): string[] {
  const mentionRegex = /@([a-zA-Z0-9._-]+)/g;
  const matches = text.matchAll(mentionRegex);
  return Array.from(matches, m => m[1]);
}

// Extract URLs from text
function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = text.matchAll(urlRegex);
  return Array.from(matches, m => m[1]);
}

// Pre-compiled regex patterns for performance (created once, not per-post)
const KEYWORD_PATTERNS = POLITICAL_KEYWORDS_LOWER.map(keyword => 
  new RegExp(`\\b${keyword.replace(/\s+/g, '\\s+')}\\b`, 'i')
);

// **ULTRA-FAST KEYWORD PRE-CHECK**: Multi-stage filtering
// Stage 1: Quick string includes (very fast)
// Stage 2: Regex with word boundaries (precise)
function hasAnyKeyword(text: string): boolean {
  // Quick length bounds check (most posts are 20-500 chars if relevant)
  if (text.length < 20 || text.length > 500) return false;
  
  const lowerText = text.toLowerCase();
  
  // Stage 1: Fast substring check (no regex overhead)
  // This filters out ~90% of posts instantly (broader than before)
  let hasSubstring = false;
  for (const keyword of POLITICAL_KEYWORDS_LOWER) {
    if (lowerText.includes(keyword)) {
      hasSubstring = true;
      break;
    }
  }
  
  if (!hasSubstring) return false;
  
  // Stage 2: Precise word-boundary matching on remaining ~5%
  // Use pre-compiled patterns to avoid regex creation overhead
  for (const pattern of KEYWORD_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  
  return false;
}

// Calculate relevance score (0-1) based on political keywords
function calculateRelevance(text: string): number {
  const lowerText = text.toLowerCase();
  let score = 0;

  for (const keyword of POLITICAL_KEYWORDS_LOWER) {
    if (lowerText.includes(keyword)) {
      score += 0.1; // Each keyword match adds to relevance
      
      // Early exit once we reach threshold (saves CPU cycles)
      if (score >= 0.1) {
        return Math.min(score, 1.0);
      }
    }
  }

  return score;
}

// Cursor-based stream processor with timeout and safety limits
// Optimized to 15s duration with 50k post processing limit
async function processBlueskyStreamWithCursor(durationMs: number = 15000, maxPostsProcessed: number = 50000) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔵 Starting cursor-based JetStream collection...');

  // Get last cursor position
  const { data: cursorData, error: cursorError } = await supabase
    .from('bluesky_stream_cursor')
    .select('last_cursor')
    .eq('id', 1)
    .single();

  if (cursorError) {
    console.error('❌ Error reading cursor:', cursorError);
    throw cursorError;
  }

  const startCursor = cursorData?.last_cursor || 0;
  console.log(`📍 Resuming from cursor: ${startCursor}`);

  let latestCursor = startCursor;
  let postCount = 0;
  let relevantCount = 0;
  let keywordMatchCount = 0;
  let languageFiltered = 0;
  let lengthFiltered = 0;
  let shouldStop = false; // Flag to prevent processing after limit
  const batchSize = 50; // Larger batches reduce DB roundtrips
  const collectedPosts: any[] = [];

  // Timeout handler
  const startTime = Date.now();
  const timeout = setTimeout(() => {
    console.log(`⏱️  Collection timeout reached (${durationMs}ms)`);
  }, durationMs);

  return new Promise((resolve, reject) => {
    try {
      const ws = new WebSocket(
        `wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post&cursor=${startCursor}`
      );

      ws.onopen = () => {
        console.log('✅ Connected to JetStream');
      };

      ws.onmessage = async (event) => {
        // Skip processing if we've already hit the limit
        if (shouldStop) return;
        
        try {
          const data: JetStreamEvent = JSON.parse(event.data);

          // Update cursor
          if (data.time_us) {
            latestCursor = data.time_us;
          }

          // Only process commit events for posts with text
          if (data.kind !== 'commit' || !data.commit?.record?.text) {
            return;
          }

          postCount++;
          
          // Safety valve: stop processing if we've hit the limit
          if (postCount >= maxPostsProcessed) {
            console.log(`⚠️ Safety limit reached: ${maxPostsProcessed} posts processed`);
            shouldStop = true;
            ws.close();
            return;
          }

          const record = data.commit.record;
          const text = record.text;
          
          // **OPTIMIZATION 1: Language filter** - Only process English posts
          // This filters out ~50% of firehose immediately
          const langs = record.langs || [];
          if (langs.length > 0 && !langs.includes('en')) {
            languageFiltered++;
            return;
          }
          
          // **OPTIMIZATION 2: Length bounds** - Filter very short/long posts early
          // Checked again in hasAnyKeyword but doing it here avoids string ops
          if (text.length < 20 || text.length > 500) {
            lengthFiltered++;
            return;
          }

          // **OPTIMIZATION 3: Ultra-fast keyword pre-check**
          // Two-stage filter: simple includes() then word-boundary regex
          if (!hasAnyKeyword(text)) {
            return;
          }
          
          keywordMatchCount++;

          // Calculate detailed relevance score only for keyword-matching posts
          const relevanceScore = calculateRelevance(text);

          // Store posts with relevance > 0.1 (broader threshold)
          if (relevanceScore < 0.1) {
            return;
          }

          relevantCount++;

          // Extract additional data
          const hashtags = extractHashtags(text);
          const mentions = extractMentions(text);
          const urls = extractUrls(text);

          // Add to batch
          collectedPosts.push({
            author_did: data.did,
            post_uri: `at://${data.did}/${data.commit.collection}/${data.commit.rkey}`,
            post_cid: data.commit.cid,
            text: text,
            created_at: record.createdAt,
            indexed_at: new Date().toISOString(),
            langs: record.langs || [],
            hashtags: hashtags.length > 0 ? hashtags : null,
            mentions: mentions.length > 0 ? mentions : null,
            urls: urls.length > 0 ? urls : null,
            reply_to: record.reply?.parent?.uri || null,
            quote_of: null,
            embed_type: record.embed?.$type || null,
            ai_relevance_score: relevanceScore, // CRITICAL: Save relevance score for analyzer
          });

          // Insert batch when full
          if (collectedPosts.length >= batchSize) {
            const batch = [...collectedPosts];
            collectedPosts.length = 0; // Clear array

            // Use upsert to handle duplicates gracefully
            const { error: insertError } = await supabase
              .from('bluesky_posts')
              .upsert(batch, {
                onConflict: 'post_uri',
                ignoreDuplicates: true
              });

            if (insertError) {
              console.error('❌ Error inserting batch:', insertError);
            } else {
              const efficiency = ((relevantCount / postCount) * 100).toFixed(2);
              console.log(
                `✅ Batch: ${batch.length} | ${relevantCount}/${keywordMatchCount}/${postCount} (${efficiency}%) | Lang: -${languageFiltered} | Len: -${lengthFiltered}`
              );
            }
          }

          // Check timeout
          if (Date.now() - startTime >= durationMs) {
            ws.close();
          }
        } catch (error) {
          console.error('Error processing message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        clearTimeout(timeout);
        reject(error);
      };

      ws.onclose = async () => {
        clearTimeout(timeout);

        // Insert remaining posts
        if (collectedPosts.length > 0) {
          // Use upsert to handle duplicates gracefully
          const { error: insertError } = await supabase
            .from('bluesky_posts')
            .upsert(collectedPosts, {
              onConflict: 'post_uri',
              ignoreDuplicates: true
            });

          if (insertError) {
            console.error('❌ Error inserting final batch:', insertError);
          } else {
            console.log(
              `✅ Final batch: ${collectedPosts.length} posts | Total relevant: ${relevantCount}/${keywordMatchCount} matches/${postCount} total`
            );
          }
        }

        // Update cursor
        const { error: updateError } = await supabase
          .from('bluesky_stream_cursor')
          .update({
            last_cursor: latestCursor,
            last_updated_at: new Date().toISOString(),
            posts_collected: relevantCount,
          })
          .eq('id', 1);

        if (updateError) {
          console.error('❌ Error updating cursor:', updateError);
          await supabase
            .from('bluesky_stream_cursor')
            .update({
              last_error: updateError.message,
            })
            .eq('id', 1);
        }

        const efficiency = ((relevantCount / postCount) * 100).toFixed(2);
        const filterReduction = ((languageFiltered + lengthFiltered) / postCount * 100).toFixed(1);
        console.log(
          `✅ Complete: ${relevantCount} saved | ${keywordMatchCount} matches | ${postCount} processed (${efficiency}% efficiency) | Filtered: ${filterReduction}% (lang:${languageFiltered}, len:${lengthFiltered})`
        );

        resolve({
          relevantPosts: relevantCount,
          totalProcessed: postCount,
          cursor: latestCursor,
          durationMs: Date.now() - startTime,
        });
      };
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Starting collection session...');
    
    const { durationMs = 15000, maxPostsProcessed = 50000 } = await req.json().catch(() => ({}));
    
    const result = await processBlueskyStreamWithCursor(durationMs, maxPostsProcessed);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ Error in bluesky-stream function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
