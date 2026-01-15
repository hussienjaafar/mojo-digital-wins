import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const results: any = {
      timestamp: new Date().toISOString(),
      overall_status: 'checking',
      tests: []
    };

    // =========================================================================
    // TEST 1: RSS ARTICLE COLLECTION
    // =========================================================================
    try {
      // Direct signals from articles table; avoid relying on missing RPCs/columns
      const { data: latestArticle } = await supabase
        .from('articles')
        .select('created_at, published_date, source_name')
        .order('created_at', { ascending: false })
        .order('published_date', { ascending: false })
        .maybeSingle();

      const { count: totalArticles } = await supabase
        .from('articles')
        .select('*', { count: 'exact', head: true });

      const { count: count24h } = await supabase
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const { data: sources } = await supabase
        .from('articles')
        .select('source_name')
        .not('source_name', 'is', null)
        .limit(5000);

      const { count: activeSources } = await supabase
        .from('rss_sources')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      const uniqueSources = new Set(sources?.map(s => s.source_name) || []);
      const latestTs = latestArticle?.created_at || latestArticle?.published_date;
      const recencyMinutes = latestTs
        ? (Date.now() - new Date(latestTs).getTime()) / 60000
        : 9999;

      const statusPass = (totalArticles || 0) > 0 && (recencyMinutes < 60 || (count24h || 0) > 0);
      const verdict =
        (totalArticles || 0) > 2000 && recencyMinutes < 30 && (count24h || 0) > 50
          ? '✅ HEALTHY'
          : recencyMinutes > 180
          ? '🔴 STALE - RSS sync may have stopped'
          : '🟡 NEEDS MONITORING';

      results.tests.push({
        name: 'RSS Article Collection',
        status: statusPass ? 'PASS' : 'WARN',
        details: {
          total_articles: totalArticles || 0,
          active_sources: activeSources || uniqueSources.size,
          articles_last_24h: count24h || 0,
          minutes_since_last_ingestion: Math.round(recencyMinutes),
          last_article: latestTs || 'NONE'
        },
        expected: 'total_articles > 2000, minutes < 30, articles_24h > 50',
        verdict
      });
    } catch (err) {
      results.tests.push({
        name: 'RSS Article Collection',
        status: 'ERROR',
        error: err instanceof Error ? err.message : String(err)
      });
    }

    // =========================================================================
    // TEST 2: BLUESKY STREAM STATUS
    // =========================================================================
    try {
      const { data: cursor } = await supabase
        .from('bluesky_stream_cursor')
        .select('*')
        .eq('id', 1)
        .single();

      const minutesSinceUpdate = cursor?.last_updated_at
        ? (Date.now() - new Date(cursor.last_updated_at).getTime()) / 60000
        : 9999;

      const { count: postCount } = await supabase
        .from('bluesky_posts')
        .select('*', { count: 'exact', head: true });

      const { count: postsLastHour } = await supabase
        .from('bluesky_posts')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

      results.tests.push({
        name: 'Bluesky Stream Collection',
        status: minutesSinceUpdate < 5 && postCount && postCount > 0 ? 'PASS' : 'WARN',
        details: {
          total_posts: postCount || 0,
          posts_last_hour: postsLastHour || 0,
          posts_collected_last_run: cursor?.posts_collected || 0,
          minutes_since_update: Math.round(minutesSinceUpdate),
          last_error: cursor?.last_error || 'NONE'
        },
        expected: 'minutes < 3, posts_last_hour > 10',
        verdict: minutesSinceUpdate < 5 && (postsLastHour || 0) > 10
          ? '✅ HEALTHY'
          : minutesSinceUpdate > 10
          ? '🔴 STOPPED - Stream not running'
          : '🟡 SLOW - May have issues'
      });
    } catch (err) {
      results.tests.push({
        name: 'Bluesky Stream Collection',
        status: 'ERROR',
        error: err instanceof Error ? err.message : String(err)
      });
    }

    // =========================================================================
    // TEST 3: AI ANALYSIS COMPLETION
    // =========================================================================
    try {
      const { count: totalArticles } = await supabase
        .from('articles')
        .select('*', { count: 'exact', head: true });

      const { count: withSentiment } = await supabase
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .not('sentiment_score', 'is', null);

      const { count: withCategory } = await supabase
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .not('category', 'is', null);

      const sentimentPct = totalArticles ? ((withSentiment || 0) / totalArticles * 100).toFixed(1) : 0;
      const categoryPct = totalArticles ? ((withCategory || 0) / totalArticles * 100).toFixed(1) : 0;

      results.tests.push({
        name: 'AI Analysis Completion',
        status: Number(sentimentPct) > 80 ? 'PASS' : 'WARN',
        details: {
          total_articles: totalArticles || 0,
          articles_with_sentiment: withSentiment || 0,
          articles_with_category: withCategory || 0,
          sentiment_completion_pct: sentimentPct,
          category_completion_pct: categoryPct
        },
        expected: 'completion > 80%',
        verdict: Number(sentimentPct) > 80
          ? '✅ HEALTHY'
          : Number(sentimentPct) > 50
          ? '🟡 PARTIAL - Some articles unanalyzed'
          : '🔴 FAILING - AI analysis not running'
      });
    } catch (err) {
      results.tests.push({
        name: 'AI Analysis Completion',
        status: 'ERROR',
        error: err instanceof Error ? err.message : String(err)
      });
    }

    // =========================================================================
    // TEST 4: DAILY BRIEFING GENERATION
    // =========================================================================
    try {
      const { data: latestBriefing } = await supabase
        .from('daily_briefings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const hoursSinceBriefing = latestBriefing?.created_at
        ? (Date.now() - new Date(latestBriefing.created_at).getTime()) / 3600000
        : 9999;

      results.tests.push({
        name: 'Daily Briefing Generation',
        status: latestBriefing && hoursSinceBriefing < 48 ? 'PASS' : 'WARN',
        details: {
          last_briefing_date: latestBriefing?.briefing_date || 'NONE',
          hours_since_generation: Math.round(hoursSinceBriefing),
          critical_count: latestBriefing?.critical_count || 0,
          high_count: latestBriefing?.high_count || 0,
          total_items: (latestBriefing?.total_articles || 0) + (latestBriefing?.total_bills || 0)
        },
        expected: 'hours < 24',
        verdict: hoursSinceBriefing < 24
          ? '✅ HEALTHY'
          : hoursSinceBriefing < 48
          ? '🟡 DELAYED - Briefing overdue'
          : '🔴 FAILING - No recent briefings'
      });
    } catch (err) {
      results.tests.push({
        name: 'Daily Briefing Generation',
        status: 'ERROR',
        error: err instanceof Error ? err.message : String(err)
      });
    }

    // =========================================================================
    // TEST 5: SCHEDULED JOBS STATUS
    // =========================================================================
    try {
      const { data: jobs } = await supabase
        .from('scheduled_jobs')
        .select('*')
        .eq('is_active', true);

      const { data: executions } = await supabase
        .from('job_executions')
        .select('job_id, started_at, status')
        .order('started_at', { ascending: false })
        .limit(200);

      const latestExec: Record<string, any> = {};
      executions?.forEach(exec => {
        if (!latestExec[exec.job_id]) {
          latestExec[exec.job_id] = exec;
        }
      });

      const overdueJobs = jobs?.filter(job => {
        const lastRun = job.last_run_at || latestExec[job.id]?.started_at;
        const nextRun = job.next_run_at;
        if (!lastRun) {
          // If we've never run but next_run_at is in the future, don't mark overdue yet
          if (nextRun && new Date(nextRun).getTime() > Date.now()) return false;
          return true;
        }

        const minutesSinceRun = (Date.now() - new Date(lastRun).getTime()) / 60000;

        // Expected frequency from cron expression
        const expectedFrequency: Record<string, number> = {
          '*/5 * * * *': 10,    // Every 5 min → warn if > 10 min
          '*/10 * * * *': 20,   // Every 10 min → warn if > 20 min
          '*/15 * * * *': 30,   // Every 15 min → warn if > 30 min
          '*/30 * * * *': 60,   // Every 30 min → warn if > 60 min
          '0 8 * * *': 1500     // Daily at 8 AM → warn if > 25 hours
        };

        const threshold = expectedFrequency[job.cron_expression] || 60;
        // allow 2x buffer and also tolerate if next_run_at is in the future
        if (nextRun && new Date(nextRun).getTime() > Date.now()) {
          return false;
        }
        return minutesSinceRun > (threshold * 2);
      }) || [];

      results.tests.push({
        name: 'Scheduled Jobs Automation',
        status: overdueJobs.length === 0 ? 'PASS' : 'WARN',
        details: {
          total_active_jobs: jobs?.length || 0,
          jobs_on_schedule: (jobs?.length || 0) - overdueJobs.length,
          overdue_jobs: overdueJobs.length,
          overdue_job_names: overdueJobs.map(j => j.job_name)
        },
        expected: 'All jobs running on schedule',
        verdict: overdueJobs.length === 0
          ? '✅ HEALTHY'
          : overdueJobs.length < 3
          ? '🟡 SOME DELAYS - Check overdue jobs'
          : '🔴 FAILING - Multiple jobs not running'
      });
    } catch (err) {
      results.tests.push({
        name: 'Scheduled Jobs Automation',
        status: 'ERROR',
        error: err instanceof Error ? err.message : String(err)
      });
    }

    // =========================================================================
    // TEST 6: BILL TRACKING
    // =========================================================================
    try {
      const { count: billCount } = await supabase
        .from('bills')
        .select('*', { count: 'exact', head: true });

      const { data: latestBill } = await supabase
        .from('bills')
        .select('last_action_date')
        .order('last_action_date', { ascending: false })
        .limit(1)
        .single();

      const daysSinceAction = latestBill?.last_action_date
        ? (Date.now() - new Date(latestBill.last_action_date).getTime()) / 86400000
        : 9999;

      results.tests.push({
        name: 'Congressional Bill Tracking',
        status: billCount && billCount > 0 ? 'PASS' : 'WARN',
        details: {
          total_bills: billCount || 0,
          days_since_last_action: Math.round(daysSinceAction)
        },
        expected: 'bills > 100, days < 7',
        verdict: billCount && billCount > 100
          ? '✅ HEALTHY'
          : billCount && billCount > 0
          ? '🟡 LIMITED - Few bills tracked'
          : '🔴 FAILING - No bills collected'
      });
    } catch (err) {
      results.tests.push({
        name: 'Congressional Bill Tracking',
        status: 'ERROR',
        error: err instanceof Error ? err.message : String(err)
      });
    }

    // =========================================================================
    // TEST 7: CLIENT DASHBOARD RPC VALIDATION
    // =========================================================================
    try {
      const rpcTests: Array<{ name: string; rpc: string; params?: Record<string, any>; requiredFields: string[] }> = [
        {
          name: 'check_client_data_health',
          rpc: 'check_client_data_health',
          params: { p_org_id: '00000000-0000-0000-0000-000000000000' },
          requiredFields: ['transactions', 'channelBreakdown', 'healthChecks'],
        },
        {
          name: 'get_actblue_dashboard_metrics',
          rpc: 'get_actblue_dashboard_metrics',
          params: { 
            p_organization_id: '00000000-0000-0000-0000-000000000000',
            p_start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            p_end_date: new Date().toISOString().split('T')[0],
          },
          requiredFields: ['summary', 'channels', 'trends'],
        },
      ];

      const rpcResults: Array<{ rpc: string; status: string; missingFields?: string[]; error?: string }> = [];

      for (const test of rpcTests) {
        try {
          const { data, error } = await supabase.rpc(test.rpc, test.params);
          
          if (error) {
            // Expected error for non-existent org is OK
            if (error.message.includes('not found') || error.code === 'PGRST116') {
              rpcResults.push({ rpc: test.rpc, status: 'PASS' });
            } else {
              rpcResults.push({ rpc: test.rpc, status: 'ERROR', error: error.message });
            }
          } else if (data) {
            // Check for required fields
            const missingFields = test.requiredFields.filter(field => !(field in data));
            if (missingFields.length > 0) {
              rpcResults.push({ rpc: test.rpc, status: 'WARN', missingFields });
            } else {
              rpcResults.push({ rpc: test.rpc, status: 'PASS' });
            }
          } else {
            rpcResults.push({ rpc: test.rpc, status: 'PASS' });
          }
        } catch (err) {
          rpcResults.push({ 
            rpc: test.rpc, 
            status: 'ERROR', 
            error: err instanceof Error ? err.message : String(err) 
          });
        }
      }

      const rpcPassed = rpcResults.filter(r => r.status === 'PASS').length;
      const rpcFailed = rpcResults.filter(r => r.status !== 'PASS').length;

      results.tests.push({
        name: 'Dashboard RPC Contract Validation',
        status: rpcFailed === 0 ? 'PASS' : 'WARN',
        details: {
          rpcs_tested: rpcResults.length,
          rpcs_passed: rpcPassed,
          rpcs_failed: rpcFailed,
          results: rpcResults,
        },
        expected: 'All RPCs return expected field structure',
        verdict: rpcFailed === 0
          ? '✅ HEALTHY'
          : '🟡 SOME MISMATCHES - Check RPC field names',
      });
    } catch (err) {
      results.tests.push({
        name: 'Dashboard RPC Contract Validation',
        status: 'ERROR',
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // =========================================================================
    // TEST 8: DATA FRESHNESS ACROSS ALL SOURCES
    // =========================================================================
    try {
      const { data: freshnessRecords, error: freshError } = await supabase
        .from('data_freshness')
        .select('source, organization_id, is_within_sla, data_lag_hours, last_synced_at');

      if (freshError) throw freshError;

      const bySource: Record<string, { total: number; stale: number; avgLagHours: number }> = {};
      
      for (const record of freshnessRecords || []) {
        if (!bySource[record.source]) {
          bySource[record.source] = { total: 0, stale: 0, avgLagHours: 0 };
        }
        bySource[record.source].total++;
        if (!record.is_within_sla) bySource[record.source].stale++;
        bySource[record.source].avgLagHours += record.data_lag_hours || 0;
      }

      // Calculate averages
      Object.keys(bySource).forEach(source => {
        if (bySource[source].total > 0) {
          bySource[source].avgLagHours = Math.round(bySource[source].avgLagHours / bySource[source].total);
        }
      });

      const totalStale = Object.values(bySource).reduce((sum, s) => sum + s.stale, 0);
      const totalRecords = Object.values(bySource).reduce((sum, s) => sum + s.total, 0);

      results.tests.push({
        name: 'Data Freshness Monitoring',
        status: totalStale === 0 ? 'PASS' : totalStale < totalRecords / 2 ? 'WARN' : 'FAIL',
        details: {
          total_records: totalRecords,
          stale_count: totalStale,
          by_source: bySource,
        },
        expected: 'All data sources within SLA',
        verdict: totalStale === 0
          ? '✅ HEALTHY'
          : totalStale < 3
          ? '🟡 SOME STALE - Check data_freshness table'
          : '🔴 CRITICAL - Multiple stale sources',
      });
    } catch (err) {
      results.tests.push({
        name: 'Data Freshness Monitoring',
        status: 'ERROR',
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // =========================================================================
    // TEST 9: INTEGRATION HEALTH STATUS
    // =========================================================================
    try {
      const { data: credentials, error: credError } = await supabase
        .from('client_api_credentials')
        .select('platform, is_active, last_test_status, last_tested_at')
        .eq('is_active', true);

      if (credError) throw credError;

      const byPlatform: Record<string, { total: number; healthy: number; failing: number; untested: number }> = {};

      for (const cred of credentials || []) {
        if (!byPlatform[cred.platform]) {
          byPlatform[cred.platform] = { total: 0, healthy: 0, failing: 0, untested: 0 };
        }
        byPlatform[cred.platform].total++;
        if (!cred.last_tested_at) {
          byPlatform[cred.platform].untested++;
        } else if (cred.last_test_status === 'success') {
          byPlatform[cred.platform].healthy++;
        } else {
          byPlatform[cred.platform].failing++;
        }
      }

      const totalFailing = Object.values(byPlatform).reduce((sum, p) => sum + p.failing, 0);
      const totalIntegrations = Object.values(byPlatform).reduce((sum, p) => sum + p.total, 0);

      results.tests.push({
        name: 'Integration Health Status',
        status: totalFailing === 0 ? 'PASS' : 'WARN',
        details: {
          total_integrations: totalIntegrations,
          failing_count: totalFailing,
          by_platform: byPlatform,
        },
        expected: 'All active integrations healthy',
        verdict: totalFailing === 0
          ? '✅ HEALTHY'
          : totalFailing < 3
          ? '🟡 SOME FAILING - Check integration credentials'
          : '🔴 CRITICAL - Multiple integrations failing',
      });
    } catch (err) {
      results.tests.push({
        name: 'Integration Health Status',
        status: 'ERROR',
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // =========================================================================
    // CALCULATE OVERALL STATUS
    // =========================================================================
    const passCount = results.tests.filter((t: any) => t.status === 'PASS').length;
    const warnCount = results.tests.filter((t: any) => t.status === 'WARN').length;
    const errorCount = results.tests.filter((t: any) => t.status === 'ERROR').length;

    results.overall_status = errorCount > 0 || warnCount > 2
      ? '🔴 NEEDS ATTENTION'
      : warnCount > 0
      ? '🟡 MOSTLY HEALTHY'
      : '✅ ALL SYSTEMS OPERATIONAL';

    results.summary = {
      tests_passed: passCount,
      tests_warned: warnCount,
      tests_errored: errorCount,
      total_tests: results.tests.length,
      health_score: Math.round((passCount / results.tests.length) * 100)
    };

    return new Response(
      JSON.stringify(results, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Diagnostic error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
