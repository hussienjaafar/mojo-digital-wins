import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// HIGH-VALUE POLITICAL KEYWORDS - Focus on actionable political content
// Removed generic terms that generate noise
const POLITICAL_KEYWORDS = [
  // US Politics - Specific figures and institutions
  'congress', 'senate', 'biden', 'trump', 'pelosi', 'mcconnell', 'schumer',
  'executive order', 'white house', 'supreme court', 'scotus',
  
  // Policy - Specific and actionable
  'immigration ban', 'border wall', 'climate bill', 'student loan forgiveness',
  'abortion ban', 'roe v wade', 'gun control', 'gun reform', 'healthcare bill',
  
  // Civil Rights - Specific issues
  'voting rights', 'voter suppression', 'gerrymandering', 'hate crime',
  'discrimination lawsuit', 'civil rights violation',
  
  // Communities - Only when in political context
  'muslim ban', 'islamophobia', 'antisemitism', 'anti-asian', 'black lives matter',
  'lgbtq rights', 'trans rights', 'transgender ban',
  
  // International - High-impact
  'gaza', 'ceasefire', 'ukraine war', 'russia sanctions', 'china tariffs',
  'israel palestine'
];

// SPAM/LOW-VALUE PATTERNS - Filter out noise
const SPAM_PATTERNS = [
  /follow\s*me/i,
  /check\s*my\s*profile/i,
  /link\s*in\s*bio/i,
  /dm\s*me/i,
  /\$\d+/,  // Price mentions
  /crypto|bitcoin|eth|nft/i,
  /giveaway|airdrop/i,
  /onlyfans|nsfw/i,
  /🔥.*🔥.*🔥/,  // Emoji spam
  /!!!+/,  // Excessive punctuation
  /follow.*follow.*follow/i,
];

// Lowercase keywords for fast matching
const POLITICAL_KEYWORDS_LOWER = POLITICAL_KEYWORDS.map(k => k.toLowerCase());

// Pre-compiled regex patterns for word boundary matching
const KEYWORD_PATTERNS = POLITICAL_KEYWORDS_LOWER.map(keyword => 
  new RegExp(`\\b${keyword.replace(/\s+/g, '\\s+')}\\b`, 'i')
);

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

