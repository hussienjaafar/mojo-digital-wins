#!/usr/bin/env node
/**
 * Inspect database tables and find trend-related data
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

// Extended list of tables to check
const tables = [
  'trend_events',
  'trending_topics',
  'entity_trends',
  'news_articles',
  'article_analyses',
  'news_clusters',
  'bluesky_posts',
  'rss_articles',
  'google_news_articles',
  'reddit_posts',
  'political_events',
  'topic_baselines',
  'trend_baselines'
];

async function inspect() {
  console.log('Inspecting database for trend-related data...\n');
  console.log('─'.repeat(60));

  for (const table of tables) {
    try {
      const { data, count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact' })
        .limit(3);

      if (error) {
        if (error.message.includes('permission denied')) {
          console.log(`🔒 ${table}: Permission denied (RLS)`);
        } else if (error.message.includes('does not exist') || error.message.includes('not found')) {
          console.log(`❓ ${table}: Table not found`);
        } else {
          console.log(`❌ ${table}: ${error.message}`);
        }
      } else {
        console.log(`✅ ${table}: ${count || 0} rows`);
        if (data && data.length > 0) {
          console.log(`   Sample columns: ${Object.keys(data[0]).slice(0, 5).join(', ')}...`);
        }
      }
    } catch (e) {
      console.log(`❌ ${table}: ${e.message}`);
    }
  }

  // Try to find any table with recent data using raw query approach
  console.log('\n\nAttempting to find tables with created_at in last 24h...');
  console.log('─'.repeat(60));

  // Check trend_events specifically with different queries
  console.log('\nDetailed trend_events check:');

  const { data: allTrends, error: allError } = await supabase
    .from('trend_events')
    .select('*')
    .limit(5);

  if (allError) {
    console.log('Error querying trend_events:', allError.message);
  } else {
    console.log(`All trend_events (no filter): ${allTrends?.length || 0} rows`);
    if (allTrends && allTrends.length > 0) {
      console.log('Sample:', JSON.stringify(allTrends[0], null, 2));
    }
  }

  // Check if there's a different trending column name
  const { data: trendingTrue } = await supabase
    .from('trend_events')
    .select('*')
    .eq('is_trending', true)
    .limit(5);
  console.log(`With is_trending=true: ${trendingTrue?.length || 0} rows`);

  const { data: trendingFalse } = await supabase
    .from('trend_events')
    .select('*')
    .eq('is_trending', false)
    .limit(5);
  console.log(`With is_trending=false: ${trendingFalse?.length || 0} rows`);
}

inspect();
