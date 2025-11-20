-- Update RSS Feed Sync and Sentiment Analysis to run every 15 minutes
-- This replaces the previous 4-hour schedule with rapid 15-minute updates

-- Update existing RSS Feed Sync job to run every 15 minutes
UPDATE public.scheduled_jobs
SET
  cron_expression = '*/15 * * * *',
  description = 'Fetch articles from all configured RSS feeds every 15 minutes',
  next_run_at = NOW() + INTERVAL '15 minutes',
  updated_at = NOW()
WHERE job_name = 'RSS Feed Sync';

-- Insert Sentiment Analysis job (runs every 15 minutes, offset by 5 minutes to avoid overlap)
INSERT INTO public.scheduled_jobs (
  job_name,
  job_type,
  description,
  cron_expression,
  is_enabled,
  next_run_at
) VALUES (
  'Sentiment Analysis',
  'analyze_articles',
  'Analyze sentiment of pending articles using AI every 15 minutes',
  '5,20,35,50 * * * *',
  true,
  NOW() + INTERVAL '5 minutes'
)
ON CONFLICT (job_name) DO UPDATE SET
  cron_expression = EXCLUDED.cron_expression,
  description = EXCLUDED.description,
  is_enabled = EXCLUDED.is_enabled,
  next_run_at = EXCLUDED.next_run_at,
  updated_at = NOW();

-- Add comment explaining the schedule
COMMENT ON TABLE public.scheduled_jobs IS
'Automated job scheduler. RSS feeds refresh every 15 minutes at :00, :15, :30, :45.
Sentiment analysis runs every 15 minutes at :05, :20, :35, :50 (5-minute offset to prevent overlap).';
