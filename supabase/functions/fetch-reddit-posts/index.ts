import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateCronOrAdmin, logJobFailure, checkRateLimit } from "../_shared/security.ts";

// Political subreddits to monitor (using Reddit's public JSON API - no auth needed)
const POLITICAL_SUBREDDITS = [
  'politics',
  'worldnews',
  'news',
  'conservative',
  'liberal',
  'neutralpolitics',
  'PoliticalDiscussion',
  'uspolitics',
];

interface RedditPost {
  reddit_id: string;
  subreddit: string;
  title: string;
  selftext: string | null;
  author: string;
  upvotes: number;
  downvotes: number;
  score: number;
  num_comments: number;
  created_utc: string;
  url: string;
  permalink: string;
}

async function fetchSubredditPosts(subreddit: string, limit: number = 25): Promise<RedditPost[]> {
  const posts: RedditPost[] = [];
  
  try {
    // Use Reddit's public JSON API (add .json to any Reddit URL)
    const response = await fetch(
      `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}`,
      {
        headers: {
          'User-Agent': 'PoliticalIntelBot/1.0 (Educational/Research)',
        },
      }
    );
    
    if (!response.ok) {
      console.error(`Failed to fetch r/${subreddit}: ${response.status}`);
      return posts;
    }
    
    const data = await response.json();
    
    for (const child of data.data.children) {
      const post = child.data;
      
      // Skip pinned/stickied posts and non-political content
      if (post.stickied || post.over_18) continue;
      
      posts.push({
        reddit_id: post.id,
        subreddit: post.subreddit,
        title: post.title,
        selftext: post.selftext?.substring(0, 5000) || null, // Limit text length
        author: post.author,
        upvotes: post.ups || 0,
        downvotes: post.downs || 0,
        score: post.score || 0,
        num_comments: post.num_comments || 0,
        created_utc: new Date(post.created_utc * 1000).toISOString(),
        url: post.url,
        permalink: `https://reddit.com${post.permalink}`,
      });
    }
  } catch (error) {
    console.error(`Error fetching r/${subreddit}:`, error);
  }
  
  return posts;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders();
  
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
      console.error('[fetch-reddit-posts] Unauthorized access attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Rate limiting
    const rateLimit = await checkRateLimit('fetch-reddit-posts', 10, 60000);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', resetAt: rateLimit.resetAt }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching Reddit posts from political subreddits...');
    
    // Fetch all subreddits in parallel with rate limiting consideration
    const allPosts: RedditPost[] = [];
    
    // Fetch in small batches to respect Reddit rate limits
    for (let i = 0; i < POLITICAL_SUBREDDITS.length; i += 2) {
      const batch = POLITICAL_SUBREDDITS.slice(i, i + 2);
      const promises = batch.map(sub => fetchSubredditPosts(sub, 25));
      const results = await Promise.all(promises);
      allPosts.push(...results.flat());
      
      // Small delay between batches to respect rate limits
      if (i + 2 < POLITICAL_SUBREDDITS.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Deduplicate by reddit_id
    const uniquePosts = new Map<string, RedditPost>();
    for (const post of allPosts) {
      if (!uniquePosts.has(post.reddit_id)) {
        uniquePosts.set(post.reddit_id, post);
      }
    }
    
    const postsToInsert = Array.from(uniquePosts.values());
    console.log(`Found ${allPosts.length} posts, ${postsToInsert.length} unique`);
    
    // Insert in batches, ignoring duplicates
    let inserted = 0;
    let duplicates = 0;
    const batchSize = 50;
    
    for (let i = 0; i < postsToInsert.length; i += batchSize) {
      const batch = postsToInsert.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('reddit_posts')
        .upsert(batch, { 
          onConflict: 'reddit_id',
          ignoreDuplicates: true 
        })
        .select('id');
      
      if (error) {
        console.error('Insert error:', error);
      } else {
        inserted += data?.length || 0;
      }
    }
    
    duplicates = postsToInsert.length - inserted;
    
    // Log batch stats
    await supabase.from('processing_batches').insert({
      batch_type: 'reddit',
      items_count: allPosts.length,
      unique_items: postsToInsert.length,
      duplicates_removed: duplicates,
      processing_time_ms: Date.now() - startTime,
      completed_at: new Date().toISOString(),
      status: 'completed'
    });

    const result = {
      success: true,
      subreddits: POLITICAL_SUBREDDITS.length,
      fetched: allPosts.length,
      unique: postsToInsert.length,
      inserted,
      duplicates,
      duration_ms: Date.now() - startTime
    };
    
    console.log('Reddit fetch complete:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error in fetch-reddit-posts:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
