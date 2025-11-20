-- Quick diagnostic queries to check why daily briefing is empty

-- 1. Check if articles have threat levels
SELECT
  COUNT(*) as total_articles,
  COUNT(*) FILTER (WHERE threat_level = 'critical') as critical,
  COUNT(*) FILTER (WHERE threat_level = 'high') as high,
  COUNT(*) FILTER (WHERE threat_level = 'medium') as medium,
  COUNT(*) FILTER (WHERE threat_level = 'low') as low,
  COUNT(*) FILTER (WHERE threat_level IS NULL) as no_threat_level,
  COUNT(*) FILTER (WHERE published_date >= NOW() - INTERVAL '24 hours') as last_24h
FROM articles;

-- 2. Check recent articles (last 24 hours)
SELECT
  id,
  title,
  threat_level,
  source_name,
  published_date
FROM articles
WHERE published_date >= NOW() - INTERVAL '24 hours'
ORDER BY published_date DESC
LIMIT 10;

-- 3. Check if daily_briefings table has any data
SELECT * FROM daily_briefings ORDER BY briefing_date DESC LIMIT 5;

-- 4. Check if breaking_news_clusters table has any data
SELECT * FROM breaking_news_clusters ORDER BY first_detected_at DESC LIMIT 5;

-- 5. Test the get_briefing_stats function
SELECT get_briefing_stats(CURRENT_DATE);
