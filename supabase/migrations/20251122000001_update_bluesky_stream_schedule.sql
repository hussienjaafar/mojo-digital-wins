-- Update Bluesky stream job to run every 2 minutes with cursor-based polling
-- This replaces the continuous WebSocket connection with periodic polling

UPDATE public.scheduled_jobs
SET
  cron_expression = '*/2 * * * *',
  next_run_at = now() + interval '2 minutes',
  description = 'Collect Bluesky posts via cursor-based JetStream polling (runs every 2 minutes for 45 seconds)',
  updated_at = now()
WHERE job_name = 'Keep Bluesky Stream Alive';

-- Rename the job to reflect new behavior
UPDATE public.scheduled_jobs
SET
  job_name = 'Collect Bluesky Posts',
  job_type = 'collect_bluesky',
  description = 'Collect Bluesky posts via cursor-based JetStream polling (runs every 2 minutes for 45 seconds)',
  updated_at = now()
WHERE job_name = 'Keep Bluesky Stream Alive';

COMMENT ON TABLE public.scheduled_jobs IS
'Scheduled job registry for automated tasks:

DATA INGESTION (Real-time):
- RSS Feed Sync: Every 5 minutes - Fetch articles from 140+ RSS sources (parallel batches)
- Collect Bluesky Posts: Every 2 minutes - Poll JetStream firehose with cursor-based resumption

AI ANALYSIS (Frequent):
- Analyze Bluesky Posts: Every 10 minutes - AI topic extraction & sentiment from social posts
- Correlate Social & News: Every 15 minutes - Match social trends with news for predictive signals
- Extract Trending Topics: Every 30 minutes - AI topic extraction from news articles
- Smart Alerting: Every 30 minutes - Breaking news detection & clustering

EMAIL DELIVERY:
- Daily Briefing Email: Daily at 8 AM - Send email digest to subscribers

All jobs run automatically via pg_cron - no user interaction required.';
