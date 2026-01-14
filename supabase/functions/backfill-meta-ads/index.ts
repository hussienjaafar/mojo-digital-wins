import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BackfillParams {
  organization_id: string;
  days_back: number;
  chunk_size_days: number;
}

/**
 * Chunked Meta Ads Backfill
 * 
 * This function backfills meta_ad_metrics_daily by calling sync-meta-ads
 * in smaller date range chunks to avoid timeouts.
 * 
 * Runs as a background task so the request returns immediately.
 */
async function runBackfill(params: BackfillParams) {
  const { organization_id, days_back, chunk_size_days } = params;
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  
  const taskName = `meta_ads_backfill_${organization_id}`;
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days_back);
  
  // Calculate total chunks
  const totalDays = days_back;
  const totalChunks = Math.ceil(totalDays / chunk_size_days);
  
  console.log(`[BACKFILL] Starting ${days_back}-day backfill for org ${organization_id}`);
  console.log(`[BACKFILL] Chunk size: ${chunk_size_days} days, Total chunks: ${totalChunks}`);
  
  // Initialize backfill status
  await supabase.from('backfill_status').upsert({
    task_name: taskName,
    status: 'running',
    total_items: totalChunks,
    processed_items: 0,
    failed_items: 0,
    started_at: new Date().toISOString(),
    last_batch_at: null,
    completed_at: null,
    error_message: null,
  }, { onConflict: 'task_name' });
  
  let processedChunks = 0;
  let failedChunks = 0;
  let totalRecords = 0;
  const errors: string[] = [];
  
  // Process chunks from oldest to newest
  let chunkStart = new Date(startDate);
  
  while (chunkStart < endDate) {
    const chunkEnd = new Date(chunkStart);
    chunkEnd.setDate(chunkEnd.getDate() + chunk_size_days);
    
    // Don't go past the end date
    if (chunkEnd > endDate) {
      chunkEnd.setTime(endDate.getTime());
    }
    
    const startStr = chunkStart.toISOString().split('T')[0];
    const endStr = chunkEnd.toISOString().split('T')[0];
    
    console.log(`[BACKFILL] Processing chunk ${processedChunks + 1}/${totalChunks}: ${startStr} to ${endStr}`);
    
    try {
      // Call sync-meta-ads for this chunk using direct HTTP with x-internal-key
      // The sync-meta-ads function accepts x-internal-key = first 20 chars of service role key for backfill mode
      const syncResponse = await fetch(`${supabaseUrl}/functions/v1/sync-meta-ads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
          'x-internal-key': serviceRoleKey.slice(0, 20),
        },
        body: JSON.stringify({
          organization_id,
          start_date: startStr,
          end_date: endStr,
          mode: 'backfill',
        }),
      });
      
      if (!syncResponse.ok) {
        const errorText = await syncResponse.text();
        throw new Error(`HTTP ${syncResponse.status}: ${errorText.slice(0, 200)}`);
      }
      
      const data = await syncResponse.json();
      
      if (data?.error) {
        throw new Error(data.error);
      }
      
      const records = data?.ad_level_daily_records || 0;
      totalRecords += records;
      processedChunks++;
      
      console.log(`[BACKFILL] Chunk ${processedChunks}/${totalChunks} complete: ${records} records`);
      
      // Update progress
      await supabase.from('backfill_status').update({
        processed_items: processedChunks,
        last_batch_at: new Date().toISOString(),
      }).eq('task_name', taskName);
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[BACKFILL] Chunk failed (${startStr} to ${endStr}):`, errorMsg);
      errors.push(`${startStr}-${endStr}: ${errorMsg}`);
      failedChunks++;
      processedChunks++;
      
      // Update progress with error
      await supabase.from('backfill_status').update({
        processed_items: processedChunks,
        failed_items: failedChunks,
        last_batch_at: new Date().toISOString(),
        error_message: errors.slice(-3).join('; '),
      }).eq('task_name', taskName);
    }
    
    // Move to next chunk
    chunkStart = new Date(chunkEnd);
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Mark complete
  const finalStatus = failedChunks === 0 ? 'completed' : failedChunks === totalChunks ? 'failed' : 'completed_with_errors';
  
  await supabase.from('backfill_status').update({
    status: finalStatus,
    processed_items: processedChunks,
    failed_items: failedChunks,
    completed_at: new Date().toISOString(),
    error_message: errors.length > 0 ? errors.slice(-5).join('; ') : null,
  }).eq('task_name', taskName);
  
  console.log(`[BACKFILL] Complete. Status: ${finalStatus}, Records: ${totalRecords}, Failed chunks: ${failedChunks}/${totalChunks}`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Auth check - admin only
    const authHeader = req.headers.get('Authorization');
    let isAuthorized = false;
    
    if (authHeader) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        const { data: isAdmin } = await userClient.rpc('has_role', {
          _user_id: user.id,
          _role: 'admin'
        });
        isAuthorized = !!isAdmin;
      }
    }
    
    // Also allow cron secret
    const cronSecret = Deno.env.get('CRON_SECRET');
    const providedCronSecret = req.headers.get('x-cron-secret');
    if (cronSecret && providedCronSecret === cronSecret) {
      isAuthorized = true;
    }
    
    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - admin access required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const body = await req.json();
    const { organization_id, days_back = 270, chunk_size_days = 14 } = body;
    
    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: 'organization_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Start backfill in background
    const params: BackfillParams = {
      organization_id,
      days_back: Math.min(days_back, 365), // Cap at 1 year
      chunk_size_days: Math.max(7, Math.min(chunk_size_days, 30)), // 7-30 days
    };
    
    // Use EdgeRuntime.waitUntil to run in background
    (globalThis as any).EdgeRuntime?.waitUntil?.(runBackfill(params)) || runBackfill(params);
    
    const totalChunks = Math.ceil(params.days_back / params.chunk_size_days);
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `Backfill started in background`,
        details: {
          organization_id,
          days_back: params.days_back,
          chunk_size_days: params.chunk_size_days,
          total_chunks: totalChunks,
          estimated_minutes: totalChunks * 0.5, // ~30s per chunk
        },
        track_progress: `SELECT * FROM backfill_status WHERE task_name = 'meta_ads_backfill_${organization_id}'`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[BACKFILL] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
