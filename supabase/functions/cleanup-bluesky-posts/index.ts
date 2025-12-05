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
    let retentionDays = 30;
    let batchSize = 1000;
    let maxBatches = 10;

    try {
      const body = await req.json();
      retentionDays = body.retention_days || 30;
      batchSize = body.batch_size || 1000;
      maxBatches = body.max_batches || 10;
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

    // Run multiple small batches
    for (let i = 0; i < maxBatches; i++) {
      // First, get the IDs to delete (small query)
      const { data: idsToDelete, error: selectError } = await supabase
        .from('bluesky_posts')
        .select('id')
        .lt('created_at', cutoffISO)
        .limit(batchSize);

      if (selectError) {
        console.error(`Batch ${i + 1} select error:`, selectError);
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

      // Small delay between batches to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Also cleanup related tables
    console.log(`🔗 Cleaning up related tables...`);

    // Clean up old bluesky_trends
    const { error: trendsError } = await supabase
      .from('bluesky_trends')
      .delete()
      .lt('calculated_at', cutoffISO);

    if (trendsError) {
      console.warn('Error cleaning bluesky_trends:', trendsError);
    } else {
      console.log('   Cleaned old bluesky_trends');
    }

    // Clean up old entity_mentions linked to deleted posts
    const { error: mentionsError } = await supabase
      .from('entity_mentions')
      .delete()
      .lt('created_at', cutoffISO);

    if (mentionsError) {
      console.warn('Error cleaning entity_mentions:', mentionsError);
    } else {
      console.log('   Cleaned old entity_mentions');
    }

    // Clean up old trending_topics
    const { error: topicsError } = await supabase
      .from('trending_topics')
      .delete()
      .lt('created_at', cutoffISO);

    if (topicsError) {
      console.warn('Error cleaning trending_topics:', topicsError);
    } else {
      console.log('   Cleaned old trending_topics');
    }

    // Log completion
    const result = {
      success: true,
      bluesky_posts_deleted: totalDeleted,
      batches_run: batchesRun,
      retention_days: retentionDays,
      cutoff_date: cutoffISO,
      message: totalDeleted > 0 
        ? `Successfully deleted ${totalDeleted} old bluesky posts in ${batchesRun} batches`
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
