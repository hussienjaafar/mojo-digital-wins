-- Debug why RSS fetch returns 0 new articles
-- Run this in Supabase SQL Editor to diagnose the issue

-- 1. Check most recent articles in database
SELECT
  id,
  title,
  source_name,
  published_date,
  created_at,
  created_at - published_date as time_lag
FROM articles
ORDER BY published_date DESC
LIMIT 10;

-- 2. Check RSS sources and when they were last fetched
SELECT
  id,
  name,
  url,
  last_fetched_at,
  fetch_error,
  is_active,
  NOW() - last_fetched_at as time_since_last_fetch
FROM rss_sources
WHERE is_active = true
ORDER BY last_fetched_at DESC;

-- 3. Check if there are recent articles that failed to insert
SELECT
  COUNT(*) as total_articles,
  COUNT(CASE WHEN published_date > NOW() - INTERVAL '1 hour' THEN 1 END) as last_hour,
  COUNT(CASE WHEN published_date > NOW() - INTERVAL '6 hours' THEN 1 END) as last_6_hours,
  COUNT(CASE WHEN published_date > NOW() - INTERVAL '24 hours' THEN 1 END) as last_24_hours,
  MAX(published_date) as newest_article_published_date,
  MAX(created_at) as newest_article_created_at
FROM articles;

-- 4. Check for duplicate hash signatures (might be blocking new articles)
SELECT
  hash_signature,
  COUNT(*) as duplicate_count,
  STRING_AGG(title, ' | ') as titles
FROM articles
WHERE hash_signature IS NOT NULL
GROUP BY hash_signature
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC
LIMIT 10;

-- 5. Manual test: Try to fetch ONE RSS source to see what happens
-- Pick one active source
SELECT
  id,
  name,
  url,
  'Test this URL manually in browser or with curl' as action
FROM rss_sources
WHERE is_active = true
LIMIT 1;
