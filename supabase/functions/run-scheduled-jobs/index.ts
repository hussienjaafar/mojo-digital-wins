import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

// SECURITY: Restrict CORS to known origins
const ALLOWED_ORIGINS = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || [];
const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0] || 'https://lovable.dev',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // SECURITY: Require authentication via JWT or cron secret
    const authHeader = req.headers.get('Authorization');
    const cronSecret = req.headers.get('X-Cron-Secret') || req.headers.get('x-cron-secret');
    const expectedCronSecret = Deno.env.get('CRON_SECRET');

    let isAuthorized = false;
    let userId: string | null = null;

    // Check cron secret first (for scheduled invocations)
    if (cronSecret && expectedCronSecret && cronSecret === expectedCronSecret) {
      isAuthorized = true;
      console.log('[SCHEDULER] Authorized via cron secret');
    } 
    // Otherwise check JWT
    else if (authHeader && authHeader.startsWith('Bearer ')) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false }
      });

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!authError && user) {
        // Verify user is admin
        const { data: isAdmin } = await supabase.rpc('has_role', {
          _user_id: user.id,
          _role: 'admin'
        });

        if (isAdmin) {
          isAuthorized = true;
          userId = user.id;
          console.log('[SCHEDULER] Authorized via admin JWT:', user.id);
        }
      }
    }

    if (!isAuthorized) {
      console.error('[SECURITY] Unauthorized access attempt to run-scheduled-jobs');
      return new Response(
        JSON.stringify({ error: 'Authentication required (admin or cron secret)' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for job execution
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const body = await req.json().catch(() => ({}));
    const jobType = body.job_type;
    const forceRun = body.force || false;

    console.log(`[SCHEDULER] Running jobs${jobType ? ` (type: ${jobType})` : ''}${userId ? ` by user ${userId}` : ''}`);

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
          console.log(`[SCHEDULER] Skipping ${job.job_name}: waiting for dependencies ${missingDeps.join(', ')}`);
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
          console.log(`[SCHEDULER] Skipping ${job.job_name}: no new data in ${skipConfig.table}`);
          skipped.push(job.job_name);
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

        console.log(`[SCHEDULER] Running job: ${job.job_name} (${job.job_type})`);

        // Run the appropriate function based on job type
        let result: any = null;
        let itemsProcessed = 0;
        let itemsCreated = 0;

        switch (job.job_type) {
          case 'fetch_rss':
            const rssResponse = await supabase.functions.invoke('fetch-rss-feeds', { body: {} });
            if (rssResponse.error) throw new Error(rssResponse.error.message);
            result = rssResponse.data;
            itemsProcessed = result?.processed || 0;
            itemsCreated = result?.inserted || 0;
            break;

          case 'fetch_executive_orders':
            const eoResponse = await supabase.functions.invoke('fetch-executive-orders', { body: {} });
            if (eoResponse.error) throw new Error(eoResponse.error.message);
            result = eoResponse.data;
            itemsProcessed = result?.fetched || 0;
            itemsCreated = result?.inserted || 0;
            break;

          case 'track_state_actions':
            const saResponse = await supabase.functions.invoke('track-state-actions', { body: { action: 'fetch_all' } });
            if (saResponse.error) throw new Error(saResponse.error.message);
            result = saResponse.data;
            itemsProcessed = result?.total_fetched || 0;
            itemsCreated = result?.total_inserted || 0;
            break;

          case 'smart_alerting':
            const alertResponse = await supabase.functions.invoke('smart-alerting', { body: { action: 'full' } });
            if (alertResponse.error) throw new Error(alertResponse.error.message);
            result = alertResponse.data;
            itemsProcessed = result?.results?.daily_briefing?.critical || 0;
            break;

          case 'send_briefings':
            const briefingResponse = await supabase.functions.invoke('send-daily-briefing', { body: {} });
            if (briefingResponse.error) throw new Error(briefingResponse.error.message);
            result = briefingResponse.data;
            itemsProcessed = result?.emails_sent || 0;
            break;

          case 'analyze_articles':
            const analyzeResponse = await supabase.functions.invoke('analyze-articles', { body: {} });
            if (analyzeResponse.error) throw new Error(analyzeResponse.error.message);
            result = analyzeResponse.data;
            itemsProcessed = result?.processed || 0;
            itemsCreated = result?.analyzed || 0;
            break;

          case 'extract_trending_topics':
            const trendingResponse = await supabase.functions.invoke('extract-trending-topics', { body: {} });
            if (trendingResponse.error) throw new Error(trendingResponse.error.message);
            result = trendingResponse.data;
            itemsProcessed = result?.topicsExtracted || 0;
            break;

          case 'analyze_bluesky':
            const analyzeBlueskyResponse = await supabase.functions.invoke('analyze-bluesky-posts', { body: {} });
            if (analyzeBlueskyResponse.error) throw new Error(analyzeBlueskyResponse.error.message);
            result = analyzeBlueskyResponse.data;
            itemsProcessed = result?.processed || 0;
            itemsCreated = result?.analyzed || 0;
            break;

          case 'calculate_bluesky_trends':
            const calcTrendsResponse = await supabase.functions.invoke('calculate-bluesky-trends', { body: {} });
            if (calcTrendsResponse.error) throw new Error(calcTrendsResponse.error.message);
            result = calcTrendsResponse.data;
            itemsProcessed = result?.trends_updated || result?.length || 0;
            break;

          case 'correlate_social_news':
            const correlateResponse = await supabase.functions.invoke('correlate-social-news', { body: {} });
            if (correlateResponse.error) throw new Error(correlateResponse.error.message);
            result = correlateResponse.data;
            itemsProcessed = result?.trends_analyzed || 0;
            itemsCreated = result?.correlations_found || 0;
            break;

          case 'aggregate_sentiment':
            const sentimentResponse = await supabase.functions.invoke('aggregate-sentiment', { body: {} });
            if (sentimentResponse.error) throw new Error(sentimentResponse.error.message);
            result = sentimentResponse.data;
            itemsProcessed = result?.snapshots_created || 0;
            break;

          case 'detect_anomalies':
            const anomalyResponse = await supabase.functions.invoke('detect-anomalies', { body: {} });
            if (anomalyResponse.error) throw new Error(anomalyResponse.error.message);
            result = anomalyResponse.data;
            itemsProcessed = result?.anomalies_detected || 0;
            break;

          case 'cleanup_cache':
            const cleanupResponse = await supabase.functions.invoke('cleanup-old-cache', { body: {} });
            if (cleanupResponse.error) throw new Error(cleanupResponse.error.message);
            result = cleanupResponse.data;
            itemsProcessed = result?.deleted || 0;
            break;

          case 'collect_bluesky':
          case 'bluesky_stream_keepalive':
            const collectBlueskyResponse = await supabase.functions.invoke('bluesky-stream', { body: { durationMs: 45000 } });
            if (collectBlueskyResponse.error) throw new Error(collectBlueskyResponse.error.message);
            result = collectBlueskyResponse.data;
            itemsProcessed = result?.postsCollected || 0;
            itemsCreated = result?.postsCollected || 0;
            break;

          case 'calculate_news_trends':
            const newsTrendsResponse = await supabase.functions.invoke('calculate-news-trends', { body: {} });
            if (newsTrendsResponse.error) throw new Error(newsTrendsResponse.error.message);
            result = newsTrendsResponse.data;
            itemsProcessed = result?.topics_updated || 0;
            itemsCreated = result?.trending_count || 0;
            break;

          case 'detect_spikes':
            const spikesResponse = await supabase.functions.invoke('detect-spikes', { body: {} });
            if (spikesResponse.error) throw new Error(spikesResponse.error.message);
            result = spikesResponse.data;
            itemsProcessed = result?.spikes_detected || 0;
            break;

          case 'detect_breaking_news':
            const breakingNewsResponse = await supabase.functions.invoke('detect-breaking-news', { body: {} });
            if (breakingNewsResponse.error) throw new Error(breakingNewsResponse.error.message);
            result = breakingNewsResponse.data;
            itemsProcessed = result?.clusters_found || 0;
            break;

          case 'send_spike_alerts':
            const alertsResponse = await supabase.functions.invoke('send-spike-alerts', { body: {} });
            if (alertsResponse.error) throw new Error(alertsResponse.error.message);
            result = alertsResponse.data;
            itemsProcessed = result?.alerts_processed || 0;
            itemsCreated = result?.emails_sent || 0;
            break;

          case 'calculate_entity_trends':
            const entityTrendsResponse = await supabase.functions.invoke('calculate-entity-trends', { body: {} });
            if (entityTrendsResponse.error) throw new Error(entityTrendsResponse.error.message);
            result = entityTrendsResponse.data;
            itemsProcessed = result?.entities_processed || 0;
            itemsCreated = result?.trends_updated || 0;
            break;

          case 'match_entity_watchlist':
            const watchlistResponse = await supabase.functions.invoke('match-entity-watchlist', { body: {} });
            if (watchlistResponse.error) throw new Error(watchlistResponse.error.message);
            result = watchlistResponse.data;
            itemsProcessed = result?.entities_checked || 0;
            itemsCreated = result?.alerts_created || 0;
            break;

          case 'generate_suggested_actions':
            const actionsResponse = await supabase.functions.invoke('generate-suggested-actions', { body: {} });
            if (actionsResponse.error) throw new Error(actionsResponse.error.message);
            result = actionsResponse.data;
            itemsProcessed = result?.alerts_analyzed || 0;
            itemsCreated = result?.actions_generated || 0;
            break;

          case 'detect_fundraising_opportunities':
            const opportunitiesResponse = await supabase.functions.invoke('detect-fundraising-opportunities', { body: {} });
            if (opportunitiesResponse.error) throw new Error(opportunitiesResponse.error.message);
            result = opportunitiesResponse.data;
            itemsProcessed = result?.trends_analyzed || 0;
            itemsCreated = result?.opportunities_found || 0;
            break;

          case 'track_event_impact':
            const impactResponse = await supabase.functions.invoke('track-event-impact', { body: {} });
            if (impactResponse.error) throw new Error(impactResponse.error.message);
            result = impactResponse.data;
            itemsProcessed = result?.events_tracked || 0;
            break;

          case 'attribution':
          case 'edge_function':
            // Handle edge_function job types - invoke the function named in the endpoint field
            if (job.job_type === 'edge_function' && job.endpoint) {
              console.log(`[SCHEDULER] Invoking edge function: ${job.endpoint}`);
              const payload = job.payload ? JSON.parse(job.payload) : {};
              const efResponse = await supabase.functions.invoke(job.endpoint, { body: payload });
              if (efResponse.error) throw new Error(efResponse.error.message);
              result = efResponse.data;
              itemsProcessed = result?.processed || result?.attributions_created || result?.predictions_created || result?.journeys_created || 0;
              break;
            }
            // Fallback for legacy 'attribution' job type
            const attributionResponse = await supabase.functions.invoke('calculate-attribution', { body: {} });
            if (attributionResponse.error) throw new Error(attributionResponse.error.message);
            result = attributionResponse.data;
            itemsProcessed = result?.touchpoints_analyzed || result?.attributions_created || 0;
            break;
          
          case 'calculate_attribution':
            const calcAttrResponse = await supabase.functions.invoke('calculate-attribution', { body: { days_back: 90 } });
            if (calcAttrResponse.error) throw new Error(calcAttrResponse.error.message);
            result = calcAttrResponse.data;
            itemsProcessed = result?.attributions_created || 0;
            break;

          case 'populate_donor_journeys':
            // Populate donor journeys for all active organizations
            const { data: journeyOrgs } = await supabase
              .from('client_organizations')
              .select('id')
              .eq('is_active', true);
            
            let journeysCreated = 0;
            for (const org of journeyOrgs || []) {
              const journeyResponse = await supabase.functions.invoke('populate-donor-journeys', {
                body: { organization_id: org.id, days_back: 90 }
              });
              if (!journeyResponse.error) {
                journeysCreated += journeyResponse.data?.journeys_created || 0;
              }
            }
            result = { journeys_created: journeysCreated, organizations: journeyOrgs?.length || 0 };
            itemsProcessed = journeysCreated;
            break;

          case 'calculate_donor_ltv':
            // Calculate LTV for all active organizations
            const { data: ltvOrgs } = await supabase
              .from('client_organizations')
              .select('id')
              .eq('is_active', true);
            
            let predictionsCreated = 0;
            for (const org of ltvOrgs || []) {
              const ltvResponse = await supabase.functions.invoke('calculate-donor-ltv', {
                body: { organization_id: org.id }
              });
              if (!ltvResponse.error) {
                predictionsCreated += ltvResponse.data?.predictions_created || 0;
              }
            }
            result = { predictions_created: predictionsCreated, organizations: ltvOrgs?.length || 0 };
            itemsProcessed = predictionsCreated;
            break;

          case 'polling':
            const pollingResponse = await supabase.functions.invoke('fetch-polling-data', { body: {} });
            if (pollingResponse.error) throw new Error(pollingResponse.error.message);
            result = pollingResponse.data;
            itemsProcessed = result?.polls_fetched || 0;
            itemsCreated = result?.polls_inserted || 0;
            break;

          case 'sync':
          case 'sync_actblue_csv':
            console.log('[SCHEDULER] Running ActBlue CSV sync');
            const actblueResponse = await supabase.functions.invoke('sync-actblue-csv', { body: { mode: 'incremental' } });
            if (actblueResponse.error) throw new Error(actblueResponse.error.message);
            result = actblueResponse.data;
            itemsProcessed = result?.results?.length || result?.processed || 0;
            itemsCreated = result?.results?.reduce((sum: number, r: any) => sum + (r.inserted || 0), 0) || 0;
            break;

          case 'sync_meta_ads':
            console.log('[SCHEDULER] Running tiered Meta Ads sync');
            // CRITICAL: Pass the cron secret so tiered-meta-sync can authenticate
            const cronSecretForMeta = Deno.env.get('CRON_SECRET');
            const tieredSyncResponse = await supabase.functions.invoke('tiered-meta-sync', { 
              body: {},
              headers: cronSecretForMeta ? { 'x-cron-secret': cronSecretForMeta } : {}
            });
            if (tieredSyncResponse.error) {
              console.error('[SCHEDULER] tiered-meta-sync error:', tieredSyncResponse.error);
              throw new Error(tieredSyncResponse.error.message);
            }
            result = tieredSyncResponse.data;
            itemsProcessed = result?.accounts_synced || 0;
            itemsCreated = result?.accounts_synced || 0;
            break;

          case 'sync_switchboard_sms':
            console.log('[SCHEDULER] Running Switchboard SMS sync');
            const { data: smsOrgs } = await supabase
              .from('client_api_credentials')
              .select('organization_id')
              .eq('platform', 'switchboard')
              .eq('is_active', true);

            let smsProcessed = 0;
            for (const org of smsOrgs || []) {
              const smsResponse = await supabase.functions.invoke('sync-switchboard-sms', {
                body: { organization_id: org.organization_id }
              });
              if (!smsResponse.error) smsProcessed++;
            }
            result = { organizations_synced: smsProcessed };
            itemsProcessed = smsProcessed;
            break;

          default:
            console.log(`[SCHEDULER] Unknown job type: ${job.job_type}`);
            result = { skipped: true, reason: 'Unknown job type' };
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
              result_summary: result,
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
          job_type: job.job_type,
          status: 'success',
          duration_ms: duration,
          items_processed: itemsProcessed,
          items_created: itemsCreated,
        });

        console.log(`[SCHEDULER] Job ${job.job_name} completed in ${duration}ms`);

      } catch (jobError: any) {
        const duration = Date.now() - startTime;
        console.error(`[SCHEDULER] Job ${job.job_name} failed:`, jobError);

        // Update execution record with error
        if (executionId) {
          await supabase
            .from('job_executions')
            .update({
              status: 'failed',
              completed_at: new Date().toISOString(),
              duration_ms: duration,
              error_message: jobError.message,
            })
            .eq('id', executionId);
        }

        // Update job status with error
        await supabase.rpc('update_job_after_execution', {
          p_job_id: job.id,
          p_status: 'failed',
          p_duration_ms: duration,
          p_error: jobError.message,
        });

        // Log job failure
        await supabase.rpc('log_job_failure', {
          p_function_name: job.job_type,
          p_error_message: jobError.message,
          p_error_stack: jobError.stack,
          p_context: { job_id: job.id, job_name: job.job_name },
        });

        results.push({
          job_name: job.job_name,
          job_type: job.job_type,
          status: 'failed',
          error: jobError.message,
          duration_ms: duration,
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const failedCount = results.filter(r => r.status === 'failed').length;

    console.log(`[SCHEDULER] Completed: ${successCount} success, ${failedCount} failed, ${skipped.length} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        jobs_run: results.length,
        jobs_skipped: skipped.length,
        success_count: successCount,
        failed_count: failedCount,
        results,
        skipped,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[SCHEDULER] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
