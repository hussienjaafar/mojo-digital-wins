-- Fix CAPI deduplication: Replace non-unique index with unique constraint
DROP INDEX IF EXISTS idx_mce_dedupe;

CREATE UNIQUE INDEX IF NOT EXISTS idx_meta_conversion_events_dedupe
  ON public.meta_conversion_events(organization_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

-- Add missing ad_id column to attribution_touchpoints
ALTER TABLE public.attribution_touchpoints
  ADD COLUMN IF NOT EXISTS ad_id TEXT;

CREATE INDEX IF NOT EXISTS idx_touchpoints_ad_id 
  ON public.attribution_touchpoints(ad_id) 
  WHERE ad_id IS NOT NULL;

-- Add missing metadata column to webhook_logs
ALTER TABLE public.webhook_logs
  ADD COLUMN IF NOT EXISTS metadata JSONB;