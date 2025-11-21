-- Add scheduled jobs for Bluesky Social Intelligence System

INSERT INTO public.scheduled_jobs (job_name, job_type, description, cron_expression, next_run_at) VALUES
  -- Analyze Bluesky posts every 10 minutes (AI topic extraction & sentiment)
  ('Analyze Bluesky Posts', 'analyze_bluesky', 'AI-powered topic extraction and sentiment analysis of Bluesky posts', '*/10 * * * *', now() + interval '10 minutes'),

  -- Correlate social trends with news articles every 30 minutes
  ('Correlate Social & News', 'correlate_social_news', 'Match Bluesky trends with news articles to find predictive signals', '*/30 * * * *', now() + interval '30 minutes')

ON CONFLICT (job_name) DO UPDATE SET
  cron_expression = EXCLUDED.cron_expression,
  description = EXCLUDED.description,
  updated_at = now();

-- Note: The bluesky-stream function runs continuously as a WebSocket connection
-- and doesn't need to be scheduled. It should be deployed and kept running.

COMMENT ON TABLE public.scheduled_jobs IS
'Scheduled job registry:
- RSS Feed Sync: Every 5 minutes (real-time news)
- Analyze Bluesky Posts: Every 10 minutes (AI topic extraction)
- Correlate Social & News: Every 30 minutes (predictive signals)
- Smart Alerting: Every 30 minutes (breaking news detection)
- Daily Briefing Email: Daily at 8 AM (email delivery)';
