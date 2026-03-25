#!/usr/bin/env node
/**
 * Check all relevant data source tables
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

const tables = [
  'trend_events',
  'news_articles',
  'trending_topics',
  'entity_trends',
  'bluesky_posts',
  'article_analyses',
  'news_clusters'
];

async function check() {
  console.log('Checking data source tables...\n');
  console.log('─'.repeat(50));

  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`❌ ${table}: ${error.message}`);
      } else {
        console.log(`✅ ${table}: ${count || 0} rows`);
      }
    } catch (e) {
      console.log(`❌ ${table}: ${e.message}`);
    }
  }

  // Get sample news articles if available
  console.log('\n\nSample news_articles (if any):');
  console.log('─'.repeat(50));

  const { data: articles, error: articlesError } = await supabase
    .from('news_articles')
    .select('headline, source, published_at, url')
    .order('published_at', { ascending: false })
    .limit(10);

  if (articlesError) {
    console.log('Error:', articlesError.message);
  } else if (articles && articles.length > 0) {
    for (const a of articles) {
      const date = a.published_at ? new Date(a.published_at).toLocaleString() : 'N/A';
      console.log(`\n• ${a.headline}`);
      console.log(`  Source: ${a.source} | Date: ${date}`);
    }
  } else {
    console.log('No news articles found');
  }

  // Check trending_topics table
  console.log('\n\nSample trending_topics (if any):');
  console.log('─'.repeat(50));

  const { data: topics, error: topicsError } = await supabase
    .from('trending_topics')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (topicsError) {
    console.log('Error:', topicsError.message);
  } else if (topics && topics.length > 0) {
    for (const t of topics) {
      console.log(`• ${JSON.stringify(t)}`);
    }
  } else {
    console.log('No trending topics found');
  }
}

check();
