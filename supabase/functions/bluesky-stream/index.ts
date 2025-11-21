import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { inflate } from "https://deno.land/x/denoflate@1.2.1/mod.ts";

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

interface BlueSkyPost {
  uri: string;
  cid: string;
  author: {
    did: string;
    handle: string;
  };
  record: {
    text: string;
    createdAt: string;
    langs?: string[];
    reply?: {
      parent: { uri: string };
    };
    embed?: any;
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

// Main stream processor
async function processBlueskyStream() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔵 Connecting to Bluesky JetStream...');

  // Connect to JetStream WebSocket
  const ws = new WebSocket(
    'wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post'
  );

  let postCount = 0;
  let relevantCount = 0;
  let batchSize = 0;
  let postsBuffer: any[] = [];
  const BATCH_INSERT_SIZE = 10; // Insert in batches of 10

  ws.onopen = () => {
    console.log('✅ Connected to JetStream');
  };

  ws.onmessage = async (event) => {
    try {
      let data;
      
      // Handle both text and binary (compressed) data
      if (typeof event.data === 'string') {
        data = JSON.parse(event.data);
      } else if (event.data instanceof Blob) {
        // Bluesky sends zlib-compressed JSON
        const arrayBuffer = await event.data.arrayBuffer();
        const compressed = new Uint8Array(arrayBuffer);
        const decompressed = inflate(compressed);
        const text = new TextDecoder().decode(decompressed);
        data = JSON.parse(text);
      } else {
        console.error('Unknown data type:', typeof event.data);
        return;
      }

      // Only process commit events for posts
      if (data.kind !== 'commit' || !data.commit?.record) {
        return;
      }

      const post = data.commit as BlueSkyPost;
      const record = post.record;

      if (!record.text) return;

      postCount++;

      // Calculate relevance
      const relevanceScore = calculateRelevance(record.text);

      // Only store posts with some relevance (>0.1) to save space
      if (relevanceScore < 0.1) {
        return;
      }

      relevantCount++;

      // Extract structured data
      const hashtags = extractHashtags(record.text);
      const mentions = extractMentions(record.text);
      const urls = extractUrls(record.text);

      // Prepare post data
      const postData = {
        post_uri: post.uri,
        post_cid: post.cid,
        author_did: post.author.did,
        author_handle: post.author.handle,
        text: record.text,
        hashtags,
        mentions,
        urls,
        reply_to: record.reply?.parent?.uri || null,
        langs: record.langs || [],
        created_at: record.createdAt,
        ai_relevance_score: relevanceScore,
        ai_processed: false
      };

      // Add to buffer
      postsBuffer.push(postData);
      batchSize++;

      // Insert in batches
      if (batchSize >= BATCH_INSERT_SIZE) {
        const { error } = await supabase
          .from('bluesky_posts')
          .insert(postsBuffer);

        if (error && !error.message?.includes('duplicate key')) {
          console.error('❌ Error inserting posts:', error);
        } else {
          console.log(`✅ Inserted batch of ${batchSize} posts (${relevantCount}/${postCount} relevant)`);
        }

        postsBuffer = [];
        batchSize = 0;
      }

      // Log progress every 100 posts
      if (postCount % 100 === 0) {
        console.log(`📊 Processed ${postCount} posts, ${relevantCount} relevant (${((relevantCount/postCount)*100).toFixed(1)}%)`);
      }

    } catch (err: any) {
      console.error('❌ Error processing message:', err.message);
    }
  };

  ws.onerror = (error) => {
    console.error('❌ WebSocket error:', error);
  };

  ws.onclose = () => {
    console.log('🔴 JetStream connection closed, reconnecting in 5 seconds...');
    setTimeout(() => processBlueskyStream(), 5000);
  };

  // Flush buffer periodically (every 30 seconds)
  setInterval(async () => {
    if (postsBuffer.length > 0) {
      const { error } = await supabase
        .from('bluesky_posts')
        .insert(postsBuffer);

      if (error && !error.message?.includes('duplicate key')) {
        console.error('❌ Error flushing buffer:', error);
      } else {
        console.log(`✅ Flushed ${postsBuffer.length} posts from buffer`);
      }

      postsBuffer = [];
      batchSize = 0;
    }
  }, 30000);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action } = await req.json().catch(() => ({ action: 'start' }));

    if (action === 'start') {
      // Start the stream processor (runs indefinitely)
      processBlueskyStream();

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Bluesky stream processor started'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in bluesky-stream:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
