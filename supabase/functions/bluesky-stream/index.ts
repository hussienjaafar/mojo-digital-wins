import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ==================== SAFEGUARDS & LIMITS ====================
// These prevent database overload
const MAX_POSTS_IN_DB = 50000;          // Auto-pause if DB has more than this
const MAX_POSTS_PER_SESSION = 500;      // Max posts to collect per invocation
const MAX_DURATION_MS = 10000;          // Max 10 seconds per session
const MIN_RELEVANCE_SCORE = 0.20;       // Higher threshold = fewer posts
const POST_AGE_LIMIT_DAYS = 7;          // Posts older than this get cleaned

// ==================== POLITICAL KEYWORDS ====================
// HIGH-VALUE POLITICAL KEYWORDS - Focus on actionable political content
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

// ==================== DATABASE HEALTH CHECK ====================
async function checkDatabaseHealth(supabase: any): Promise<{ healthy: boolean; postCount: number; message: string }> {
  try {
    // Simple count query - no date filter for reliability
    const { count, error } = await supabase
      .from('bluesky_posts')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      // If table doesn't exist or other error, assume empty and healthy
      console.warn('⚠️ Database count query issue:', error.message);
      return { healthy: true, postCount: 0, message: `Database accessible, count unavailable` };
    }
    
    const postCount = count || 0;
    console.log(`📊 Current post count: ${postCount}`);
    
    if (postCount >= MAX_POSTS_IN_DB) {
      return { 
        healthy: false, 
        postCount, 
        message: `Database at capacity: ${postCount}/${MAX_POSTS_IN_DB} posts. Cleanup required.` 
      };
    }
    
    return { 
      healthy: true, 
      postCount, 
      message: `Database healthy: ${postCount}/${MAX_POSTS_IN_DB} posts` 
    };
  } catch (error) {
    // On any error, be optimistic and allow ingestion with caution
    console.warn('⚠️ Health check error, proceeding with caution:', error);
    return { healthy: true, postCount: 0, message: `Health check unavailable, proceeding cautiously` };
  }
}

// Check if post is spam/low-value
function isSpamOrLowValue(text: string): boolean {
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(text)) return true;
  }
  
  const hashtagCount = (text.match(/#\w+/g) || []).length;
  if (hashtagCount > 5) return true;
  
  const mentionCount = (text.match(/@[\w.]+/g) || []).length;
  if (mentionCount > 5) return true;
  
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
  
  let hasSubstring = false;
  for (const keyword of POLITICAL_KEYWORDS_LOWER) {
    if (lowerText.includes(keyword)) {
      hasSubstring = true;
      break;
    }
  }
  
  if (!hasSubstring) return false;
  
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
      score += 0.15;
      matchCount++;
      
      if (matchCount >= 2) {
        return Math.min(score + 0.2, 1.0);
      }
    }
  }

  return score;
}