// Check if post is spam/low-value
function isSpamOrLowValue(text: string): boolean {
  // Check spam patterns
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  
  // Too many hashtags = promotional
  const hashtagCount = (text.match(/#\w+/g) || []).length;
  if (hashtagCount > 5) return true;
  
  // Too many mentions = engagement farming
  const mentionCount = (text.match(/@[\w.]+/g) || []).length;
  if (mentionCount > 5) return true;
  
  // All caps = low quality
  const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
  if (capsRatio > 0.5 && text.length > 50) return true;
  
  return false;
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

// STRICT keyword matching - requires word boundaries
function hasHighValueKeyword(text: string): boolean {
  const lowerText = text.toLowerCase();
  
  // Stage 1: Quick substring check
  let hasSubstring = false;
  for (const keyword of POLITICAL_KEYWORDS_LOWER) {
    if (lowerText.includes(keyword)) {
      hasSubstring = true;
      break;
    }
  }
  
  if (!hasSubstring) return false;
  
  // Stage 2: Word boundary check (more precise)
  for (const pattern of KEYWORD_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  
  return false;
}

// Calculate relevance score with STRICTER thresholds
function calculateRelevance(text: string): number {
  const lowerText = text.toLowerCase();
  let score = 0;
  let matchCount = 0;

  for (const keyword of POLITICAL_KEYWORDS_LOWER) {
    if (lowerText.includes(keyword)) {
      score += 0.15; // Higher weight per keyword
      matchCount++;
      
      if (matchCount >= 2) {
        // Multiple keyword matches = high relevance
        return Math.min(score + 0.2, 1.0);
      }
    }
  }

  return score;
}

// Cursor-based stream processor with STRICT filtering
async function processBlueskyStreamWithCursor(durationMs: number = 15000, maxPostsProcessed: number = 30000) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔵 Starting STRICT cursor-based JetStream collection...');

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
  let spamFiltered = 0;
  let lowRelevanceFiltered = 0;
  let shouldStop = false;
  const batchSize = 50;
  const collectedPosts: any[] = [];

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
        console.log('✅ Connected to JetStream (STRICT mode)');
      };

      ws.onmessage = async (event) => {
        if (shouldStop) return;
        
        try {
          const data: JetStreamEvent = JSON.parse(event.data);

          if (data.time_us) {
            latestCursor = data.time_us;
          }

          if (data.kind !== 'commit' || !data.commit?.record?.text) {
            return;
          }

          postCount++;
          
          if (postCount >= maxPostsProcessed) {
            console.log(`⚠️ Safety limit reached: ${maxPostsProcessed} posts`);
            shouldStop = true;
            ws.close();
            return;
          }

          const record = data.commit.record;
          const text = record.text;
          
          // FILTER 1: Language - English only
          const langs = record.langs || [];
          if (langs.length > 0 && !langs.includes('en')) {
            languageFiltered++;
            return;
          }
          
          // FILTER 2: Length bounds - STRICTER (50-400 chars)
          if (text.length < 50 || text.length > 400) {
            lengthFiltered++;
            return;
          }

          // FILTER 3: Spam detection - NEW
          if (isSpamOrLowValue(text)) {
            spamFiltered++;
            return;
          }

          // FILTER 4: Keyword matching - STRICTER keywords
          if (!hasHighValueKeyword(text)) {
            return;
          }
          
          keywordMatchCount++;

          // FILTER 5: Relevance score - HIGHER threshold (0.15 instead of 0.1)
          const relevanceScore = calculateRelevance(text);
          if (relevanceScore < 0.15) {
            lowRelevanceFiltered++;
            return;
          }

          relevantCount++;

          const hashtags = extractHashtags(text);
          const mentions = extractMentions(text);
          const urls = extractUrls(text);

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
            ai_relevance_score: relevanceScore,
          });

          // Insert batch when full
          if (collectedPosts.length >= batchSize) {
            const batch = [...collectedPosts];
            collectedPosts.length = 0;

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
                `✅ Batch: ${batch.length} | ${relevantCount}/${postCount} (${efficiency}%) | Spam:-${spamFiltered} Lang:-${languageFiltered} Len:-${lengthFiltered}`
              );
            }
          }

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
          const { error: insertError } = await supabase
            .from('bluesky_posts')
            .upsert(collectedPosts, {
              onConflict: 'post_uri',
              ignoreDuplicates: true
            });

          if (insertError) {
            console.error('❌ Error inserting final batch:', insertError);
          } else {
            console.log(`✅ Final batch: ${collectedPosts.length} posts`);
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
        }

        const efficiency = ((relevantCount / postCount) * 100).toFixed(3);
        console.log(
          `✅ STRICT Complete: ${relevantCount} saved | ${postCount} processed (${efficiency}%) | Filtered: spam=${spamFiltered} lang=${languageFiltered} len=${lengthFiltered} lowRel=${lowRelevanceFiltered}`
        );

        resolve({
          relevantPosts: relevantCount,
          totalProcessed: postCount,
          cursor: latestCursor,
          durationMs: Date.now() - startTime,
          filters: {
            spam: spamFiltered,
            language: languageFiltered,
            length: lengthFiltered,
            lowRelevance: lowRelevanceFiltered,
          }
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

  // ⚠️ TEMPORARILY DISABLED - Database recovery in progress
  // Remove this block to re-enable data ingestion
  console.log('⏸️ Bluesky stream DISABLED - Database recovery mode');
  return new Response(JSON.stringify({
    status: 'disabled',
    message: 'Bluesky stream temporarily disabled for database recovery',
    timestamp: new Date().toISOString()
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

  // Original code below - uncomment to re-enable
  /*
  try {
    console.log('🚀 Starting STRICT collection session...');
    
    const { durationMs = 15000, maxPostsProcessed = 30000 } = await req.json().catch(() => ({}));
    
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
  */
});
