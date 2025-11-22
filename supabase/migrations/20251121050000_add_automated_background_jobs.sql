-- Add automated background jobs for trending topics and increased correlation frequency
-- This ensures all News Pulse data updates automatically even when no one is using the site

-- Update correlation frequency from 30 minutes to 15 minutes (4x per hour)
UPDATE public.scheduled_jobs
SET
  cron_expression = '*/15 * * * *',
  next_run_at = now() + interval '15 minutes',
  description = 'Match Bluesky trends with news articles to find predictive signals (runs every 15 minutes for faster correlation)',
  updated_at = now()
WHERE job_name = 'Correlate Social & News';

-- Add Extract Trending Topics as scheduled job (every 30 minutes)
INSERT INTO public.scheduled_jobs (job_name, job_type, description, cron_expression, next_run_at) VALUES
  ('Extract Trending Topics', 'extract_trending_topics', 'AI-powered topic extraction from recent articles for News Pulse trending analysis', '*/30 * * * *', now() + interval '30 minutes')
ON CONFLICT (job_name) DO UPDATE SET
  cron_expression = EXCLUDED.cron_expression,
  description = EXCLUDED.description,
  next_run_at = now() + interval '30 minutes',
  updated_at = now();

-- Add Bluesky Stream Keepalive (ensures WebSocket stays connected)
INSERT INTO public.scheduled_jobs (job_name, job_type, description, cron_expression, next_run_at) VALUES
  ('Keep Bluesky Stream Alive', 'bluesky_stream_keepalive', 'Ensure Bluesky WebSocket stream stays connected and restart if disconnected', '*/5 * * * *', now() + interval '5 minutes')
ON CONFLICT (job_name) DO UPDATE SET
  cron_expression = EXCLUDED.cron_expression,
  description = EXCLUDED.description,
  updated_at = now();

-- Update scheduled jobs table documentation
COMMENT ON TABLE public.scheduled_jobs IS
'Automated background job scheduler - all jobs run automatically without user interaction:

DATA INGESTION (Real-time):
- RSS Feed Sync: Every 5 minutes - Fetch articles from 140+ RSS sources
- Keep Bluesky Stream Alive: Every 5 minutes - Maintain WebSocket connection to Bluesky firehose

AI ANALYSIS (Frequent):
- Analyze Bluesky Posts: Every 10 minutes - AI topic extraction & sentiment from social posts
- Correlate Social & News: Every 15 minutes - Match social trends with news for predictive signals
- Extract Trending Topics: Every 30 minutes - AI topic extraction from news articles
- Smart Alerting: Every 30 minutes - Breaking news detection & clustering

EMAIL DELIVERY:
- Daily Briefing Email: Daily at 8 AM - Send email digest to subscribers

All jobs run on backend schedule - users see fresh data immediately upon login without clicking anything.';

-- Add comments to individual jobs
COMMENT ON COLUMN public.scheduled_jobs.job_type IS
'Job type identifier used by the scheduler to invoke the correct edge function or stored procedure';

COMMENT ON COLUMN public.scheduled_jobs.cron_expression IS
'Standard cron expression (minute hour day month weekday). Examples:
- "*/5 * * * *" = every 5 minutes
- "*/30 * * * *" = every 30 minutes
- "0 8 * * *" = daily at 8 AM
- "0 */4 * * *" = every 4 hours';
