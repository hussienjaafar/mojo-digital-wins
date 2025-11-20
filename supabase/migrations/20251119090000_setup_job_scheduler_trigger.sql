-- Setup pg_cron to automatically run the job scheduler every minute
-- The run-scheduled-jobs edge function will check which jobs are due and execute them

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant permissions
GRANT USAGE ON SCHEMA cron TO postgres;

-- Create a configuration table to store Supabase project settings
CREATE TABLE IF NOT EXISTS public.system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on system config (admin only)
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage system config" ON public.system_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Insert placeholder config values (user needs to update these with actual values)
INSERT INTO public.system_config (key, value, description) VALUES
  ('supabase_url', 'https://your-project-ref.supabase.co', 'Your Supabase project URL'),
  ('supabase_service_role_key', 'your-service-role-key-here', 'Your Supabase service role key (keep secret!)')
ON CONFLICT (key) DO NOTHING;

-- Create a function to invoke the scheduler
CREATE OR REPLACE FUNCTION public.trigger_job_scheduler()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  config_url TEXT;
  config_key TEXT;
  request_id BIGINT;
BEGIN
  -- Get configuration
  SELECT value INTO config_url FROM public.system_config WHERE key = 'supabase_url';
  SELECT value INTO config_key FROM public.system_config WHERE key = 'supabase_service_role_key';

  -- Don't run if config is not set
  IF config_url LIKE '%your-project%' OR config_key LIKE '%your-service%' THEN
    RAISE NOTICE 'Job scheduler not configured. Update system_config table with actual values.';
    RETURN;
  END IF;

  -- Call the run-scheduled-jobs edge function
  SELECT INTO request_id net.http_post(
    url := config_url || '/functions/v1/run-scheduled-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || config_key
    ),
    body := '{}'::jsonb
  );

  RAISE NOTICE 'Job scheduler triggered, request ID: %', request_id;
END;
$$;

-- Remove any existing scheduler job (in case of re-running migration)
DO $$
BEGIN
  PERFORM cron.unschedule('job-scheduler-trigger');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Schedule the job scheduler to run every minute
SELECT cron.schedule(
  'job-scheduler-trigger',
  '* * * * *',  -- Every minute
  'SELECT public.trigger_job_scheduler();'
);

-- Instructions for setup
COMMENT ON TABLE public.system_config IS
'System configuration for auto-scheduler.

SETUP INSTRUCTIONS:
1. Update the supabase_url value with your actual project URL
2. Update the supabase_service_role_key with your actual service role key
   (Find these in Supabase Dashboard > Settings > API)

Example:
UPDATE public.system_config
SET value = ''https://abcdefgh.supabase.co''
WHERE key = ''supabase_url'';

UPDATE public.system_config
SET value = ''eyJhbGc...your-actual-key''
WHERE key = ''supabase_service_role_key'';

Once configured, the scheduler will automatically check for and run due jobs every minute.';
