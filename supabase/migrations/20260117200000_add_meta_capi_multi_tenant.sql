-- Migration: Multi-tenant Meta CAPI Support
-- Adds per-organization CAPI configuration and extends existing conversion tracking

-- ============================================================================
-- 1. Create meta_capi_config table for per-org configuration
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.meta_capi_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.client_organizations(id) ON DELETE CASCADE NOT NULL,

  -- Meta connection settings
  pixel_id TEXT NOT NULL,
  -- Note: access_token is stored encrypted in client_api_credentials with platform='meta_capi'

  -- Feature flags
  is_enabled BOOLEAN DEFAULT false,
  actblue_owns_donation_complete BOOLEAN DEFAULT false,

  -- Privacy settings: conservative (default), balanced, aggressive
  -- conservative: email OR phone + zip/country + external_id + fbp/fbc
  -- balanced: + fn, ln, city, state
  -- aggressive: + client_ip, client_user_agent
  privacy_mode TEXT NOT NULL DEFAULT 'conservative'
    CHECK (privacy_mode IN ('conservative', 'balanced', 'aggressive')),

  -- Event configuration
  donation_event_name TEXT DEFAULT 'Purchase',
  test_event_code TEXT,  -- For Meta Test Events validation

  -- Health tracking
  last_send_at TIMESTAMPTZ,
  last_send_status TEXT CHECK (last_send_status IN ('success', 'failed', NULL)),
  last_error TEXT,
  total_events_sent INTEGER DEFAULT 0,
  total_events_failed INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT unique_org_capi_config UNIQUE (organization_id)
);

-- Index for finding enabled configs
CREATE INDEX IF NOT EXISTS idx_meta_capi_config_enabled
  ON public.meta_capi_config(organization_id)
  WHERE is_enabled = true;

-- RLS
ALTER TABLE public.meta_capi_config ENABLE ROW LEVEL SECURITY;

-- Users can view their own org's CAPI config
CREATE POLICY "Users can view own org CAPI config"
  ON public.meta_capi_config FOR SELECT
  USING (organization_id = public.get_user_organization_id());

-- Admins can manage all CAPI configs
CREATE POLICY "Admins can manage CAPI config"
  ON public.meta_capi_config FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Client managers can manage their own org's config
CREATE POLICY "Managers can manage own org CAPI config"
  ON public.meta_capi_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.client_users cu
      WHERE cu.id = auth.uid()
      AND cu.organization_id = meta_capi_config.organization_id
      AND cu.role IN ('admin', 'manager')
    )
  );

-- ============================================================================
-- 2. Extend meta_conversion_events for outbox pattern
-- ============================================================================

-- Add dedupe_key for idempotent enqueuing
ALTER TABLE public.meta_conversion_events
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

-- Add source tracking
ALTER TABLE public.meta_conversion_events
  ADD COLUMN IF NOT EXISTS source_type TEXT CHECK (source_type IN ('actblue_webhook', 'actblue_csv', 'manual', 'pixel', NULL)),
  ADD COLUMN IF NOT EXISTS source_id TEXT;

-- Add user_data storage (PRE-HASHED for security - no plaintext PII stored)
ALTER TABLE public.meta_conversion_events
  ADD COLUMN IF NOT EXISTS user_data_hashed JSONB;

-- Add matching identifiers
ALTER TABLE public.meta_conversion_events
  ADD COLUMN IF NOT EXISTS fbp TEXT,
  ADD COLUMN IF NOT EXISTS fbc TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT;

-- Add pixel_id tracking (which pixel was used)
ALTER TABLE public.meta_conversion_events
  ADD COLUMN IF NOT EXISTS pixel_id TEXT;

-- Add max_attempts for retry limiting
ALTER TABLE public.meta_conversion_events
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 5;

-- Add match_score for debugging (0-100 score based on field presence)
ALTER TABLE public.meta_conversion_events
  ADD COLUMN IF NOT EXISTS match_score INTEGER CHECK (match_score >= 0 AND match_score <= 100),
  ADD COLUMN IF NOT EXISTS match_quality TEXT CHECK (match_quality IN ('poor', 'fair', 'good', 'very_good', 'excellent', NULL));

