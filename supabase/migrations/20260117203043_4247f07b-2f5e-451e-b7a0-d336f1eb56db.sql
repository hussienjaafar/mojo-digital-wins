-- =====================================================
-- COMPLETE CAPI REPAIR (Atomic)
-- =====================================================

-- 1. FIX PLATFORM CHECK CONSTRAINT
DO $$ 
BEGIN
  -- Drop if exists
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_api_credentials_platform_check') THEN
    ALTER TABLE public.client_api_credentials DROP CONSTRAINT client_api_credentials_platform_check;
  END IF;
END $$;

ALTER TABLE public.client_api_credentials 
  ADD CONSTRAINT client_api_credentials_platform_check 
  CHECK (platform = ANY (ARRAY['meta'::text, 'meta_capi'::text, 'switchboard'::text, 'actblue'::text]));

-- 2. CREATE META_CONVERSION_EVENTS IF NOT EXISTS
CREATE TABLE IF NOT EXISTS public.meta_conversion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  pixel_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_time BIGINT NOT NULL,
  event_source_url TEXT,
  action_source TEXT DEFAULT 'website',
  user_data_hashed JSONB,
  fbp TEXT,
  fbc TEXT,
  external_id TEXT,
  custom_data JSONB,
  source_type TEXT,
  source_id TEXT,
  dedupe_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT,
  delivered_at TIMESTAMPTZ,
  meta_response JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add FK if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'meta_conversion_events_organization_id_fkey' 
    AND table_name = 'meta_conversion_events'
  ) THEN
    ALTER TABLE public.meta_conversion_events 
      ADD CONSTRAINT meta_conversion_events_organization_id_fkey 
      FOREIGN KEY (organization_id) REFERENCES public.client_organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mce_status_retry ON public.meta_conversion_events(status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_mce_org_status ON public.meta_conversion_events(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_mce_dedupe ON public.meta_conversion_events(organization_id, dedupe_key);
CREATE INDEX IF NOT EXISTS idx_mce_source ON public.meta_conversion_events(source_type, source_id);

-- Enable RLS
ALTER TABLE public.meta_conversion_events ENABLE ROW LEVEL SECURITY;

-- Policy
DROP POLICY IF EXISTS "Admins can manage conversion events" ON public.meta_conversion_events;
CREATE POLICY "Admins can manage conversion events" 
  ON public.meta_conversion_events FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));

-- 3. ADD MISSING COLUMNS TO META_CAPI_CONFIG
ALTER TABLE public.meta_capi_config ADD COLUMN IF NOT EXISTS hash_email BOOLEAN DEFAULT true;
ALTER TABLE public.meta_capi_config ADD COLUMN IF NOT EXISTS hash_phone BOOLEAN DEFAULT true;
ALTER TABLE public.meta_capi_config ADD COLUMN IF NOT EXISTS hash_name BOOLEAN DEFAULT true;
ALTER TABLE public.meta_capi_config ADD COLUMN IF NOT EXISTS hash_address BOOLEAN DEFAULT true;
ALTER TABLE public.meta_capi_config ADD COLUMN IF NOT EXISTS donation_event_name TEXT DEFAULT 'Purchase';
ALTER TABLE public.meta_capi_config ADD COLUMN IF NOT EXISTS recurring_event_name TEXT DEFAULT 'Subscribe';
ALTER TABLE public.meta_capi_config ADD COLUMN IF NOT EXISTS actblue_integration_enabled BOOLEAN DEFAULT true;
ALTER TABLE public.meta_capi_config ADD COLUMN IF NOT EXISTS actblue_owns_donation_complete BOOLEAN DEFAULT true;
ALTER TABLE public.meta_capi_config ADD COLUMN IF NOT EXISTS last_success_at TIMESTAMPTZ;
ALTER TABLE public.meta_capi_config ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER DEFAULT 0;
ALTER TABLE public.meta_capi_config ADD COLUMN IF NOT EXISTS last_send_at TIMESTAMPTZ;
ALTER TABLE public.meta_capi_config ADD COLUMN IF NOT EXISTS last_send_status TEXT;
ALTER TABLE public.meta_capi_config ADD COLUMN IF NOT EXISTS total_events_sent INTEGER DEFAULT 0;
ALTER TABLE public.meta_capi_config ADD COLUMN IF NOT EXISTS total_events_failed INTEGER DEFAULT 0;

-- 4. UPDATED_AT TRIGGER
CREATE OR REPLACE FUNCTION public.update_meta_conversion_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_meta_conversion_events_updated_at ON public.meta_conversion_events;
CREATE TRIGGER update_meta_conversion_events_updated_at
  BEFORE UPDATE ON public.meta_conversion_events
  FOR EACH ROW EXECUTE FUNCTION public.update_meta_conversion_events_updated_at();