import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ==================== CLEANUP CONFIGURATION ====================
const DEFAULT_RETENTION_DAYS = 7;     // Keep posts for 7 days
const DEFAULT_BATCH_SIZE = 500;       // Delete 500 at a time
const DEFAULT_MAX_BATCHES = 20;       // Max 20 batches per run
const MAX_DURATION_MS = 25000;        // 25 second timeout safety
const TARGET_POST_COUNT = 30000;      // Target to keep DB under this

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for optional parameters
    let retentionDays = DEFAULT_RETENTION_DAYS;
    let batchSize = DEFAULT_BATCH_SIZE;
    let maxBatches = DEFAULT_MAX_BATCHES;
    let aggressive = false; // If true, delete more aggressively

    try {
      const body = await req.json();
      retentionDays = body.retention_days ?? DEFAULT_RETENTION_DAYS;
      batchSize = body.batch_size ?? DEFAULT_BATCH_SIZE;
      maxBatches = body.max_batches ?? DEFAULT_MAX_BATCHES;
      aggressive = body.aggressive ?? false;
    } catch {
      // Use defaults if no body provided
    }

    console.log(`🧹 Starting bluesky_posts cleanup...`);
    console.log(`   Retention: ${retentionDays} days, Batch size: ${batchSize}, Max batches: ${maxBatches}`);

    // Check current post count
    const { count: currentCount, error: countError } = await supabase
      .from('bluesky_posts')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Error getting post count:', countError);
    } else {
      console.log(`   Current post count: ${currentCount}`);
      
      // If we're way over target, use aggressive mode
      if (currentCount && currentCount > TARGET_POST_COUNT * 1.5) {
        console.log(`⚠️ Database overloaded (${currentCount}/${TARGET_POST_COUNT}), enabling aggressive cleanup`);
        aggressive = true;
        retentionDays = Math.min(retentionDays, 5); // Reduce retention
      }
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffISO = cutoffDate.toISOString();

    console.log(`   Deleting posts older than: ${cutoffISO}`);

    let totalDeleted = 0;
    let batchesRun = 0;
    const startTime = Date.now();

    // Run multiple small batches with time limit
    for (let i = 0; i < maxBatches; i++) {
      // Check time limit
      if (Date.now() - startTime > MAX_DURATION_MS) {
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
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Cleanup related tables (only if we have time)
    let relatedCleanup = {
      bluesky_trends: 0,
      entity_mentions: 0,
      trending_topics: 0
    };
    
    if (Date.now() - startTime < MAX_DURATION_MS - 5000) {
      console.log(`🔗 Cleaning up related tables...`);

      // Clean up old bluesky_trends (older than 14 days)
      const trendsCutoff = new Date();
      trendsCutoff.setDate(trendsCutoff.getDate() - 14);
      
      const { error: trendsError, count: trendsCount } = await supabase
        .from('bluesky_trends')
        .delete()
        .lt('calculated_at', trendsCutoff.toISOString());

      if (trendsError) {
        console.warn('Error cleaning bluesky_trends:', trendsError);
      } else {
        relatedCleanup.bluesky_trends = trendsCount || 0;
        console.log(`   Cleaned ${trendsCount || 0} old bluesky_trends (>14 days)`);
      }

      // Clean up old entity_mentions (older than 30 days)
      const mentionsCutoff = new Date();
      mentionsCutoff.setDate(mentionsCutoff.getDate() - 30);
      
      const { error: mentionsError, count: mentionsCount } = await supabase
        .from('entity_mentions')
        .delete()
        .lt('created_at', mentionsCutoff.toISOString());

      if (mentionsError) {
        console.warn('Error cleaning entity_mentions:', mentionsError);
      } else {
        relatedCleanup.entity_mentions = mentionsCount || 0;
        console.log(`   Cleaned ${mentionsCount || 0} old entity_mentions (>30 days)`);
      }

      // Clean up old trending_topics (older than 7 days)
      const { error: topicsError, count: topicsCount } = await supabase
        .from('trending_topics')
        .delete()
        .lt('created_at', cutoffISO);

      if (topicsError) {
        console.warn('Error cleaning trending_topics:', topicsError);
      } else {
        relatedCleanup.trending_topics = topicsCount || 0;
        console.log(`   Cleaned ${topicsCount || 0} old trending_topics (>7 days)`);
      }
    }

    // Get new post count
    const { count: newCount } = await supabase
      .from('bluesky_posts')
      .select('*', { count: 'exact', head: true });

    const durationMs = Date.now() - startTime;
    const result = {
      success: true,
      bluesky_posts_deleted: totalDeleted,
      batches_run: batchesRun,
      retention_days: retentionDays,
      cutoff_date: cutoffISO,
      duration_ms: durationMs,
      related_cleanup: relatedCleanup,
      database_status: {
        previous_count: currentCount,
        current_count: newCount,
        target_count: TARGET_POST_COUNT,
        healthy: (newCount || 0) < TARGET_POST_COUNT
      },
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
