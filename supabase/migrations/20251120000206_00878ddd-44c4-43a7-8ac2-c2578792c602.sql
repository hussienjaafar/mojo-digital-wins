-- Update RSS feed sync to run every 15 minutes (at :00, :15, :30, :45)
UPDATE public.scheduled_jobs
SET schedule = '*/15 * * * *',
    updated_at = now()
WHERE job_type = 'fetch_rss';

-- Update sentiment analysis to run every 15 minutes with 5-min offset (at :05, :20, :35, :50)
UPDATE public.scheduled_jobs
SET schedule = '5,20,35,50 * * * *',
    updated_at = now()
WHERE job_type = 'analyze_articles';

-- Ensure both jobs are enabled
UPDATE public.scheduled_jobs
SET is_active = true
WHERE job_type IN ('fetch_rss', 'analyze_articles');