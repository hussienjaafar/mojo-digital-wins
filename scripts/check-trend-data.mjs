#!/usr/bin/env node
/**
 * Quick check of trend_events table data
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Error: Set SUPABASE_URL and key environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function check() {
  console.log('Checking trend_events table...\n');

  // Get total count
  const { count: totalCount } = await supabase
    .from('trend_events')
    .select('*', { count: 'exact', head: true });

  console.log(`Total rows in trend_events: ${totalCount || 0}`);

  // Get trending count
  const { count: trendingCount } = await supabase
    .from('trend_events')
    .select('*', { count: 'exact', head: true })
    .eq('is_trending', true);

  console.log(`Rows where is_trending=true: ${trendingCount || 0}`);

  // Get recent data
  const { data: recentTrends, error } = await supabase
    .from('trend_events')
    .select('event_title, is_trending, last_seen_at, confidence_score')
    .order('last_seen_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error fetching recent data:', error.message);
    return;
  }

  if (recentTrends && recentTrends.length > 0) {
    console.log('\nMost recent 20 entries:');
    console.log('─'.repeat(80));
    for (const trend of recentTrends) {
      const date = new Date(trend.last_seen_at).toLocaleString();
      const trending = trend.is_trending ? '✅' : '❌';
      console.log(`${trending} ${date} | Score: ${trend.confidence_score || 0} | ${trend.event_title}`);
    }
  } else {
    console.log('\nNo data found in trend_events table.');
  }

  // Check date range
  const { data: dateRange } = await supabase
    .from('trend_events')
    .select('last_seen_at')
    .order('last_seen_at', { ascending: true })
    .limit(1);

  const { data: latestDate } = await supabase
    .from('trend_events')
    .select('last_seen_at')
    .order('last_seen_at', { ascending: false })
    .limit(1);

  if (dateRange && dateRange.length > 0 && latestDate && latestDate.length > 0) {
    console.log(`\nDate range: ${dateRange[0].last_seen_at} to ${latestDate[0].last_seen_at}`);
  }
}

check();
