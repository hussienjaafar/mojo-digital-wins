
-- Add retry tracking columns to spike_alerts if they don't exist
ALTER TABLE public.spike_alerts 
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_error TEXT;

-- Reset old failed alerts so they can be retried (only alerts from last 24 hours)
UPDATE public.spike_alerts 
SET status = 'pending', retry_count = 0, last_error = NULL
WHERE status = 'failed' 
AND detected_at > NOW() - INTERVAL '24 hours';

-- Mark very old failed alerts as 'expired' to clean them up
UPDATE public.spike_alerts 
SET status = 'expired'
WHERE status = 'failed' 
AND detected_at <= NOW() - INTERVAL '24 hours';
