-- Phase 3: Scheduled Automation System
-- Implements cron jobs, email delivery, and webhook notifications

-- =============================================================================
-- 1. SCHEDULED JOBS REGISTRY
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL UNIQUE,
  job_type TEXT NOT NULL, -- fetch_rss, fetch_executive_orders, track_state_actions, smart_alerting, send_briefings
  description TEXT,
  cron_expression TEXT NOT NULL, -- e.g., '0 */6 * * *' for every 6 hours
  is_enabled BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT, -- success, failed, running
  last_run_duration_ms INTEGER,
  last_error TEXT,
  next_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 2. JOB EXECUTION HISTORY
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.job_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.scheduled_jobs(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL, -- running, success, failed
  duration_ms INTEGER,
  items_processed INTEGER DEFAULT 0,
  items_created INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  error_message TEXT,
  execution_log JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 3. EMAIL DELIVERY QUEUE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT NOT NULL,
  recipient_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL, -- daily_briefing, critical_alert, weekly_summary
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  text_content TEXT,
  priority INTEGER DEFAULT 5, -- 1 = highest, 10 = lowest
  status TEXT DEFAULT 'pending', -- pending, sent, failed, cancelled
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  scheduled_for TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 4. WEBHOOK CONFIGURATIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.webhook_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  webhook_name TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  webhook_type TEXT NOT NULL, -- slack, teams, discord, custom
  events TEXT[] DEFAULT '{critical_alert}'::text[], -- critical_alert, breaking_news, daily_briefing
  secret_key TEXT, -- For signature verification
  is_enabled BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 5. WEBHOOK DELIVERY LOG
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID REFERENCES public.webhook_configs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  duration_ms INTEGER,
  status TEXT NOT NULL, -- pending, success, failed
  attempts INTEGER DEFAULT 1,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 6. INSERT DEFAULT SCHEDULED JOBS
-- =============================================================================
INSERT INTO public.scheduled_jobs (job_name, job_type, description, cron_expression, next_run_at) VALUES
  ('RSS Feed Sync', 'fetch_rss', 'Fetch articles from all configured RSS feeds', '0 */4 * * *', now() + interval '4 hours'),
  ('Executive Orders Sync', 'fetch_executive_orders', 'Fetch executive orders from Federal Register', '0 6,18 * * *', now() + interval '6 hours'),
  ('State Actions Sync', 'track_state_actions', 'Fetch state-level government actions', '0 */6 * * *', now() + interval '6 hours'),
  ('Smart Alerting', 'smart_alerting', 'Detect breaking news and generate alerts', '*/30 * * * *', now() + interval '30 minutes'),
  ('Daily Briefing Email', 'send_briefings', 'Send daily briefing emails to subscribers', '0 8 * * *', (CURRENT_DATE + interval '1 day' + interval '8 hours'))
ON CONFLICT (job_name) DO NOTHING;

-- =============================================================================
-- 7. INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_enabled ON public.scheduled_jobs(is_enabled, next_run_at);
CREATE INDEX IF NOT EXISTS idx_job_executions_job ON public.job_executions(job_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON public.email_queue(status, scheduled_for, priority);
CREATE INDEX IF NOT EXISTS idx_email_queue_user ON public.email_queue(recipient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_configs_user ON public.webhook_configs(user_id, is_enabled);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON public.webhook_deliveries(webhook_id, created_at DESC);

-- =============================================================================
-- 8. ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE public.scheduled_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Admin access for job management
CREATE POLICY "Admins can manage scheduled jobs" ON public.scheduled_jobs
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view job executions" ON public.job_executions
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view email queue" ON public.email_queue
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- User access for webhook management
CREATE POLICY "Users can view own webhooks" ON public.webhook_configs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own webhooks" ON public.webhook_configs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own webhooks" ON public.webhook_configs
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own webhooks" ON public.webhook_configs
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own webhook deliveries" ON public.webhook_deliveries
  FOR SELECT USING (
    webhook_id IN (SELECT id FROM public.webhook_configs WHERE user_id = auth.uid())
  );

-- =============================================================================
-- 9. FUNCTION: Calculate next run time from cron expression
-- =============================================================================
CREATE OR REPLACE FUNCTION public.calculate_next_run(cron_expr TEXT, from_time TIMESTAMPTZ DEFAULT now())
RETURNS TIMESTAMPTZ AS $$
DECLARE
  parts TEXT[];
  minute_part TEXT;
  hour_part TEXT;
  next_time TIMESTAMPTZ;
BEGIN
  -- Simple cron parser for common patterns
  parts := string_to_array(cron_expr, ' ');

  IF array_length(parts, 1) < 5 THEN
    RETURN from_time + interval '1 hour';
  END IF;

  minute_part := parts[1];
  hour_part := parts[2];

  -- Handle */N minute patterns
  IF minute_part LIKE '*/%' THEN
    RETURN from_time + (substring(minute_part from 3)::int * interval '1 minute');
  END IF;

  -- Handle */N hour patterns
  IF hour_part LIKE '*/%' THEN
    RETURN from_time + (substring(hour_part from 3)::int * interval '1 hour');
  END IF;

  -- Default: run in 1 hour
  RETURN from_time + interval '1 hour';
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 10. FUNCTION: Update job status after execution
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_job_after_execution(
  p_job_id UUID,
  p_status TEXT,
  p_duration_ms INTEGER,
  p_error TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE public.scheduled_jobs
  SET
    last_run_at = now(),
    last_run_status = p_status,
    last_run_duration_ms = p_duration_ms,
    last_error = p_error,
    run_count = run_count + 1,
    failure_count = CASE WHEN p_status = 'failed' THEN failure_count + 1 ELSE failure_count END,
    next_run_at = calculate_next_run(cron_expression, now()),
    updated_at = now()
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 11. FUNCTION: Get pending emails for delivery
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_pending_emails(batch_size INTEGER DEFAULT 50)
RETURNS SETOF public.email_queue AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.email_queue
  WHERE status = 'pending'
    AND scheduled_for <= now()
    AND attempts < max_attempts
  ORDER BY priority ASC, scheduled_for ASC
  LIMIT batch_size
  FOR UPDATE SKIP LOCKED;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 12. FUNCTION: Queue daily briefing emails
-- =============================================================================
CREATE OR REPLACE FUNCTION public.queue_daily_briefing_emails()
RETURNS INTEGER AS $$
DECLARE
  emails_queued INTEGER := 0;
  user_record RECORD;
BEGIN
  -- Get all users with daily briefing enabled
  FOR user_record IN
    SELECT
      u.id as user_id,
      u.email,
      p.daily_briefing_time
    FROM auth.users u
    JOIN public.user_article_preferences p ON u.id = p.user_id
    WHERE p.daily_briefing_enabled = true
  LOOP
    -- Insert into email queue
    INSERT INTO public.email_queue (
      recipient_email,
      recipient_user_id,
      email_type,
      subject,
      html_content,
      scheduled_for
    ) VALUES (
      user_record.email,
      user_record.user_id,
      'daily_briefing',
      'Daily Intelligence Briefing - ' || to_char(CURRENT_DATE, 'Month DD, YYYY'),
      '', -- Will be populated by edge function
      CURRENT_DATE + user_record.daily_briefing_time
    );

    emails_queued := emails_queued + 1;
  END LOOP;

  RETURN emails_queued;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