-- Create unique index on dedupe_key for idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_meta_conversion_events_dedupe
  ON public.meta_conversion_events(organization_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

-- Index for efficient outbox processing (pending events ready for processing)
DROP INDEX IF EXISTS idx_meta_conversion_events_retry;
CREATE INDEX idx_meta_conversion_events_outbox
  ON public.meta_conversion_events(status, next_retry_at)
  WHERE status IN ('pending', 'failed') AND (retry_count < 5 OR retry_count IS NULL);

-- ============================================================================
-- 3. Update client_api_credentials platform constraint for meta_capi
-- ============================================================================

-- Drop existing constraint if it exists
ALTER TABLE public.client_api_credentials
  DROP CONSTRAINT IF EXISTS client_api_credentials_platform_check;

-- Add updated constraint including meta_capi
ALTER TABLE public.client_api_credentials
  ADD CONSTRAINT client_api_credentials_platform_check
  CHECK (platform IN ('meta', 'meta_capi', 'switchboard', 'actblue'));

-- ============================================================================
-- 4. Add helper function for updating CAPI health stats
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_capi_health_stats(
  p_organization_id UUID,
  p_success BOOLEAN,
  p_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.meta_capi_config
  SET
    last_send_at = now(),
    last_send_status = CASE WHEN p_success THEN 'success' ELSE 'failed' END,
    last_error = CASE WHEN p_success THEN NULL ELSE p_error END,
    total_events_sent = CASE WHEN p_success THEN total_events_sent + 1 ELSE total_events_sent END,
    total_events_failed = CASE WHEN NOT p_success THEN total_events_failed + 1 ELSE total_events_failed END,
    updated_at = now()
  WHERE organization_id = p_organization_id;
END;
$$;

-- ============================================================================
-- 5. Add scheduled job for processing CAPI outbox
-- ============================================================================

INSERT INTO public.scheduled_jobs (job_name, job_type, schedule, endpoint, is_active)
VALUES (
  'Process Meta CAPI Outbox',
  'process_meta_capi_outbox',
  '* * * * *',  -- Every minute
  'process-meta-capi-outbox',
  true
)
ON CONFLICT (job_type) DO UPDATE SET
  job_name = EXCLUDED.job_name,
  schedule = EXCLUDED.schedule,
  endpoint = EXCLUDED.endpoint,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- Add heartbeat monitoring
INSERT INTO public.pipeline_heartbeat (job_type, job_name, sla_minutes, is_critical)
VALUES (
  'process_meta_capi_outbox',
  'Meta CAPI Outbox Processor',
  5,
  true
)
ON CONFLICT (job_type) DO UPDATE SET
  job_name = EXCLUDED.job_name,
  sla_minutes = EXCLUDED.sla_minutes;

-- ============================================================================
-- 6. Comments for documentation
-- ============================================================================

COMMENT ON TABLE public.meta_capi_config IS
  'Per-organization Meta Conversions API configuration. Stores pixel_id, privacy settings, and health metrics.
   Access tokens are stored separately in client_api_credentials with platform=meta_capi.';

COMMENT ON COLUMN public.meta_capi_config.privacy_mode IS
  'Controls which user data fields are sent to Meta:
   - conservative: email OR phone, zip, country, external_id, fbp, fbc
   - balanced: + first_name, last_name, city, state
   - aggressive: + client_ip_address, client_user_agent
   Never sends: employer, occupation, street address';

COMMENT ON COLUMN public.meta_capi_config.actblue_owns_donation_complete IS
  'If true, ActBlue sends DonationComplete events to Meta CAPI directly.
   Platform will skip sending donation events to avoid double-counting.';

COMMENT ON COLUMN public.meta_conversion_events.dedupe_key IS
  'Idempotency key: {event_name}:{org_id}:{source_id}
   Prevents duplicate events from being enqueued.';

COMMENT ON COLUMN public.meta_conversion_events.user_data_hashed IS
  'Pre-hashed user data using SHA-256. NO PLAINTEXT PII is stored.
   Contains Meta CAPI field names with hashed values: em, ph, fn, ln, ct, st, zp, country.
   Hashing is done BEFORE storage for security. Privacy mode filtering happens at send time.';
