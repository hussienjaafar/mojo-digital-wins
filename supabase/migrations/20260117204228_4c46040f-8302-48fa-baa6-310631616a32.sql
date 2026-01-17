-- ============================================================
-- CAPI FULL FIX MIGRATION (CORRECTED)
-- Fix privacy_mode constraint, create retry queue, align schema
-- ============================================================

-- ============================================================
-- 1. FIX privacy_mode CONSTRAINT MISMATCH
-- UI sends: conservative, balanced, aggressive
-- DB currently allows: minimal, standard, maximum
-- ============================================================

-- First, migrate existing values to the new terminology
UPDATE public.meta_capi_config 
SET privacy_mode = CASE 
  WHEN privacy_mode = 'minimal' THEN 'conservative'
  WHEN privacy_mode = 'standard' THEN 'balanced'
  WHEN privacy_mode = 'maximum' THEN 'aggressive'
  ELSE 'conservative'
END
WHERE privacy_mode IN ('minimal', 'standard', 'maximum');

-- Drop old constraint and add new one
ALTER TABLE public.meta_capi_config DROP CONSTRAINT IF EXISTS meta_capi_config_privacy_mode_check;
ALTER TABLE public.meta_capi_config ADD CONSTRAINT meta_capi_config_privacy_mode_check 
  CHECK (privacy_mode IN ('conservative', 'balanced', 'aggressive'));

-- Update default
ALTER TABLE public.meta_capi_config ALTER COLUMN privacy_mode SET DEFAULT 'conservative';

-- ============================================================
-- 2. CREATE meta_conversion_retry_queue TABLE
-- Used by retry-meta-conversions edge function
-- ============================================================

CREATE TABLE IF NOT EXISTS public.meta_conversion_retry_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  event_id UUID NOT NULL,
  event_name TEXT NOT NULL,
  event_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_source_url TEXT,
  user_data JSONB,
  custom_data JSONB,
  pixel_id TEXT,
  attempt_count INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for retry processing
CREATE INDEX IF NOT EXISTS idx_retry_queue_next_retry 
  ON public.meta_conversion_retry_queue(next_retry_at) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_retry_queue_org_event 
  ON public.meta_conversion_retry_queue(organization_id, event_id);

-- Enable RLS (service role bypasses, admins can view)
ALTER TABLE public.meta_conversion_retry_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage retry queue" ON public.meta_conversion_retry_queue;
CREATE POLICY "Admins can manage retry queue" ON public.meta_conversion_retry_queue
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- 3. ALIGN meta_conversion_events SCHEMA WITH EDGE FUNCTIONS
-- Add missing columns that edge functions expect
-- ============================================================

-- Attribution columns
ALTER TABLE public.meta_conversion_events ADD COLUMN IF NOT EXISTS campaign_id TEXT;
ALTER TABLE public.meta_conversion_events ADD COLUMN IF NOT EXISTS ad_set_id TEXT;
ALTER TABLE public.meta_conversion_events ADD COLUMN IF NOT EXISTS ad_id TEXT;
ALTER TABLE public.meta_conversion_events ADD COLUMN IF NOT EXISTS trend_event_id UUID;
ALTER TABLE public.meta_conversion_events ADD COLUMN IF NOT EXISTS refcode TEXT;

-- Matching/debug columns
ALTER TABLE public.meta_conversion_events ADD COLUMN IF NOT EXISTS match_score NUMERIC;
ALTER TABLE public.meta_conversion_events ADD COLUMN IF NOT EXISTS match_quality TEXT;
ALTER TABLE public.meta_conversion_events ADD COLUMN IF NOT EXISTS max_attempts INT DEFAULT 5;

-- User linking
ALTER TABLE public.meta_conversion_events ADD COLUMN IF NOT EXISTS user_id UUID;

-- Ensure source columns exist
ALTER TABLE public.meta_conversion_events ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE public.meta_conversion_events ADD COLUMN IF NOT EXISTS source_id TEXT;

-- Action tracking columns used by various functions
ALTER TABLE public.meta_conversion_events ADD COLUMN IF NOT EXISTS action_source TEXT DEFAULT 'website';

-- Ensure retry columns have proper defaults
ALTER TABLE public.meta_conversion_events ALTER COLUMN retry_count SET DEFAULT 0;
ALTER TABLE public.meta_conversion_events ALTER COLUMN status SET DEFAULT 'pending';

-- Add index for attribution queries
CREATE INDEX IF NOT EXISTS idx_meta_events_campaign 
  ON public.meta_conversion_events(campaign_id) 
  WHERE campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_meta_events_refcode 
  ON public.meta_conversion_events(refcode) 
  WHERE refcode IS NOT NULL;

-- ============================================================
-- 4. FIX SCHEDULED JOB REGISTRATION
-- Change job_type to edge_function so scheduler actually runs it
-- Use correct column name: schedule (not schedule_cron)
-- ============================================================

-- Delete old registration if exists
DELETE FROM public.scheduled_jobs 
WHERE job_name = 'process-meta-capi-outbox' 
   OR (endpoint = 'process-meta-capi-outbox' AND job_type = 'capi_outbox');

-- Insert correct registration
INSERT INTO public.scheduled_jobs (
  job_name,
  job_type,
  endpoint,
  schedule,
  is_active
) VALUES (
  'process-meta-capi-outbox',
  'edge_function',
  'process-meta-capi-outbox',
  '* * * * *',
  true
) ON CONFLICT (job_name) DO UPDATE SET
  job_type = 'edge_function',
  endpoint = 'process-meta-capi-outbox',
  schedule = '* * * * *',
  is_active = true;

-- ============================================================
-- 5. ADD updated_at TRIGGER FOR RETRY QUEUE
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_retry_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_meta_conversion_retry_queue_updated_at ON public.meta_conversion_retry_queue;
CREATE TRIGGER update_meta_conversion_retry_queue_updated_at
  BEFORE UPDATE ON public.meta_conversion_retry_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_retry_queue_updated_at();