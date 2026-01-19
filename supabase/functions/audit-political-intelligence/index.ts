import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Finding {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  category: string;
  message: string;
  details?: Record<string, unknown>;
  remediation?: string;
}

interface PhaseResult {
  phase: number;
  name: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  findings: Finding[];
  metrics: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const phases: PhaseResult[] = [];
  const allFindings: Finding[] = [];

  // ========== PHASE 1: Data Freshness & SLA ==========
  const phase1Findings: Finding[] = [];
  const phase1Metrics: Record<string, unknown> = {};

  // Check trend_events freshness
  const { data: latestTrend, error: trendError } = await supabase
    .from('trend_events')
    .select('id, topic, detected_at, source_type')
    .order('detected_at', { ascending: false })
    .limit(1)
    .single();

  if (trendError || !latestTrend) {
    phase1Findings.push({
      severity: 'CRITICAL',
      category: 'Data Freshness',
      message: 'No trend_events found in database',
      remediation: 'Run batch-analyze-content and calculate-entity-trends functions'
    });
    phase1Metrics.latest_trend = null;
  } else {
    const trendAge = Date.now() - new Date(latestTrend.detected_at).getTime();
    const trendAgeMinutes = Math.round(trendAge / 60000);
    phase1Metrics.latest_trend = {
      id: latestTrend.id,
      topic: latestTrend.topic,
      detected_at: latestTrend.detected_at,
      age_minutes: trendAgeMinutes
    };

    if (trendAgeMinutes > 60) {
      phase1Findings.push({
        severity: 'HIGH',
        category: 'Data Freshness',
        message: `Latest trend is ${trendAgeMinutes} minutes old (SLA: <60 min)`,
        remediation: 'Check if cron jobs are running'
      });
    } else if (trendAgeMinutes > 30) {
      phase1Findings.push({
        severity: 'MEDIUM',
        category: 'Data Freshness',
        message: `Latest trend is ${trendAgeMinutes} minutes old`,
      });
    }
  }

  // Check articles freshness
  const { data: latestArticle } = await supabase
    .from('articles')
    .select('id, title, published_date, source_name')
    .order('published_date', { ascending: false })
    .limit(1)
    .single();

  if (latestArticle) {
    const articleAge = Date.now() - new Date(latestArticle.published_date).getTime();
    phase1Metrics.latest_article = {
      title: latestArticle.title?.substring(0, 50),
      published_date: latestArticle.published_date,
      age_minutes: Math.round(articleAge / 60000)
    };
  }

  // Check bluesky_posts freshness
  const { data: latestPost } = await supabase
    .from('bluesky_posts')
    .select('id, created_at, author_handle')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (latestPost) {
    const postAge = Date.now() - new Date(latestPost.created_at).getTime();
    phase1Metrics.latest_bluesky_post = {
      created_at: latestPost.created_at,
      age_minutes: Math.round(postAge / 60000)
    };
  }

  // Get total counts
  const { count: trendCount } = await supabase.from('trend_events').select('*', { count: 'exact', head: true });
  const { count: articleCount } = await supabase.from('articles').select('*', { count: 'exact', head: true });
  const { count: postCount } = await supabase.from('bluesky_posts').select('*', { count: 'exact', head: true });

  phase1Metrics.total_counts = {
    trend_events: trendCount,
    articles: articleCount,
    bluesky_posts: postCount
  };

  phases.push({
    phase: 1,
    name: 'Data Freshness & SLA',
    status: phase1Findings.some(f => f.severity === 'CRITICAL') ? 'FAIL' : 
            phase1Findings.some(f => f.severity === 'HIGH') ? 'WARN' : 'PASS',
    findings: phase1Findings,
    metrics: phase1Metrics
  });
  allFindings.push(...phase1Findings);

  // ========== PHASE 2: Pipeline Operations ==========
  const phase2Findings: Finding[] = [];
  const phase2Metrics: Record<string, unknown> = {};

  // Check job_executions for recent runs
  const { data: recentJobs } = await supabase
    .from('job_executions')
    .select('job_name, status, started_at, finished_at, error_message')
    .order('started_at', { ascending: false })
    .limit(20);

  if (!recentJobs || recentJobs.length === 0) {
    phase2Findings.push({
      severity: 'HIGH',
      category: 'Pipeline',
      message: 'No job executions found - scheduler may not be running',
      remediation: 'Verify run-scheduled-jobs cron is configured'
    });
  } else {
    const failedJobs = recentJobs.filter(j => j.status === 'failed');
    if (failedJobs.length > 0) {
      phase2Findings.push({
        severity: 'MEDIUM',
        category: 'Pipeline',
        message: `${failedJobs.length} failed jobs in recent executions`,
        details: { failed_jobs: failedJobs.slice(0, 3) }
      });
    }
  }

