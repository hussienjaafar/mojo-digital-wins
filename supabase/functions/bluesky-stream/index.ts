import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateCronOrAdmin, logJobFailure, checkRateLimit } from "../_shared/security.ts";
import { getAllKeywords, POLICY_DOMAIN_KEYWORDS } from "../_shared/policyDomainKeywords.ts";

const corsHeaders = getCorsHeaders();

// SAFEGUARDS
const MAX_POSTS_IN_DB = 50000;
const MAX_POSTS_PER_SESSION = 500;
const MAX_DURATION_MS = 10000;
const MIN_RELEVANCE_SCORE = 0.15; // Lowered threshold for broader collection

// Use comprehensive policy domain keywords instead of hardcoded list
// This covers all 12 policy domains with 500+ keywords
const POLITICAL_KEYWORDS = getAllKeywords();

const SPAM_PATTERNS = [
  /follow\s*me/i, /check\s*my\s*profile/i, /link\s*in\s*bio/i, /dm\s*me/i,
  /\$\d+/, /crypto|bitcoin|eth|nft/i, /giveaway|airdrop/i, /onlyfans|nsfw/i,
  /🔥.*🔥.*🔥/, /!!!+/, /follow.*follow.*follow/i,
];

const POLITICAL_KEYWORDS_LOWER = POLITICAL_KEYWORDS.map(k => k.toLowerCase());
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

async function checkDatabaseHealth(supabase: any): Promise<{ healthy: boolean; postCount: number; message: string }> {
  try {
    const { count, error } = await supabase
      .from('bluesky_posts')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.warn('Database count query issue:', error.message);
      return { healthy: true, postCount: 0, message: 'Database accessible, count unavailable' };
    }
    
    const postCount = count || 0;
    console.log(`Current post count: ${postCount}`);
    
    if (postCount >= MAX_POSTS_IN_DB) {
      return { healthy: false, postCount, message: `Database at capacity: ${postCount}/${MAX_POSTS_IN_DB}` };
    }
    
    return { healthy: true, postCount, message: `Database healthy: ${postCount}/${MAX_POSTS_IN_DB}` };
  } catch (error) {
    console.warn('Health check error:', error);
    return { healthy: true, postCount: 0, message: 'Health check unavailable' };
  }
}

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

