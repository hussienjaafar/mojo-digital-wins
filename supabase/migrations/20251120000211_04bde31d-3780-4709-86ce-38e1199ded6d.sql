-- Create system_config table for storing Supabase credentials
CREATE TABLE IF NOT EXISTS public.system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Only admins can read system config
CREATE POLICY "Admins can read system config"
  ON public.system_config
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'::app_role
    )
  );

-- Insert placeholder values for Supabase credentials
INSERT INTO public.system_config (key, value)
VALUES 
  ('supabase_url', 'https://nuclmzoasgydubdshtab.supabase.co'),
  ('supabase_service_role_key', 'PLACEHOLDER_UPDATE_AFTER_DEPLOYMENT')
ON CONFLICT (key) DO NOTHING;

-- Set up pg_cron job to run the scheduler every minute
SELECT cron.schedule(
  'run-scheduled-jobs-every-minute',
  '* * * * *',
  $$
  SELECT
    net.http_post(
      url := (SELECT value FROM public.system_config WHERE key = 'supabase_url') || '/functions/v1/run-scheduled-jobs',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT value FROM public.system_config WHERE key = 'supabase_service_role_key')
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);