  phase2Metrics.recent_jobs = recentJobs?.slice(0, 5) || [];

  // Check scheduled_jobs configuration
  const { data: scheduledJobs } = await supabase
    .from('scheduled_jobs')
    .select('*')
    .eq('is_active', true);

  phase2Metrics.active_scheduled_jobs = scheduledJobs?.length || 0;
  phase2Metrics.scheduled_jobs = scheduledJobs?.map(j => ({
    name: j.job_name,
    type: j.job_type,
    interval: j.interval_seconds
  })) || [];

  phases.push({
    phase: 2,
    name: 'Pipeline Operations',
    status: phase2Findings.some(f => f.severity === 'CRITICAL') ? 'FAIL' : 
            phase2Findings.some(f => f.severity === 'HIGH') ? 'WARN' : 'PASS',
    findings: phase2Findings,
    metrics: phase2Metrics
  });
  allFindings.push(...phase2Findings);

  // ========== PHASE 3: Source Integration ==========
  const phase3Findings: Finding[] = [];
  const phase3Metrics: Record<string, unknown> = {};

  // Check RSS sources
  const { data: rssSources } = await supabase
    .from('rss_sources')
    .select('*')
    .eq('is_active', true);

  phase3Metrics.active_rss_sources = rssSources?.length || 0;

  if (!rssSources || rssSources.length === 0) {
    phase3Findings.push({
      severity: 'HIGH',
      category: 'Sources',
      message: 'No active RSS sources configured',
      remediation: 'Add RSS sources to rss_sources table'
    });
  }

  // Check Google News items
  const { count: gnewsCount } = await supabase
    .from('google_news_items')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  phase3Metrics.google_news_items_24h = gnewsCount;

  phases.push({
    phase: 3,
    name: 'Source Integration',
    status: phase3Findings.some(f => f.severity === 'CRITICAL') ? 'FAIL' : 
            phase3Findings.some(f => f.severity === 'HIGH') ? 'WARN' : 'PASS',
    findings: phase3Findings,
    metrics: phase3Metrics
  });
  allFindings.push(...phase3Findings);

  // ========== PHASE 4: UI Data Flow (CRITICAL) ==========
  const phase4Findings: Finding[] = [];
  const phase4Metrics: Record<string, unknown> = {};

  // Simulate what the UI fetches - base query
  const { data: uiTrends, error: uiError } = await supabase
    .from('trend_events')
    .select('id, topic, detected_at, source_type, velocity, velocity_1h, velocity_6h, velocity_24h, mentions_1h, mentions_6h, mentions_24h, sentiment_score, is_trending, confidence_score, priority_bucket, relevance_score')
    .order('detected_at', { ascending: false })
    .limit(100);

  phase4Metrics.total_fetched = uiTrends?.length || 0;

  if (uiError) {
    phase4Findings.push({
      severity: 'CRITICAL',
      category: 'UI Data Flow',
      message: `Error fetching trends: ${uiError.message}`,
    });
  } else if (!uiTrends || uiTrends.length === 0) {
    phase4Findings.push({
      severity: 'CRITICAL',
      category: 'UI Data Flow',
      message: 'No trends returned from base query',
      remediation: 'Check if trend_events table has data and RLS policies allow access'
    });
  } else {
    // Analyze what would pass the actionability filter
    // UI uses: velocity > 0 OR is_trending = true
    const actionable = uiTrends.filter(t => 
      (t.velocity && t.velocity > 0) || 
      (t.velocity_1h && t.velocity_1h > 0) ||
      t.is_trending === true
    );

    phase4Metrics.would_display_in_ui = actionable.length;
    phase4Metrics.filtered_out = uiTrends.length - actionable.length;

    if (actionable.length === 0) {
      phase4Findings.push({
        severity: 'CRITICAL',
        category: 'UI Data Flow',
        message: 'All trends filtered out by actionability check (velocity=0, is_trending=false)',
        details: {
          sample_trends: uiTrends.slice(0, 3).map(t => ({
            topic: t.topic,
            velocity: t.velocity,
            velocity_1h: t.velocity_1h,
            is_trending: t.is_trending
          }))
        },
        remediation: 'Run calculate-entity-trends or calculate-news-trends to compute velocity metrics'
      });
    }

    // Confidence score distribution
    const confidenceDistribution = {
      high: uiTrends.filter(t => t.confidence_score && t.confidence_score >= 0.7).length,
      medium: uiTrends.filter(t => t.confidence_score && t.confidence_score >= 0.4 && t.confidence_score < 0.7).length,
      low: uiTrends.filter(t => t.confidence_score && t.confidence_score > 0 && t.confidence_score < 0.4).length,
      null: uiTrends.filter(t => !t.confidence_score).length
    };
    phase4Metrics.confidence_distribution = confidenceDistribution;

    // Velocity distribution
    const velocityDistribution = {
      positive: uiTrends.filter(t => t.velocity && t.velocity > 0).length,
      zero: uiTrends.filter(t => t.velocity === 0 || t.velocity === null).length,
      has_velocity_1h: uiTrends.filter(t => t.velocity_1h && t.velocity_1h > 0).length,
    };
    phase4Metrics.velocity_distribution = velocityDistribution;

    // Sample of actionable trends
    phase4Metrics.sample_actionable = actionable.slice(0, 5).map(t => ({
      topic: t.topic,
      velocity: t.velocity,
      velocity_1h: t.velocity_1h,
      is_trending: t.is_trending,
      confidence_score: t.confidence_score
    }));

    // Sample of filtered-out trends
    const filteredOut = uiTrends.filter(t => 
      (!t.velocity || t.velocity <= 0) && 
      (!t.velocity_1h || t.velocity_1h <= 0) &&
      t.is_trending !== true
    );
    phase4Metrics.sample_filtered_out = filteredOut.slice(0, 5).map(t => ({
      topic: t.topic,
      velocity: t.velocity,
      velocity_1h: t.velocity_1h,
      is_trending: t.is_trending,
      reason: 'velocity=0 AND is_trending!=true'
    }));
  }