function extractHashtags(text: string): string[] {
  return Array.from(text.matchAll(/#(\w+)/g), m => m[1].toLowerCase());
}

function extractMentions(text: string): string[] {
  return Array.from(text.matchAll(/@([a-zA-Z0-9._-]+)/g), m => m[1]);
}

function extractUrls(text: string): string[] {
  return Array.from(text.matchAll(/(https?:\/\/[^\s]+)/g), m => m[1]);
}

function hasHighValueKeyword(text: string): boolean {
  const lowerText = text.toLowerCase();
  let hasSubstring = false;
  for (const keyword of POLITICAL_KEYWORDS_LOWER) {
    if (lowerText.includes(keyword)) { hasSubstring = true; break; }
  }
  if (!hasSubstring) return false;
  for (const pattern of KEYWORD_PATTERNS) {
    if (pattern.test(text)) return true;
  }
  return false;
}

function calculateRelevance(text: string): number {
  const lowerText = text.toLowerCase();
  let score = 0;
  let matchCount = 0;
  for (const keyword of POLITICAL_KEYWORDS_LOWER) {
    if (lowerText.includes(keyword)) {
      score += 0.15;
      matchCount++;
      if (matchCount >= 2) return Math.min(score + 0.2, 1.0);
    }
  }
  return score;
}

async function processBlueskyStream(supabase: any, durationMs: number, maxPostsProcessed: number) {
  console.log('Starting JetStream collection...');

  const { data: cursorData } = await supabase
    .from('bluesky_stream_cursor')
    .select('last_cursor')
    .eq('id', 1)
    .single();

  const startCursor = cursorData?.last_cursor || 0;
  console.log(`Resuming from cursor: ${startCursor}`);

  let latestCursor = startCursor;
  let postCount = 0;
  let relevantCount = 0;
  let shouldStop = false;
  const collectedPosts: any[] = [];
  const startTime = Date.now();

  const timeout = setTimeout(() => { shouldStop = true; }, durationMs);

  return new Promise((resolve, reject) => {
    try {
      const ws = new WebSocket(
        `wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post&cursor=${startCursor}`
      );

      ws.onopen = () => console.log('Connected to JetStream');

      ws.onmessage = async (event) => {
        if (shouldStop) { ws.close(); return; }
        
        try {
          const data: JetStreamEvent = JSON.parse(event.data);
          if (data.time_us) latestCursor = data.time_us;
          if (data.kind !== 'commit' || !data.commit?.record?.text) return;

          postCount++;
          if (relevantCount >= maxPostsProcessed) { shouldStop = true; ws.close(); return; }

          const record = data.commit.record;
          const text = record.text;
          const langs = record.langs || [];
          
          if (langs.length > 0 && !langs.includes('en')) return;
          if (text.length < 60 || text.length > 350) return;
          if (isSpamOrLowValue(text)) return;
          if (!hasHighValueKeyword(text)) return;
          
          const relevanceScore = calculateRelevance(text);
          if (relevanceScore < MIN_RELEVANCE_SCORE) return;

          relevantCount++;

          collectedPosts.push({
            author_did: data.did,
            post_uri: `at://${data.did}/${data.commit.collection}/${data.commit.rkey}`,
            post_cid: data.commit.cid,
            text,
            created_at: record.createdAt,
            indexed_at: new Date().toISOString(),
            langs: record.langs || [],
            hashtags: extractHashtags(text) || null,
            mentions: extractMentions(text) || null,
            urls: extractUrls(text) || null,
            reply_to: record.reply?.parent?.uri || null,
            embed_type: record.embed?.$type || null,
            ai_relevance_score: relevanceScore,
          });

          if (collectedPosts.length >= 25) {
            const batch = [...collectedPosts];
            collectedPosts.length = 0;
            await supabase.from('bluesky_posts').upsert(batch, { onConflict: 'post_uri', ignoreDuplicates: true });
            console.log(`Batch: ${batch.length} posts | Total: ${relevantCount}`);
          }
        } catch (error) {
          console.error('Error processing message:', error);
        }
      };

      ws.onerror = (error) => { clearTimeout(timeout); reject(error); };

      ws.onclose = async () => {
        clearTimeout(timeout);
        if (collectedPosts.length > 0) {
          await supabase.from('bluesky_posts').upsert(collectedPosts, { onConflict: 'post_uri', ignoreDuplicates: true });
        }
        await supabase.from('bluesky_stream_cursor').update({
          last_cursor: latestCursor,
          last_updated_at: new Date().toISOString(),
          posts_collected: relevantCount,
        }).eq('id', 1);

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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // SECURITY: Validate cron secret or admin JWT
    const authResult = await validateCronOrAdmin(req, supabase);
    if (!authResult.valid) {
      console.error('[bluesky-stream] Unauthorized access attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log(`[bluesky-stream] Authorized via ${authResult.isAdmin ? 'admin' : 'cron'}`);

    // SECURITY: Rate limiting
    const rateLimit = await checkRateLimit('bluesky-stream', 6, 60000);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', resetAt: rateLimit.resetAt }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const health = await checkDatabaseHealth(supabase);
    console.log(health.message);
    
    if (!health.healthy) {
      return new Response(JSON.stringify({
        status: 'paused',
        reason: health.message,
        postCount: health.postCount,
        maxAllowed: MAX_POSTS_IN_DB,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json().catch(() => ({}));
    const durationMs = Math.min(body.durationMs || MAX_DURATION_MS, MAX_DURATION_MS);
    const maxPosts = Math.min(body.maxPostsProcessed || MAX_POSTS_PER_SESSION, MAX_POSTS_PER_SESSION);
    
    const result = await processBlueskyStream(supabase, durationMs, maxPosts) as any;

    return new Response(JSON.stringify({
      relevantPosts: result.relevantPosts,
      totalProcessed: result.totalProcessed,
      cursor: result.cursor,
      durationMs: result.durationMs,
      safeguards: {
        maxPostsInDb: MAX_POSTS_IN_DB,
        currentPostCount: health.postCount,
        maxPostsPerSession: MAX_POSTS_PER_SESSION,
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[bluesky-stream] Error:', error);
    await logJobFailure(supabase, 'bluesky-stream', error?.message || 'Unknown error');
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