// Cursor-based stream processor with STRICT filtering and SAFEGUARDS
async function processBlueskyStreamWithCursor(
  supabase: any,
  durationMs: number = MAX_DURATION_MS, 
  maxPostsProcessed: number = MAX_POSTS_PER_SESSION
) {
  console.log('🔵 Starting SAFEGUARDED cursor-based JetStream collection...');
  console.log(`   Limits: ${maxPostsProcessed} posts max, ${durationMs}ms max, ${MIN_RELEVANCE_SCORE} min relevance`);

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
  const batchSize = 25; // Smaller batches for stability
  const collectedPosts: any[] = [];

  const startTime = Date.now();
  const timeout = setTimeout(() => {
    console.log(`⏱️  Collection timeout reached (${durationMs}ms)`);
    shouldStop = true;
  }, durationMs);

  return new Promise((resolve, reject) => {
    try {
      const ws = new WebSocket(
        `wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post&cursor=${startCursor}`
      );

      ws.onopen = () => {
        console.log('✅ Connected to JetStream (SAFEGUARDED mode)');
      };

      ws.onmessage = async (event) => {
        if (shouldStop) {
          ws.close();
          return;
        }
        
        try {
          const data: JetStreamEvent = JSON.parse(event.data);

          if (data.time_us) {
            latestCursor = data.time_us;
          }

          if (data.kind !== 'commit' || !data.commit?.record?.text) {
            return;
          }

          postCount++;
          
          // SAFEGUARD: Stop if we've collected enough relevant posts
          if (relevantCount >= maxPostsProcessed) {
            console.log(`🛑 Collected ${maxPostsProcessed} relevant posts - stopping`);
            shouldStop = true;
            ws.close();
            return;
          }
          
          // SAFEGUARD: Hard limit on total processed
          if (postCount >= maxPostsProcessed * 100) {
            console.log(`⚠️ Processed ${postCount} posts without hitting relevant limit - stopping`);
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
          
          // FILTER 2: Length bounds - STRICTER (60-350 chars)
          if (text.length < 60 || text.length > 350) {
            lengthFiltered++;
            return;
          }

          // FILTER 3: Spam detection
          if (isSpamOrLowValue(text)) {
            spamFiltered++;
            return;
          }

          // FILTER 4: Keyword matching
          if (!hasHighValueKeyword(text)) {
            return;
          }
          
          keywordMatchCount++;

          // FILTER 5: Relevance score - HIGH threshold
          const relevanceScore = calculateRelevance(text);
          if (relevanceScore < MIN_RELEVANCE_SCORE) {
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
              // If insert fails, stop to prevent issues
              shouldStop = true;
              ws.close();
            } else {
              console.log(`✅ Batch: ${batch.length} posts | Total: ${relevantCount}/${maxPostsProcessed}`);
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

        const efficiency = postCount > 0 ? ((relevantCount / postCount) * 100).toFixed(3) : '0';
        console.log(
          `✅ SAFEGUARDED Complete: ${relevantCount} saved | ${postCount} processed (${efficiency}%)`
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // ==================== HEALTH CHECK BEFORE INGESTION ====================
    console.log('🏥 Checking database health before ingestion...');
    const health = await checkDatabaseHealth(supabase);
    console.log(`   ${health.message}`);
    
    if (!health.healthy) {
      console.log('⏸️ Database not healthy - skipping ingestion');
      return new Response(JSON.stringify({
        status: 'paused',
        reason: health.message,
        postCount: health.postCount,
        maxAllowed: MAX_POSTS_IN_DB,
        recommendation: 'Run cleanup-bluesky-posts to free space',
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ==================== PROCEED WITH INGESTION ====================
    console.log('🚀 Starting SAFEGUARDED collection session...');
    
    // Use conservative defaults, allow override only within limits
    const body = await req.json().catch(() => ({}));
    const durationMs = Math.min(body.durationMs || MAX_DURATION_MS, MAX_DURATION_MS);
    const maxPosts = Math.min(body.maxPostsProcessed || MAX_POSTS_PER_SESSION, MAX_POSTS_PER_SESSION);
    
    const result = await processBlueskyStreamWithCursor(supabase, durationMs, maxPosts) as {
      relevantPosts: number;
      totalProcessed: number;
      cursor: number;
      durationMs: number;
      filters: Record<string, number>;
    };

    return new Response(JSON.stringify({
      relevantPosts: result.relevantPosts,
      totalProcessed: result.totalProcessed,
      cursor: result.cursor,
      durationMs: result.durationMs,
      filters: result.filters,
      safeguards: {
        maxPostsInDb: MAX_POSTS_IN_DB,
        currentPostCount: health.postCount,
        maxPostsPerSession: MAX_POSTS_PER_SESSION,
        maxDurationMs: MAX_DURATION_MS,
        minRelevanceScore: MIN_RELEVANCE_SCORE
      }
    }), {
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
