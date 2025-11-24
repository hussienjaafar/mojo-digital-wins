import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Sprint 0 Critical Fix: Backfill Processor for 121,938 Unanalyzed Posts
// Processes historical Bluesky posts in chunks with rate limit handling

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request parameters
    const {
      batchSize = 500,      // Process 500 posts per batch
      maxBatches = 10,      // Process up to 10 batches per invocation (5,000 posts)
      mode = 'backfill',    // 'backfill' for historical, 'continuous' for ongoing
      priorityThreshold = 0.1, // Minimum relevance score
      startDate = null,
      endDate = null
    } = await req.json().catch(() => ({}));

    console.log(`🔄 Starting ${mode} processing: ${batchSize} posts/batch, ${maxBatches} batches max`);

    // Track overall progress
    const startTime = Date.now();
    let totalProcessed = 0;
    let totalErrors = 0;
    let batchesProcessed = 0;
    const results: any[] = [];

    // Get total unprocessed count
    const { count: totalUnprocessed } = await supabase
      .from('bluesky_posts')
      .select('*', { count: 'exact', head: true })
      .eq('ai_processed', false)
      .gte('ai_relevance_score', priorityThreshold);

    console.log(`📊 Total unprocessed posts: ${totalUnprocessed || 0}`);

    // Process multiple batches
    for (let batch = 0; batch < maxBatches; batch++) {
      console.log(`\n📦 Processing batch ${batch + 1}/${maxBatches}...`);

      // Build query based on mode
      let query = supabase
        .from('bluesky_posts')
        .select('*')
        .eq('ai_processed', false)
        .gte('ai_relevance_score', priorityThreshold);

      // Add date filters if provided
      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      // Order by priority (highest relevance first) for backfill
      // Order by creation date for continuous processing
      if (mode === 'backfill') {
        query = query.order('ai_relevance_score', { ascending: false });
      } else {
        query = query.order('created_at', { ascending: true });
      }

      // Fetch batch
      const { data: posts, error: fetchError } = await query.limit(batchSize);

      if (fetchError) {
        console.error(`❌ Error fetching batch ${batch + 1}:`, fetchError);
        results.push({
          batch: batch + 1,
          error: fetchError.message,
          processed: 0
        });
        continue;
      }

      if (!posts || posts.length === 0) {
        console.log(`✅ No more posts to process in batch ${batch + 1}`);
        break;
      }

      console.log(`📝 Processing ${posts.length} posts in batch ${batch + 1}...`);

      // Call analyze-bluesky-posts function for this batch
      try {
        const analyzeUrl = `${supabaseUrl}/functions/v1/analyze-bluesky-posts`;
        const analyzeResponse = await fetch(analyzeUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ batchSize: posts.length })
        });

        if (!analyzeResponse.ok) {
          const errorText = await analyzeResponse.text();

          // Handle rate limits - wait and retry
          if (analyzeResponse.status === 429) {
            console.log(`⏳ Rate limit hit, waiting 60 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 60000));

            // Retry this batch
            batch--;
            continue;
          }

          throw new Error(`Analysis failed: ${errorText}`);
        }

        const analyzeResult = await analyzeResponse.json();

        totalProcessed += analyzeResult.processed || 0;
        totalErrors += analyzeResult.errors || 0;
        batchesProcessed++;

        results.push({
          batch: batch + 1,
          processed: analyzeResult.processed,
          errors: analyzeResult.errors,
          trends_updated: analyzeResult.trends_updated,
          trending_detected: analyzeResult.trending_detected
        });

        console.log(`✅ Batch ${batch + 1} complete: ${analyzeResult.processed} processed, ${analyzeResult.errors} errors`);

        // Add delay between batches to avoid rate limits (5 seconds)
        if (batch < maxBatches - 1) {
          console.log(`⏱️ Waiting 5 seconds before next batch...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }

      } catch (error: any) {
        console.error(`❌ Error processing batch ${batch + 1}:`, error);
        results.push({
          batch: batch + 1,
          error: error.message,
          processed: 0
        });
        totalErrors += posts.length;
      }
    }

    // Calculate statistics
    const elapsedMs = Date.now() - startTime;
    const postsPerSecond = totalProcessed / (elapsedMs / 1000);
    const remainingPosts = (totalUnprocessed || 0) - totalProcessed;
    const estimatedHoursRemaining = remainingPosts / (postsPerSecond * 3600);

    // Update backfill progress
    await supabase.from('processing_checkpoints').upsert({
      function_name: 'backfill-bluesky-posts',
      last_processed_at: new Date().toISOString(),
      records_processed: totalProcessed,
      metadata: {
        total_unprocessed: totalUnprocessed,
        remaining: remainingPosts,
        posts_per_second: postsPerSecond,
        estimated_hours_remaining: estimatedHoursRemaining
      },
      updated_at: new Date().toISOString()
    });

    console.log('\n' + '='.repeat(60));
    console.log('📊 BACKFILL SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Total Processed: ${totalProcessed} posts`);
    console.log(`❌ Total Errors: ${totalErrors}`);
    console.log(`📦 Batches Processed: ${batchesProcessed}`);
    console.log(`⏱️ Time Elapsed: ${(elapsedMs / 1000).toFixed(2)} seconds`);
    console.log(`🚀 Processing Speed: ${postsPerSecond.toFixed(2)} posts/second`);
    console.log(`📈 Remaining Posts: ${remainingPosts}`);
    console.log(`⏳ Estimated Time Remaining: ${estimatedHoursRemaining.toFixed(2)} hours`);
    console.log('='.repeat(60));

    // Return comprehensive response
    return new Response(
      JSON.stringify({
        success: true,
        mode,
        summary: {
          processed: totalProcessed,
          errors: totalErrors,
          batches: batchesProcessed,
          elapsed_seconds: (elapsedMs / 1000).toFixed(2),
          posts_per_second: postsPerSecond.toFixed(2),
          remaining: remainingPosts,
          estimated_hours_remaining: estimatedHoursRemaining.toFixed(2),
          completion_percentage: ((totalProcessed / (totalUnprocessed || 1)) * 100).toFixed(2)
        },
        batches: results,
        next_steps: remainingPosts > 0
          ? `Run this function ${Math.ceil(remainingPosts / (batchSize * maxBatches))} more times to complete backfill`
          : 'Backfill complete! All posts processed.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Fatal error in backfill-bluesky-posts:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});