  phases.push({
    phase: 4,
    name: 'UI Data Flow',
    status: phase4Findings.some(f => f.severity === 'CRITICAL') ? 'FAIL' : 
            phase4Findings.some(f => f.severity === 'HIGH') ? 'WARN' : 'PASS',
    findings: phase4Findings,
    metrics: phase4Metrics
  });
  allFindings.push(...phase4Findings);

  // ========== PHASE 5: Signal Quality ==========
  const phase5Findings: Finding[] = [];
  const phase5Metrics: Record<string, unknown> = {};

  // Check entity_mentions for recent activity
  const { count: recentMentions } = await supabase
    .from('entity_mentions')
    .select('*', { count: 'exact', head: true })
    .gte('mentioned_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  phase5Metrics.entity_mentions_24h = recentMentions;

  // Check bluesky_trends
  const { data: bskyTrends } = await supabase
    .from('bluesky_trends')
    .select('topic, velocity, is_trending, mentions_last_hour')
    .eq('is_trending', true)
    .limit(10);

  phase5Metrics.active_bluesky_trends = bskyTrends?.length || 0;

  // Check news_trends
  const { data: newsTrends } = await supabase
    .from('news_trends')
    .select('topic, velocity, is_trending')
    .eq('is_trending', true)
    .limit(10);

  phase5Metrics.active_news_trends = newsTrends?.length || 0;

  if ((bskyTrends?.length || 0) === 0 && (newsTrends?.length || 0) === 0) {
    phase5Findings.push({
      severity: 'HIGH',
      category: 'Signal Quality',
      message: 'No active trends in either bluesky_trends or news_trends',
      remediation: 'Run calculate-bluesky-trends and calculate-news-trends'
    });
  }

  phases.push({
    phase: 5,
    name: 'Signal Quality',
    status: phase5Findings.some(f => f.severity === 'CRITICAL') ? 'FAIL' : 
            phase5Findings.some(f => f.severity === 'HIGH') ? 'WARN' : 'PASS',
    findings: phase5Findings,
    metrics: phase5Metrics
  });
  allFindings.push(...phase5Findings);

  // ========== SUMMARY ==========
  const summary = {
    critical: allFindings.filter(f => f.severity === 'CRITICAL').length,
    high: allFindings.filter(f => f.severity === 'HIGH').length,
    medium: allFindings.filter(f => f.severity === 'MEDIUM').length,
    low: allFindings.filter(f => f.severity === 'LOW').length,
    total: allFindings.length
  };

  const overallStatus = summary.critical > 0 ? '🔴 CRITICAL' :
                        summary.high > 0 ? '🟠 HIGH' :
                        summary.medium > 0 ? '🟡 MEDIUM' : '🟢 HEALTHY';

  // Prioritized remediation
  const remediation = allFindings
    .filter(f => f.remediation)
    .sort((a, b) => {
      const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
      return order[a.severity] - order[b.severity];
    })
    .slice(0, 5)
    .map(f => ({
      priority: f.severity,
      action: f.remediation,
      category: f.category
    }));

  return new Response(JSON.stringify({
    audit_timestamp: new Date().toISOString(),
    overall_status: overallStatus,
    summary,
    phases,
    remediation
  }, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
