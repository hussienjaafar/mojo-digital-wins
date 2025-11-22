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

    const body = await req.json().catch(() => ({}));
    const jobType = body.job_type; // Optional: run specific job type
    const forceRun = body.force || false; // Force run even if not scheduled

    console.log(`Scheduler: Running jobs${jobType ? ` (type: ${jobType})` : ''}`);

    // Get jobs that are due to run
    let query = supabase
      .from('scheduled_jobs')
      .select('*')
      .eq('is_active', true);

    if (jobType) {
      query = query.eq('job_type', jobType);
    }

    if (!forceRun) {
      query = query.lte('next_run_at', new Date().toISOString());
    }

    const { data: jobs, error: jobsError } = await query;

    if (jobsError) throw jobsError;

    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No jobs due to run', jobs_run: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: any[] = [];

    for (const job of jobs) {
      const startTime = Date.now();
      let executionId: string | null = null;

      try {
        // Create execution record
        const { data: execution } = await supabase
          .from('job_executions')
          .insert({
            job_id: job.id,
            status: 'running',
          })
          .select('id')
          .single();

        executionId = execution?.id;

        // Update job status to running
        await supabase
          .from('scheduled_jobs')
          .update({ last_run_status: 'running' })
          .eq('id', job.id);

        console.log(`Running job: ${job.job_name} (${job.job_type})`);

        // Run the appropriate function based on job type
        let result: any = null;
        let itemsProcessed = 0;
        let itemsCreated = 0;

        switch (job.job_type) {
          case 'fetch_rss':
            const rssResponse = await supabase.functions.invoke('fetch-rss-feeds', {
              body: {}
            });
            if (rssResponse.error) throw new Error(rssResponse.error.message);
            result = rssResponse.data;
            itemsProcessed = result?.processed || 0;
            itemsCreated = result?.inserted || 0;
            break;

          case 'fetch_executive_orders':
            const eoResponse = await supabase.functions.invoke('fetch-executive-orders', {
              body: {}
            });
            if (eoResponse.error) throw new Error(eoResponse.error.message);
            result = eoResponse.data;
            itemsProcessed = result?.fetched || 0;
            itemsCreated = result?.inserted || 0;
            break;

          case 'track_state_actions':
            const saResponse = await supabase.functions.invoke('track-state-actions', {
              body: { action: 'fetch_all' }
            });
            if (saResponse.error) throw new Error(saResponse.error.message);
            result = saResponse.data;
            itemsProcessed = result?.total_fetched || 0;
            itemsCreated = result?.total_inserted || 0;
            break;

          case 'smart_alerting':
            const alertResponse = await supabase.functions.invoke('smart-alerting', {
              body: { action: 'full' }
            });
            if (alertResponse.error) throw new Error(alertResponse.error.message);
            result = alertResponse.data;
            itemsProcessed = result?.results?.daily_briefing?.critical || 0;
            break;

          case 'send_briefings':
            const briefingResponse = await supabase.functions.invoke('send-daily-briefing', {
              body: {}
            });
            if (briefingResponse.error) throw new Error(briefingResponse.error.message);
            result = briefingResponse.data;
            itemsProcessed = result?.emails_sent || 0;
            break;

          case 'analyze_articles':
            const analyzeResponse = await supabase.functions.invoke('analyze-articles', {
              body: {}
            });
            if (analyzeResponse.error) throw new Error(analyzeResponse.error.message);
            result = analyzeResponse.data;
            itemsProcessed = result?.processed || 0;
            itemsCreated = result?.analyzed || 0;
            break;

          case 'extract_trending_topics':
            const trendingResponse = await supabase.functions.invoke('extract-trending-topics', {
              body: {}
            });
            if (trendingResponse.error) throw new Error(trendingResponse.error.message);
            result = trendingResponse.data;
            itemsProcessed = result?.topicsExtracted || 0;
            break;

          case 'analyze_bluesky':
            const analyzeBlueskyResponse = await supabase.functions.invoke('analyze-bluesky-posts', {
              body: {}
            });
            if (analyzeBlueskyResponse.error) throw new Error(analyzeBlueskyResponse.error.message);
            result = analyzeBlueskyResponse.data;
            itemsProcessed = result?.processed || 0;
            itemsCreated = result?.analyzed || 0;
            break;

          case 'correlate_social_news':
            const correlateResponse = await supabase.functions.invoke('correlate-social-news', {
              body: {}
            });
            if (correlateResponse.error) throw new Error(correlateResponse.error.message);
            result = correlateResponse.data;
            itemsProcessed = result?.correlationsFound || 0;
            itemsCreated = result?.correlationsCreated || 0;
            break;

          case 'collect_bluesky':
          case 'bluesky_stream_keepalive': // Legacy name, same behavior
            // Cursor-based JetStream polling (runs for 45 seconds, resumes from last cursor)
            const collectBlueskyResponse = await supabase.functions.invoke('bluesky-stream', {
              body: { durationMs: 45000 }
            });
            if (collectBlueskyResponse.error) throw new Error(collectBlueskyResponse.error.message);
            result = collectBlueskyResponse.data;
            itemsProcessed = result?.postsCollected || 0;
            itemsCreated = result?.postsCollected || 0;
            break;

          default:
            throw new Error(`Unknown job type: ${job.job_type}`);
        }

        const duration = Date.now() - startTime;

        // Update execution record
        if (executionId) {
          await supabase
            .from('job_executions')
            .update({
              status: 'success',
              completed_at: new Date().toISOString(),
              duration_ms: duration,
              items_processed: itemsProcessed,
              items_created: itemsCreated,
              execution_log: result,
            })
            .eq('id', executionId);
        }

        // Update job status
        await supabase.rpc('update_job_after_execution', {
          p_job_id: job.id,
          p_status: 'success',
          p_duration_ms: duration,
          p_error: null,
        });

        results.push({
          job_name: job.job_name,
          status: 'success',
          duration_ms: duration,
          items_processed: itemsProcessed,
          items_created: itemsCreated,
        });

        console.log(`Job ${job.job_name} completed in ${duration}ms`);

      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Update execution record with failure
        if (executionId) {
          await supabase
            .from('job_executions')
            .update({
              status: 'failed',
              completed_at: new Date().toISOString(),
              duration_ms: duration,
              error_message: errorMessage,
            })
            .eq('id', executionId);
        }

        // Update job status with failure
        await supabase.rpc('update_job_after_execution', {
          p_job_id: job.id,
          p_status: 'failed',
          p_duration_ms: duration,
          p_error: errorMessage,
        });

        results.push({
          job_name: job.job_name,
          status: 'failed',
          duration_ms: duration,
          error: errorMessage,
        });

        console.error(`Job ${job.job_name} failed: ${errorMessage}`);
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const failureCount = results.filter(r => r.status === 'failed').length;

    return new Response(
      JSON.stringify({
        success: true,
        jobs_run: results.length,
        successful: successCount,
        failed: failureCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in scheduler:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
