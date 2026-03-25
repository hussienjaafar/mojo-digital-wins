import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS with allowed origins
const ALLOWED_ORIGINS = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || [];
const getCorsHeaders = (origin?: string) => {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] || 'https://lovable.dev';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
};

interface CleanupResult {
  table: string;
  deleted: number;
  error?: string;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') || undefined;
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const results: CleanupResult[] = [];

  try {
    // Auth check: require either CRON_SECRET header or valid admin JWT
    const cronSecret = req.headers.get('x-cron-secret');
    const expectedCronSecret = Deno.env.get('CRON_SECRET');
    const authHeader = req.headers.get('authorization');

    let isAuthorized = false;

    if (cronSecret && expectedCronSecret && cronSecret === expectedCronSecret) {
      isAuthorized = true;
      console.log('[TTL Cleanup] Authorized via CRON_SECRET');
    } else if (authHeader) {
      const supabaseAuth = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await supabaseAuth.auth.getUser();
      if (user) {
        const { data: isAdmin } = await supabaseAuth.rpc('has_role', { _user_id: user.id, _role: 'admin' });
        if (isAdmin) {
          isAuthorized = true;
          console.log('[TTL Cleanup] Authorized via admin JWT');
        }
      }
    }

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - requires CRON_SECRET or admin JWT' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[TTL Cleanup] Starting scheduled cleanup...');

    // 1. Delete unprocessed bluesky posts older than 3 days
    const { count: unprocessedBluesky, error: e1 } = await supabase
      .from('bluesky_posts')
      .delete({ count: 'exact' })
      .eq('ai_processed', false)
      .lt('created_at', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString());
    
    results.push({ 
      table: 'bluesky_posts (unprocessed)', 
      deleted: unprocessedBluesky || 0,
      error: e1?.message 
    });

    // 2. Delete ALL bluesky posts older than 14 days
    const { count: oldBluesky, error: e2 } = await supabase
      .from('bluesky_posts')
      .delete({ count: 'exact' })
      .lt('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString());
    
    results.push({ 
      table: 'bluesky_posts (>14 days)', 
      deleted: oldBluesky || 0,
      error: e2?.message 
    });

    // 3. Delete job executions older than 7 days
    const { count: oldJobs, error: e3 } = await supabase
      .from('job_executions')
      .delete({ count: 'exact' })
      .lt('started_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
    
    results.push({ 
      table: 'job_executions', 
      deleted: oldJobs || 0,
      error: e3?.message 
    });

    // 4. Delete job failures older than 14 days
    const { count: oldFailures, error: e4 } = await supabase
      .from('job_failures')
      .delete({ count: 'exact' })
      .lt('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString());
    
    results.push({ 
      table: 'job_failures', 
      deleted: oldFailures || 0,
      error: e4?.message 
    });

    // 5. Delete trending topics older than 30 days
    const { count: oldTopics, error: e5 } = await supabase
      .from('trending_topics')
      .delete({ count: 'exact' })
      .lt('hour_timestamp', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    
    results.push({ 
      table: 'trending_topics', 
      deleted: oldTopics || 0,
      error: e5?.message 
    });

    // 6. Delete low-value cache entries (0 hits, older than 3 days)
    const { count: oldCache, error: e6 } = await supabase
      .from('ai_analysis_cache')
      .delete({ count: 'exact' })
      .eq('hit_count', 0)
      .lt('created_at', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString());
    
    results.push({ 
      table: 'ai_analysis_cache (0 hits)', 
      deleted: oldCache || 0,
      error: e6?.message 
    });

    // 7. Delete entity mentions older than 30 days
    const { count: oldMentions, error: e7 } = await supabase
      .from('entity_mentions')
      .delete({ count: 'exact' })
      .lt('mentioned_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    
    results.push({ 
      table: 'entity_mentions', 
      deleted: oldMentions || 0,
      error: e7?.message 
    });

    // 8. Archive old data (bluesky >30 days, articles >90 days)
    const { data: archiveResult, error: e8 } = await supabase.rpc('archive_old_data');
    
    if (archiveResult && archiveResult.length > 0) {
      const archived = archiveResult[0];
      results.push({ 
        table: 'bluesky_posts_archive', 
        deleted: archived.bluesky_archived || 0,
        error: e8?.message 
      });
      results.push({ 
        table: 'articles_archive', 
        deleted: archived.articles_archived || 0,
        error: e8?.message 
      });
    }

    // 9. Delete cron job_run_details older than 7 days
    const { data: cronCleanupResult, error: e9 } = await supabase.rpc('cleanup_cron_job_run_details', { 
      retention_days: 7 
    });
    
    results.push({ 
      table: 'cron.job_run_details', 
      deleted: cronCleanupResult || 0,
      error: e9?.message 
    });

    const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);
    const duration = Date.now() - startTime;
    const errors = results.filter(r => r.error);

    console.log(`[TTL Cleanup] Completed in ${duration}ms. Total deleted: ${totalDeleted}`);
    results.forEach(r => {
      if (r.deleted > 0 || r.error) {
        console.log(`  - ${r.table}: ${r.deleted} deleted${r.error ? ` (error: ${r.error})` : ''}`);
      }
    });

    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      total_deleted: totalDeleted,
      results,
      errors_count: errors.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[TTL Cleanup] Fatal error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      results
    }), {
      status: 500,
      headers: { ...getCorsHeaders(), 'Content-Type': 'application/json' }
    });
  }
});
