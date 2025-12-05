import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for optional parameters
    // DEFAULT: 7 days retention (down from 30) - insights are preserved in trend tables
    let retentionDays = 7;
    let batchSize = 500; // Smaller batches for stability
    let maxBatches = 20; // More batches to process more data

    try {
      const body = await req.json();
      retentionDays = body.retention_days ?? 7;
      batchSize = body.batch_size ?? 500;
      maxBatches = body.max_batches ?? 20;
    } catch {
      // Use defaults if no body provided
    }

    console.log(`🧹 Starting bluesky_posts cleanup...`);
    console.log(`   Retention: ${retentionDays} days, Batch size: ${batchSize}, Max batches: ${maxBatches}`);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffISO = cutoffDate.toISOString();

    console.log(`   Deleting posts older than: ${cutoffISO}`);

    let totalDeleted = 0;
    let batchesRun = 0;
    const startTime = Date.now();
    const maxDurationMs = 25000; // 25 second max to avoid timeout

    // Run multiple small batches with time limit
    for (let i = 0; i < maxBatches; i++) {
      // Check time limit
      if (Date.now() - startTime > maxDurationMs) {
        console.log(`⏱️ Time limit reached after ${batchesRun} batches`);
        break;
      }

      // First, get the IDs to delete (small query)
      const { data: idsToDelete, error: selectError } = await supabase
        .from('bluesky_posts')
        .select('id')
        .lt('created_at', cutoffISO)
        .order('created_at', { ascending: true }) // Oldest first
        .limit(batchSize);

      if (selectError) {
        console.error(`Batch ${i + 1} select error:`, selectError);
        // Don't break on error, continue with other cleanup
        break;
      }

      if (!idsToDelete || idsToDelete.length === 0) {
        console.log(`✅ No more old posts to delete after ${batchesRun} batches`);
        break;
      }

      const ids = idsToDelete.map(row => row.id);

      // Delete the batch by IDs
      const { error: deleteError, count } = await supabase
        .from('bluesky_posts')
        .delete()
        .in('id', ids);

      if (deleteError) {
        console.error(`Batch ${i + 1} delete error:`, deleteError);
        break;
      }

      const deleted = count || ids.length;
      totalDeleted += deleted;
      batchesRun++;

      console.log(`   Batch ${i + 1}: Deleted ${deleted} posts (total: ${totalDeleted})`);

      // Small delay between batches to reduce database load
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Cleanup related tables (only if we have time)
    if (Date.now() - startTime < maxDurationMs - 5000) {
      console.log(`🔗 Cleaning up related tables...`);

      // Clean up old bluesky_trends (older than 14 days)
      const trendsCutoff = new Date();
      trendsCutoff.setDate(trendsCutoff.getDate() - 14);
      
      const { error: trendsError } = await supabase
        .from('bluesky_trends')
        .delete()
        .lt('calculated_at', trendsCutoff.toISOString());

      if (trendsError) {
        console.warn('Error cleaning bluesky_trends:', trendsError);
      } else {
        console.log('   Cleaned old bluesky_trends (>14 days)');
      }

      // Clean up old entity_mentions (older than 30 days)
      const mentionsCutoff = new Date();
      mentionsCutoff.setDate(mentionsCutoff.getDate() - 30);
      
      const { error: mentionsError } = await supabase
        .from('entity_mentions')
        .delete()
        .lt('created_at', mentionsCutoff.toISOString());

      if (mentionsError) {
        console.warn('Error cleaning entity_mentions:', mentionsError);
      } else {
        console.log('   Cleaned old entity_mentions (>30 days)');
      }

      // Clean up old trending_topics (older than 7 days)
      const { error: topicsError } = await supabase
        .from('trending_topics')
        .delete()
        .lt('created_at', cutoffISO);

      if (topicsError) {
        console.warn('Error cleaning trending_topics:', topicsError);
      } else {
        console.log('   Cleaned old trending_topics (>7 days)');
      }
    }

    const durationMs = Date.now() - startTime;
    const result = {
      success: true,
      bluesky_posts_deleted: totalDeleted,
      batches_run: batchesRun,
      retention_days: retentionDays,
      cutoff_date: cutoffISO,
      duration_ms: durationMs,
      message: totalDeleted > 0 
        ? `Deleted ${totalDeleted} old posts in ${batchesRun} batches (${durationMs}ms)`
        : 'No old posts found to delete'
    };

    console.log(`✅ Cleanup complete:`, result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const err = error as Error;
    console.error('❌ Cleanup error:', err);
    return new Response(JSON.stringify({ 
      success: false, 
      error: err.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
