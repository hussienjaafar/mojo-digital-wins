-- Migration 3: Scheduled Automation
-- Creates scheduled_jobs, job_executions, email_queue, webhook_configs, webhook_deliveries tables

-- Scheduled Jobs table
CREATE TABLE IF NOT EXISTS public.scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL UNIQUE,
  job_type TEXT NOT NULL,
  schedule TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Job Executions table
CREATE TABLE IF NOT EXISTS public.job_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.scheduled_jobs(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  result JSONB,
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Email Queue table
CREATE TABLE IF NOT EXISTS public.email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_emails TEXT[] NOT NULL,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  text_body TEXT,
  attachments JSONB DEFAULT '[]',
  priority INTEGER DEFAULT 5,
  status TEXT DEFAULT 'pending',
  scheduled_for TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Webhook Configs table
CREATE TABLE IF NOT EXISTS public.webhook_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT,
  event_types TEXT[] DEFAULT '{}',
  headers JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Webhook Deliveries table
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID REFERENCES public.webhook_configs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending',
  response_code INTEGER,
  response_body TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view scheduled jobs"
  ON public.scheduled_jobs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage scheduled jobs"
  ON public.scheduled_jobs FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view job executions"
  ON public.job_executions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage job executions"
  ON public.job_executions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view email queue"
  ON public.email_queue FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage email queue"
  ON public.email_queue FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view webhook configs"
  ON public.webhook_configs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage webhook configs"
  ON public.webhook_configs FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view webhook deliveries"
  ON public.webhook_deliveries FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage webhook deliveries"
  ON public.webhook_deliveries FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes
CREATE INDEX idx_scheduled_jobs_active ON public.scheduled_jobs(is_active, next_run_at);
CREATE INDEX idx_job_executions_job_id ON public.job_executions(job_id, started_at DESC);
CREATE INDEX idx_job_executions_status ON public.job_executions(status, started_at DESC);
CREATE INDEX idx_email_queue_status ON public.email_queue(status, scheduled_for);
CREATE INDEX idx_email_queue_priority ON public.email_queue(priority DESC, scheduled_for);
CREATE INDEX idx_webhook_deliveries_status ON public.webhook_deliveries(status, created_at DESC);

-- Insert default scheduled jobs
INSERT INTO public.scheduled_jobs (job_name, job_type, schedule, endpoint, payload, is_active) VALUES
  ('fetch-rss-feeds', 'sync', '*/30 * * * *', '/functions/v1/fetch-rss-feeds', '{}', true),
  ('fetch-executive-orders', 'sync', '0 */6 * * *', '/functions/v1/fetch-executive-orders', '{}', true),
  ('track-state-actions', 'sync', '0 */8 * * *', '/functions/v1/track-state-actions', '{}', true),
  ('smart-alerting', 'analysis', '*/15 * * * *', '/functions/v1/smart-alerting', '{}', true),
  ('send-daily-briefing', 'report', '0 7 * * *', '/functions/v1/send-daily-briefing', '{}', true)
ON CONFLICT (job_name) DO NOTHING;