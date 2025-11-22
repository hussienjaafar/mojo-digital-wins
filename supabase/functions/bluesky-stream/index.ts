import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tracked keywords for relevance filtering
const TRACKED_KEYWORDS = [
  'cair', 'mpac', 'adc', 'muslim american', 'arab american',
  'islamophobia', 'anti-muslim', 'civil liberties', 'religious freedom',
  'surveillance', 'profiling', 'discrimination', 'hate crime',
  'palestine', 'gaza', 'west bank', 'middle east'
];

// Lowercase keywords for fast matching (case-insensitive O(1) lookup)
const TRACKED_KEYWORDS_LOWER = TRACKED_KEYWORDS.map(k => k.toLowerCase());

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

// **FAST KEYWORD PRE-CHECK**: Returns true if ANY tracked keyword appears in text
// This runs BEFORE calculateRelevance to filter out 99% of irrelevant posts immediately
// Optimized: Check word boundaries to avoid false positives (e.g., "caring" vs "cair")
function hasAnyKeyword(text: string): boolean {
  const lowerText = text.toLowerCase();
  
  // Quick reject: if text is too short, likely not relevant
  if (lowerText.length < 10) return false;
  
  // Use word boundary matching for better precision
  for (const keyword of TRACKED_KEYWORDS_LOWER) {
    // Create regex with word boundaries for multi-word phrases
    const regex = new RegExp(`\\b${keyword.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (regex.test(text)) {
      return true;
    }
  }
  
  return false;
}

// Calculate relevance score (0-1) based on tracked keywords
function calculateRelevance(text: string): number {
  const lowerText = text.toLowerCase();
  let score = 0;

  for (const keyword of TRACKED_KEYWORDS_LOWER) {
    if (lowerText.includes(keyword)) {
      score += 0.15; // Each keyword match adds to relevance
      
      // Early exit once we reach threshold (saves CPU cycles)
      if (score >= 0.1) {
        return Math.min(score, 1.0);
      }
    }
  }

  return score;
}

// Cursor-based stream processor with timeout
// Optimized to 15s to give headroom under the CPU limit
async function processBlueskyStreamWithCursor(durationMs: number = 15000) {
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
  const batchSize = 20; // Increased batch size for fewer DB calls
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

          const record = data.commit.record;
          const text = record.text;

          // **CRITICAL OPTIMIZATION**: Fast keyword pre-check before full relevance calculation
          // This prevents processing 50k+ irrelevant posts per run
          if (!hasAnyKeyword(text)) {
            return; // Skip posts with zero keyword matches immediately
          }
          
          keywordMatchCount++;

          // Calculate detailed relevance score only for keyword-matching posts
          const relevanceScore = calculateRelevance(text);

          // Store posts with relevance > 0.05
          if (relevanceScore < 0.05) {
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
              console.log(
                `✅ Batch: ${batch.length} posts | Relevant: ${relevantCount}/${keywordMatchCount} matches/${postCount} total | Cursor: ${latestCursor}`
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

        console.log(
          `✅ Collection complete: ${relevantCount} saved | ${keywordMatchCount} keyword matches | ${postCount} total processed | Efficiency: ${((relevantCount/postCount)*100).toFixed(2)}%`
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
    
    const { durationMs = 30000 } = await req.json().catch(() => ({}));
    
    const result = await processBlueskyStreamWithCursor(durationMs);

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
