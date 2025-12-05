import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Job dependencies: job_type -> required predecessor job_types
const JOB_DEPENDENCIES: Record<string, string[]> = {
  'analyze_articles': ['fetch_rss'],
  'analyze_bluesky': ['collect_bluesky'],
  'calculate_bluesky_trends': ['analyze_bluesky'],
  'calculate_news_trends': ['analyze_articles'],
  'correlate_social_news': ['calculate_bluesky_trends', 'calculate_news_trends'],
  'detect_anomalies': ['calculate_bluesky_trends', 'calculate_news_trends'],
  'detect_fundraising_opportunities': ['correlate_social_news'],
  'smart_alerting': ['analyze_articles', 'detect_anomalies'],
};

// Jobs that can be skipped if no new data
const SKIP_IF_NO_DATA: Record<string, { table: string; column: string; minutes: number }> = {
  'analyze_articles': { table: 'articles', column: 'created_at', minutes: 20 },
  'analyze_bluesky': { table: 'bluesky_posts', column: 'created_at', minutes: 15 },
  'calculate_bluesky_trends': { table: 'bluesky_posts', column: 'ai_processed_at', minutes: 20 },
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
    const jobType = body.job_type;
    const forceRun = body.force || false;

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

    // Get recent job execution status for dependency checking
    const { data: recentExecutions } = await supabase
      .from('job_executions')
      .select('job_id, status, completed_at')
      .gte('started_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .eq('status', 'success')
      .order('completed_at', { ascending: false });

    const recentSuccessByJobId = new Map<string, Date>();
    recentExecutions?.forEach(exec => {
      if (!recentSuccessByJobId.has(exec.job_id)) {
        recentSuccessByJobId.set(exec.job_id, new Date(exec.completed_at));
      }
    });

    // Create job_type to job_id mapping
    const jobTypeToId = new Map<string, string>();
    jobs.forEach(job => jobTypeToId.set(job.job_type, job.id));

    const results: any[] = [];
    const skipped: string[] = [];

    for (const job of jobs) {
      const startTime = Date.now();
      let executionId: string | null = null;

      // Smart skip: Check if dependencies have run recently
      const deps = JOB_DEPENDENCIES[job.job_type];
      if (deps && !forceRun) {
        const missingDeps = deps.filter(depType => {
          const depJobId = jobTypeToId.get(depType);
          if (!depJobId) return false;
          const lastSuccess = recentSuccessByJobId.get(depJobId);
          return !lastSuccess || (Date.now() - lastSuccess.getTime() > 60 * 60 * 1000);
        });
        if (missingDeps.length > 0) {
          console.log(`Skipping ${job.job_name}: waiting for dependencies ${missingDeps.join(', ')}`);
          skipped.push(job.job_name);
          continue;
        }
      }

      // Smart skip: Check if there's new data to process
      const skipConfig = SKIP_IF_NO_DATA[job.job_type];
      if (skipConfig && !forceRun) {
        const cutoff = new Date(Date.now() - skipConfig.minutes * 60 * 1000).toISOString();
        const { count } = await supabase
          .from(skipConfig.table)
          .select('*', { count: 'exact', head: true })
          .gte(skipConfig.column, cutoff);
        
        if (!count || count === 0) {
          console.log(`Skipping ${job.job_name}: no new data in ${skipConfig.table}`);
          skipped.push(job.job_name);
          // Still update next_run_at to prevent re-checking immediately
          await supabase.rpc('update_job_after_execution', {
            p_job_id: job.id,
            p_status: 'skipped',
            p_duration_ms: 0,
            p_error: null,
          });
          continue;
        }
      }

      try {
        // Create execution record
        const { data: execution } = await supabase
          .from('job_executions')
          .insert({
            job_id: job.id,
            status: 'running',
          })
          .select('id')
          .maybeSingle();

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

          case 'calculate_bluesky_trends':
            const calcTrendsResponse = await supabase.functions.invoke('calculate-bluesky-trends', {
              body: {}
            });
            if (calcTrendsResponse.error) throw new Error(calcTrendsResponse.error.message);
            result = calcTrendsResponse.data;
            itemsProcessed = result?.trends_updated || result?.length || 0;
            break;

          case 'correlate_social_news':
            const correlateResponse = await supabase.functions.invoke('correlate-social-news', {
              body: {}
            });
            if (correlateResponse.error) throw new Error(correlateResponse.error.message);
            result = correlateResponse.data;
            itemsProcessed = result?.trends_analyzed || 0;
            itemsCreated = result?.correlations_found || 0;
            break;

          case 'aggregate_sentiment':
            const sentimentResponse = await supabase.functions.invoke('aggregate-sentiment', {
              body: {}
            });
            if (sentimentResponse.error) throw new Error(sentimentResponse.error.message);
            result = sentimentResponse.data;
            itemsProcessed = result?.snapshots_created || 0;
            break;

          case 'detect_anomalies':
            const anomalyResponse = await supabase.functions.invoke('detect-anomalies', {
              body: {}
            });
            if (anomalyResponse.error) throw new Error(anomalyResponse.error.message);
            result = anomalyResponse.data;
            itemsProcessed = result?.anomalies_detected || 0;
            break;

          case 'cleanup_cache':
            const cleanupResponse = await supabase.functions.invoke('cleanup-old-cache', {
              body: {}
            });
            if (cleanupResponse.error) throw new Error(cleanupResponse.error.message);
            result = cleanupResponse.data;
            itemsProcessed = result?.deleted || 0;
            break;

          case 'collect_bluesky':
          case 'bluesky_stream_keepalive':
            // Cursor-based JetStream polling (runs for 45 seconds, resumes from last cursor)
            const collectBlueskyResponse = await supabase.functions.invoke('bluesky-stream', {
              body: { durationMs: 45000 }
            });
            if (collectBlueskyResponse.error) throw new Error(collectBlueskyResponse.error.message);
            result = collectBlueskyResponse.data;
            itemsProcessed = result?.postsCollected || 0;
            itemsCreated = result?.postsCollected || 0;
            break;

          // REMOVED: Duplicate case for calculate_bluesky_trends
          // This case is already handled at line 161-168

          case 'calculate_news_trends':
            const newsTrendsResponse = await supabase.functions.invoke('calculate-news-trends', {
              body: {}
            });
            if (newsTrendsResponse.error) throw new Error(newsTrendsResponse.error.message);
            result = newsTrendsResponse.data;
            itemsProcessed = result?.topics_updated || 0;
            itemsCreated = result?.trending_count || 0;
            break;

          case 'detect_spikes':
            const spikesResponse = await supabase.functions.invoke('detect-spikes', {
              body: {}
            });
            if (spikesResponse.error) throw new Error(spikesResponse.error.message);
            result = spikesResponse.data;
            itemsProcessed = result?.spikes_detected || 0;
            break;

          case 'detect_breaking_news':
            const breakingNewsResponse = await supabase.functions.invoke('detect-breaking-news', {
              body: {}
            });
            if (breakingNewsResponse.error) throw new Error(breakingNewsResponse.error.message);
            result = breakingNewsResponse.data;
            itemsProcessed = result?.clusters_found || 0;
            break;

          case 'send_spike_alerts':
            const alertsResponse = await supabase.functions.invoke('send-spike-alerts', {
              body: {}
            });
            if (alertsResponse.error) throw new Error(alertsResponse.error.message);
            result = alertsResponse.data;
            itemsProcessed = result?.alerts_processed || 0;
            itemsCreated = result?.emails_sent || 0;
            break;

          case 'calculate_entity_trends':
            const entityTrendsResponse = await supabase.functions.invoke('calculate-entity-trends', {
              body: {}
            });
            if (entityTrendsResponse.error) throw new Error(entityTrendsResponse.error.message);
            result = entityTrendsResponse.data;
            itemsProcessed = result?.entities_processed || 0;
            itemsCreated = result?.trends_updated || 0;
            break;

          case 'match_entity_watchlist':
            const watchlistResponse = await supabase.functions.invoke('match-entity-watchlist', {
              body: {}
            });
            if (watchlistResponse.error) throw new Error(watchlistResponse.error.message);
            result = watchlistResponse.data;
            itemsProcessed = result?.entities_checked || 0;
            itemsCreated = result?.alerts_created || 0;
            break;

          case 'generate_suggested_actions':
            const actionsResponse = await supabase.functions.invoke('generate-suggested-actions', {
              body: {}
            });
            if (actionsResponse.error) throw new Error(actionsResponse.error.message);
            result = actionsResponse.data;
            itemsProcessed = result?.alerts_analyzed || 0;
            itemsCreated = result?.actions_generated || 0;
            break;

          case 'detect_fundraising_opportunities':
            const opportunitiesResponse = await supabase.functions.invoke('detect-fundraising-opportunities', {
              body: {}
            });
            if (opportunitiesResponse.error) throw new Error(opportunitiesResponse.error.message);
            result = opportunitiesResponse.data;
            itemsProcessed = result?.trends_analyzed || 0;
            itemsCreated = result?.opportunities_found || 0;
            break;

          case 'track_event_impact':
            const impactResponse = await supabase.functions.invoke('track-event-impact', {
              body: {}
            });
            if (impactResponse.error) throw new Error(impactResponse.error.message);
            result = impactResponse.data;
            itemsProcessed = result?.events_tracked || 0;
            break;

          case 'attribution':
            const attributionResponse = await supabase.functions.invoke('calculate-attribution', {
              body: {}
            });
            if (attributionResponse.error) throw new Error(attributionResponse.error.message);
            result = attributionResponse.data;
            itemsProcessed = result?.touchpoints_analyzed || 0;
            break;

          case 'polling':
            const pollingResponse = await supabase.functions.invoke('fetch-polling-data', {
              body: {}
            });
            if (pollingResponse.error) throw new Error(pollingResponse.error.message);
            result = pollingResponse.data;
            itemsProcessed = result?.polls_fetched || 0;
            itemsCreated = result?.polls_inserted || 0;
            break;

          case 'sync':
            // Handle sync jobs - call the appropriate sync function based on endpoint
            const syncEndpoint = job.endpoint?.split('/').pop() || '';
            const syncResponse = await supabase.functions.invoke(syncEndpoint, {
              body: job.payload || {}
            });
            if (syncResponse.error) throw new Error(syncResponse.error.message);
            result = syncResponse.data;
            itemsProcessed = result?.results?.length || result?.processed || 1;
            itemsCreated = result?.inserted || 0;
            break;

          case 'analytics':
            // Handle analytics jobs
            const analyticsEndpoint = job.endpoint?.split('/').pop() || '';
            const analyticsResponse = await supabase.functions.invoke(analyticsEndpoint, {
              body: job.payload || {}
            });
            if (analyticsResponse.error) throw new Error(analyticsResponse.error.message);
            result = analyticsResponse.data;
            itemsProcessed = result?.organizations_processed || 1;
            break;

          case 'refresh_unified_trends':
            // Refresh the unified trends materialized view
            const { error: refreshError } = await supabase.rpc('refresh_unified_trends');
            if (refreshError) throw new Error(refreshError.message);
            result = { success: true, message: 'Unified trends view refreshed' };
            itemsProcessed = 1;
            break;

          case 'analyze_sms_creatives':
            const smsCreativeResponse = await supabase.functions.invoke('analyze-sms-creatives', {
              body: { batch_size: 20 }
            });
            if (smsCreativeResponse.error) throw new Error(smsCreativeResponse.error.message);
            result = smsCreativeResponse.data;
            itemsProcessed = result?.total || 0;
            itemsCreated = result?.analyzed || 0;
            break;

          case 'analyze_meta_creatives':
            const metaCreativeResponse = await supabase.functions.invoke('analyze-meta-creatives', {
              body: { batch_size: 15 }
            });
            if (metaCreativeResponse.error) throw new Error(metaCreativeResponse.error.message);
            result = metaCreativeResponse.data;
            itemsProcessed = result?.total || 0;
            itemsCreated = result?.analyzed || 0;
            break;

          case 'calculate_creative_learnings':
            const learningsResponse = await supabase.functions.invoke('calculate-creative-learnings', {
              body: {}
            });
            if (learningsResponse.error) throw new Error(learningsResponse.error.message);
            result = learningsResponse.data;
            itemsProcessed = result?.creatives_analyzed || 0;
            itemsCreated = result?.learnings_created || 0;
            break;

          case 'fetch_google_news':
            const googleNewsResponse = await supabase.functions.invoke('fetch-google-news', {
              body: {}
            });
            if (googleNewsResponse.error) throw new Error(googleNewsResponse.error.message);
            result = googleNewsResponse.data;
            itemsProcessed = result?.fetched || 0;
            itemsCreated = result?.inserted || 0;
            break;

          case 'batch_analyze_content':
            const batchAnalyzeResponse = await supabase.functions.invoke('batch-analyze-content', {
              body: {}
            });
            if (batchAnalyzeResponse.error) throw new Error(batchAnalyzeResponse.error.message);
            result = batchAnalyzeResponse.data;
            itemsProcessed = result?.processed || 0;
            break;

          case 'calculate_trend_clusters':
            const trendClustersResponse = await supabase.functions.invoke('calculate-trend-clusters', {
              body: {}
            });
            if (trendClustersResponse.error) throw new Error(trendClustersResponse.error.message);
            result = trendClustersResponse.data;
            itemsProcessed = result?.topics_processed || 0;
            itemsCreated = result?.clusters_created || 0;
            break;

          case 'sync_actblue_csv':
            const actblueCsvResponse = await supabase.functions.invoke('sync-actblue-csv', {
              body: job.payload || { mode: 'incremental' }
            });
            if (actblueCsvResponse.error) throw new Error(actblueCsvResponse.error.message);
            result = actblueCsvResponse.data;
            const csvResults = result?.results || [];
            itemsProcessed = csvResults.reduce((sum: number, r: any) => sum + (r.processed || 0), 0);
            itemsCreated = csvResults.reduce((sum: number, r: any) => sum + (r.inserted || 0), 0);
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
        skipped: skipped.length,
        skipped_jobs: skipped,
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
