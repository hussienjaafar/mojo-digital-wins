-- Fix cron jobs to use x-cron-secret header
-- First, create a table to store the cron secret (will be populated by admin)
CREATE TABLE IF NOT EXISTS public.cron_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.cron_config ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table (no public access)
-- RLS denies all access by default when no policies exist

-- Insert placeholder for cron secret (admin must update with actual value)
INSERT INTO public.cron_config (key, value) 
VALUES ('cron_secret', 'PLACEHOLDER_UPDATE_WITH_ACTUAL_SECRET')
ON CONFLICT (key) DO NOTHING;

-- Drop and recreate cron jobs with x-cron-secret header
-- Job 1: fetch-rss-feeds-every-15-min
SELECT cron.unschedule('fetch-rss-feeds-every-15-min');
SELECT cron.schedule(
  'fetch-rss-feeds-every-15-min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://nuclmzoasgydubdshtab.supabase.co/functions/v1/fetch-rss-feeds',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT value FROM public.cron_config WHERE key = 'cron_secret')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Job 2: sync-congress-bills-hourly
SELECT cron.unschedule('sync-congress-bills-hourly');
SELECT cron.schedule(
  'sync-congress-bills-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://nuclmzoasgydubdshtab.supabase.co/functions/v1/sync-congress-bills',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT value FROM public.cron_config WHERE key = 'cron_secret')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Job 3: analyze-articles-hourly
SELECT cron.unschedule('analyze-articles-hourly');
SELECT cron.schedule(
  'analyze-articles-hourly',
  '30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://nuclmzoasgydubdshtab.supabase.co/functions/v1/analyze-articles',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT value FROM public.cron_config WHERE key = 'cron_secret')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Job 11: correlate-social-news-every-15-min
SELECT cron.unschedule('correlate-social-news-every-15-min');
SELECT cron.schedule(
  'correlate-social-news-every-15-min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://nuclmzoasgydubdshtab.supabase.co/functions/v1/correlate-social-news',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT value FROM public.cron_config WHERE key = 'cron_secret')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Job 14: bluesky-stream-collection
SELECT cron.unschedule('bluesky-stream-collection');
SELECT cron.schedule(
  'bluesky-stream-collection',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://nuclmzoasgydubdshtab.supabase.co/functions/v1/bluesky-stream',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT value FROM public.cron_config WHERE key = 'cron_secret')
    ),
    body := '{"durationMs": 15000, "maxPostsProcessed": 50000}'::jsonb
  ) AS request_id;
  $$
);

-- Job 15: extract-trending-topics
SELECT cron.unschedule('extract-trending-topics');
SELECT cron.schedule(
  'extract-trending-topics',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://nuclmzoasgydubdshtab.supabase.co/functions/v1/extract-trending-topics',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT value FROM public.cron_config WHERE key = 'cron_secret')
    ),
    body := '{"hoursBack": 1}'::jsonb
  ) AS request_id;
  $$
);

-- Job 18: analyze-articles-comprehensive
SELECT cron.unschedule('analyze-articles-comprehensive');
SELECT cron.schedule(
  'analyze-articles-comprehensive',
  '*/20 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://nuclmzoasgydubdshtab.supabase.co/functions/v1/analyze-articles',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT value FROM public.cron_config WHERE key = 'cron_secret')
    ),
    body := '{"batchSize": 30}'::jsonb
  ) AS request_id;
  $$
);

-- Job 19: process-bluesky-posts
SELECT cron.unschedule('process-bluesky-posts');
SELECT cron.schedule(
  'process-bluesky-posts',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://nuclmzoasgydubdshtab.supabase.co/functions/v1/analyze-bluesky-posts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT value FROM public.cron_config WHERE key = 'cron_secret')
    ),
    body := '{"batchSize": 50}'::jsonb
  ) AS request_id;
  $$
);