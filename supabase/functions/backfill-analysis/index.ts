import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { daysBack = 7, batchSize = 100 } = await req.json().catch(() => ({}));

    console.log(`[backfill-analysis] Starting backfill for last ${daysBack} days`);

    // Clear existing incomplete data and mark for reanalysis
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const { data: articlesToFix, error: queryError } = await supabase
      .from('articles')
      .update({ 
        processing_status: 'pending',
        ai_summary: null,
        affected_groups: null,
        relevance_category: null,
        validation_passed: null,
        validation_errors: null
      })
      .gte('published_date', cutoffDate.toISOString())
      .or('affected_groups.is.null,relevance_category.is.null')
      .select('id');

    if (queryError) throw queryError;

    console.log(`[backfill-analysis] Marked ${articlesToFix?.length || 0} articles for reanalysis`);

    // Similarly for Bluesky posts
    const { data: postsToFix, error: postsQueryError } = await supabase
      .from('bluesky_posts')
      .update({ 
        ai_processed: false,
        ai_topics: null,
        affected_groups: null,
        relevance_category: null,
        validation_passed: null,
        validation_errors: null
      })
      .gte('created_at', cutoffDate.toISOString())
      .or('affected_groups.is.null,relevance_category.is.null')
      .select('id');

    if (postsQueryError) throw postsQueryError;

    console.log(`[backfill-analysis] Marked ${postsToFix?.length || 0} posts for reanalysis`);

    // Trigger analysis functions
    const articleBatches = Math.ceil((articlesToFix?.length || 0) / batchSize);
    const postBatches = Math.ceil((postsToFix?.length || 0) / batchSize);

    console.log(`[backfill-analysis] Will process ${articleBatches} article batches and ${postBatches} post batches`);

    // Trigger first batch of each
    const results = {
      articles_marked: articlesToFix?.length || 0,
      posts_marked: postsToFix?.length || 0,
      article_batches: articleBatches,
      post_batches: postBatches
    };

    // Invoke analysis functions to start processing
    if (articlesToFix && articlesToFix.length > 0) {
      supabase.functions.invoke('analyze-articles').catch(console.error);
    }
    
    if (postsToFix && postsToFix.length > 0) {
      supabase.functions.invoke('analyze-bluesky-posts').catch(console.error);
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
        message: 'Backfill initiated. Analysis functions will process items in batches.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[backfill-analysis] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
