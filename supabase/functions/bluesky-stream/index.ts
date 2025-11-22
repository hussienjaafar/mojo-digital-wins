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

// Calculate relevance score (0-1) based on tracked keywords
function calculateRelevance(text: string): number {
  const lowerText = text.toLowerCase();
  let score = 0;

  for (const keyword of TRACKED_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      score += 0.15; // Each keyword match adds to relevance
    }
  }

  return Math.min(score, 1.0); // Cap at 1.0
}

// Cursor-based stream processor with timeout
async function processBlueskyStreamWithCursor(durationMs: number = 45000) {
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

  const lastCursor = cursorData.last_cursor;
  console.log(`📍 Resuming from cursor: ${lastCursor}`);

  // Build WebSocket URL with cursor (rewind 5 seconds for safety)
  const cursorWithBuffer = lastCursor - (5 * 1000000); // Subtract 5 seconds in microseconds
  const wsUrl = `wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post&cursor=${cursorWithBuffer}`;

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);

    let postCount = 0;
    let relevantCount = 0;
    let postsBuffer: any[] = [];
    let latestCursor = lastCursor;
    const BATCH_SIZE = 10;

    // Set timeout to stop collection before edge function times out
    const timeout = setTimeout(async () => {
      console.log(`⏱️ Reached ${durationMs}ms limit, stopping collection...`);

      // Flush remaining posts
      if (postsBuffer.length > 0) {
        await supabase.from('bluesky_posts').insert(postsBuffer);
        console.log(`✅ Flushed final batch of ${postsBuffer.length} posts`);
      }

      // Update cursor position
      await supabase
        .from('bluesky_stream_cursor')
        .update({
          last_cursor: latestCursor,
          last_updated_at: new Date().toISOString(),
          posts_collected: relevantCount
        })
        .eq('id', 1);

      ws.close();

      resolve({
        success: true,
        postsCollected: relevantCount,
        totalProcessed: postCount,
        lastCursor: latestCursor,
        durationMs
      });
    }, durationMs);

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

        // Only process commit events for posts
        if (data.kind !== 'commit' || !data.commit?.record?.text) {
          return;
        }

        postCount++;

        const record = data.commit.record;
        const text = record.text;

        // Calculate relevance
        const relevanceScore = calculateRelevance(text);

        // Only store posts with relevance >0.1
        if (relevanceScore < 0.1) {
          return;
        }

        relevantCount++;

        // Extract structured data
        const hashtags = extractHashtags(text);
        const mentions = extractMentions(text);
        const urls = extractUrls(text);

        // Build post URI
        const postUri = `at://${data.did}/${data.commit.collection}/${data.commit.rkey}`;

        // Prepare post data
        const postData = {
          post_uri: postUri,
          post_cid: data.commit.cid,
          author_did: data.did,
          author_handle: data.did, // Will be resolved later if needed
          text,
          hashtags,
          mentions,
          urls,
          reply_to: record.reply?.parent?.uri || null,
          langs: record.langs || [],
          created_at: record.createdAt,
          ai_relevance_score: relevanceScore,
          ai_processed: false
        };

        postsBuffer.push(postData);

        // Insert in batches
        if (postsBuffer.length >= BATCH_SIZE) {
          const { error } = await supabase
            .from('bluesky_posts')
            .insert(postsBuffer);

          if (error && !error.message?.includes('duplicate key')) {
            console.error('❌ Error inserting batch:', error.message);
          } else {
            console.log(`✅ Inserted batch: ${postsBuffer.length} posts (${relevantCount}/${postCount} relevant, cursor: ${latestCursor})`);
          }

          postsBuffer = [];
        }

      } catch (err: any) {
        console.error('❌ Error processing message:', err.message);
      }
    };

    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      clearTimeout(timeout);
      reject(error);
    };

    ws.onclose = () => {
      console.log('🔴 WebSocket closed');
      clearTimeout(timeout);
    };
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const durationMs = body.durationMs || 45000; // Default 45 seconds

    console.log(`🚀 Starting ${durationMs}ms collection session...`);

    const result = await processBlueskyStreamWithCursor(durationMs);

    console.log(`✅ Collection complete: ${result.postsCollected} posts collected`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in bluesky-stream:', error);

    // Store error in cursor table
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase
      .from('bluesky_stream_cursor')
      .update({ last_error: error?.message || 'Unknown error' })
      .eq('id', 1);

    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
