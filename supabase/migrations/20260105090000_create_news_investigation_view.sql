CREATE OR REPLACE VIEW public.news_investigation_view AS
SELECT
  id,
  title,
  description,
  source_name,
  source_url,
  published_date,
  sentiment_label,
  sentiment_score,
  threat_level,
  tags,
  category,
  processing_status,
  ai_summary,
  created_at
FROM public.articles
UNION ALL
SELECT
  id,
  title,
  description,
  source_name,
  COALESCE(source_url, url) AS source_url,
  published_at AS published_date,
  ai_sentiment_label AS sentiment_label,
  ai_sentiment AS sentiment_score,
  NULL::text AS threat_level,
  ai_topics AS tags,
  NULL::text AS category,
  CASE WHEN ai_processed THEN 'processed' ELSE NULL END AS processing_status,
  NULL::text AS ai_summary,
  created_at
FROM public.google_news_articles;
