
-- Create a unified view that combines articles and google_news_articles for the investigation table
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
  created_at,
  'rss' as source_type
FROM public.articles
UNION ALL
SELECT 
  id,
  title,
  description,
  source_name,
  COALESCE(source_url, url) as source_url,
  published_at as published_date,
  ai_sentiment_label as sentiment_label,
  ai_sentiment::numeric as sentiment_score,
  NULL as threat_level,
  ai_topics as tags,
  NULL as category,
  CASE WHEN ai_processed = true THEN 'processed' ELSE 'pending' END as processing_status,
  NULL as ai_summary,
  created_at,
  'google' as source_type
FROM public.google_news_articles;

-- Grant access to the view
GRANT SELECT ON public.news_investigation_view TO anon, authenticated;

-- Re-schedule the run-scheduled-jobs cron job to ensure it uses the cron_config secret
-- First unschedule if exists
SELECT cron.unschedule('run-scheduled-jobs-orchestrator');

-- Re-schedule with the secret from cron_config
SELECT cron.schedule(
  'run-scheduled-jobs-orchestrator',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://nuclmzoasgydubdshtab.supabase.co/functions/v1/run-scheduled-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51Y2xtem9hc2d5ZHViZHNodGFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MDgxNTMsImV4cCI6MjA3ODQ4NDE1M30.-1EDAX7A5pQxtFs3a9M4R2BHBMbWkoMdA5NLWdZyEjo',
      'x-cron-secret', (SELECT value FROM public.cron_config WHERE key = 'cron_secret')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
