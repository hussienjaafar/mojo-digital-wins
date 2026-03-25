#!/usr/bin/env node
/**
 * Query current trending topics for audit
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function query() {
  // Check most recent trends regardless of time window (including non-trending for historical context)
  const { data: recent, error: recentError } = await supabase
    .from('trend_events')
    .select('event_title, confidence_score, is_event_phrase, label_quality, source_count, last_seen_at, is_trending, z_score_velocity, is_breaking, evidence_count')
    .order('last_seen_at', { ascending: false })
    .limit(30);

  console.log('=== MOST RECENT TREND EVENTS (any status) ===');
  if (recentError) {
    console.log('Error:', recentError.message);
  } else if (recent && recent.length > 0) {
    console.log('Found ' + recent.length + ' trend events (most recent first):\n');
    for (const t of recent) {
      const age = Math.round((Date.now() - new Date(t.last_seen_at).getTime()) / (1000 * 60 * 60));
      const trendingStatus = t.is_trending ? '🔥 TRENDING' : '⏸️ Not trending';
      console.log('• "' + t.event_title + '" [' + trendingStatus + ']');
      console.log('  Confidence: ' + t.confidence_score + ' | Sources: ' + t.source_count + ' | Event Phrase: ' + t.is_event_phrase);
      console.log('  Quality: ' + t.label_quality + ' | Z-Score: ' + (t.z_score_velocity || 0).toFixed(1) + ' | Breaking: ' + t.is_breaking);
      console.log('  Evidence: ' + t.evidence_count + ' mentions | Last seen: ' + age + ' hours ago\n');
    }
  } else {
    console.log('No trend events found in database');
  }

  // Check when trend detection last ran
  const { data: anyTrends, error: anyError } = await supabase
    .from('trend_events')
    .select('last_seen_at')
    .order('last_seen_at', { ascending: false })
    .limit(1);

  if (anyTrends && anyTrends.length > 0) {
    const lastSeen = new Date(anyTrends[0].last_seen_at);
    const hoursAgo = Math.round((Date.now() - lastSeen.getTime()) / (1000 * 60 * 60));
    console.log('\n=== LAST TREND DETECTION ===');
    console.log('Most recent trend activity: ' + hoursAgo + ' hours ago (' + lastSeen.toISOString() + ')');
  }

  // Check total counts
  const { count: trendingCount } = await supabase
    .from('trend_events')
    .select('*', { count: 'exact', head: true })
    .eq('is_trending', true);

  const { count: totalCount } = await supabase
    .from('trend_events')
    .select('*', { count: 'exact', head: true });

  console.log('\n=== SUMMARY ===');
  console.log('Total trend events in DB: ' + totalCount);
  console.log('Currently trending: ' + trendingCount);

  // Check source data tables
  console.log('\n=== SOURCE DATA CHECK ===');

  const { count: rssCount, error: rssErr } = await supabase
    .from('rss_articles')
    .select('*', { count: 'exact', head: true });
  console.log('RSS articles: ' + (rssErr ? rssErr.message : rssCount));

  const { count: gnCount, error: gnErr } = await supabase
    .from('google_news_articles')
    .select('*', { count: 'exact', head: true });
  console.log('Google News articles: ' + (gnErr ? gnErr.message : gnCount));

  const { count: bsCount, error: bsErr } = await supabase
    .from('bluesky_posts')
    .select('*', { count: 'exact', head: true });
  console.log('Bluesky posts: ' + (bsErr ? bsErr.message : bsCount));

  const { count: evCount, error: evErr } = await supabase
    .from('trend_evidence')
    .select('*', { count: 'exact', head: true });
  console.log('Trend evidence: ' + (evErr ? evErr.message : evCount));

  // Check recent articles
  console.log('\n=== RECENT ARTICLES (last 24h) ===');
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count: recentRss } = await supabase
    .from('rss_articles')
    .select('*', { count: 'exact', head: true })
    .gte('published_at', cutoff);
  console.log('Recent RSS articles: ' + (recentRss || 0));

  const { count: recentGn } = await supabase
    .from('google_news_articles')
    .select('*', { count: 'exact', head: true })
    .gte('published_at', cutoff);
  console.log('Recent Google News articles: ' + (recentGn || 0));

  // Check scheduled jobs configuration
  console.log('\n=== SCHEDULED JOBS ===');
  const { data: jobs, error: jobsErr } = await supabase
    .from('scheduled_jobs')
    .select('*')
    .order('job_name');

  if (jobsErr) {
    console.log('Error querying scheduled_jobs:', jobsErr.message);
  } else if (jobs && jobs.length > 0) {
    console.log('Found ' + jobs.length + ' scheduled jobs:\n');

    // Filter for trend-related jobs
    const trendJobs = jobs.filter(j =>
      j.job_type && (
        j.job_type.includes('trend') ||
        j.job_type.includes('fetch') ||
        j.job_type.includes('analyze') ||
        j.job_type.includes('baseline')
      )
    );

    console.log('TREND-RELATED JOBS:');
    for (const j of trendJobs) {
      const lastRun = j.last_run_at ? new Date(j.last_run_at) : null;
      const nextRun = j.next_run_at ? new Date(j.next_run_at) : null;
      const hoursAgo = lastRun ? Math.round((Date.now() - lastRun.getTime()) / (1000 * 60 * 60)) : 'never';
      const interval = j.interval_minutes || j.cron_expression || 'unknown';
      console.log('• ' + j.job_name + ' (' + j.job_type + ')');
      console.log('  Active: ' + j.is_active + ' | Interval: ' + interval + ' | Last: ' + hoursAgo + 'h ago | Status: ' + (j.last_run_status || 'unknown'));
    }

    // Summary
    const activeJobs = jobs.filter(j => j.is_active);
    const recentlyRan = jobs.filter(j => j.last_run_at && (Date.now() - new Date(j.last_run_at).getTime()) < 24 * 60 * 60 * 1000);
    console.log('\nSUMMARY:');
    console.log('  Total jobs: ' + jobs.length);
    console.log('  Active jobs: ' + activeJobs.length);
    console.log('  Ran in last 24h: ' + recentlyRan.length);
  } else {
    console.log('No scheduled jobs found');
  }

  // Check job executions
  console.log('\n=== RECENT JOB EXECUTIONS ===');
  const { data: executions, error: execErr } = await supabase
    .from('job_executions')
    .select('job_id, status, started_at, completed_at, error_message')
    .order('started_at', { ascending: false })
    .limit(10);

  if (execErr) {
    console.log('Error querying job_executions:', execErr.message);
  } else if (executions && executions.length > 0) {
    console.log('Last 10 executions:');
    for (const e of executions) {
      const started = new Date(e.started_at);
      const hoursAgo = Math.round((Date.now() - started.getTime()) / (1000 * 60 * 60));
      console.log('  ' + e.status + ' - ' + hoursAgo + 'h ago' + (e.error_message ? ' - ERROR: ' + e.error_message.substring(0, 50) : ''));
    }
  } else {
    console.log('No job executions found');
  }
}

query();
