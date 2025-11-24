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
      const { data: articleStats, error } = await supabase.rpc('get_article_stats');

      if (!articleStats) {
        // Fallback to direct query
        const { data: articles } = await supabase
          .from('articles')
          .select('id, created_at, published_date, source_name', { count: 'exact' })
          .order('created_at', { ascending: false })
          .limit(1);

        const { count } = await supabase
          .from('articles')
          .select('*', { count: 'exact', head: true });

        const { count: count24h } = await supabase
          .from('articles')
          .select('*', { count: 'exact', head: true })
          .gte('published_date', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        const { data: sources } = await supabase
          .from('articles')
          .select('source_name')
          .limit(2000);

        const { count: activeSources } = await supabase
          .from('rss_sources')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);

        const uniqueSources = new Set(sources?.map(s => s.source_name) || []);
        const minutesSinceIngestion = (() => {
          const ts = articles?.[0]?.created_at || articles?.[0]?.published_date;
          return ts ? (Date.now() - new Date(ts).getTime()) / 60000 : 9999;
        })();

        results.tests.push({
          name: 'RSS Article Collection',
          status: count && count > 0 && minutesSinceIngestion < 60 ? 'PASS' : 'WARN',
          details: {
            total_articles: count || 0,
            active_sources: activeSources || uniqueSources.size,
            articles_last_24h: count24h || 0,
            minutes_since_last_ingestion: Math.round(minutesSinceIngestion),
            last_article: articles?.[0]?.created_at || articles?.[0]?.published_date || 'NONE'
          },
          expected: 'total_articles > 2000, minutes < 30, articles_24h > 50',
          verdict: count && count > 2000 && minutesSinceIngestion < 30 && (count24h || 0) > 50
            ? '✅ HEALTHY'
            : minutesSinceIngestion > 180
            ? '🔴 STALE - RSS sync may have stopped'
            : '🟡 NEEDS MONITORING'
        });
      }
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

      const overdueJobs = jobs?.filter(job => {
        if (!job.last_run_at) return true;

        const minutesSinceRun = (Date.now() - new Date(job.last_run_at).getTime()) / 60000;

        // Expected frequency from cron expression
        const expectedFrequency: Record<string, number> = {
          '*/5 * * * *': 10,    // Every 5 min → warn if > 10 min
          '*/10 * * * *': 20,   // Every 10 min → warn if > 20 min
          '*/15 * * * *': 30,   // Every 15 min → warn if > 30 min
          '*/30 * * * *': 60,   // Every 30 min → warn if > 60 min
          '0 8 * * *': 1500     // Daily at 8 AM → warn if > 25 hours
        };

        const threshold = expectedFrequency[job.cron_expression] || 60;
        return minutesSinceRun > threshold;
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
