-- Phase 1.3: Add attribution model version column to transaction_attribution (the actual table)
-- donation_attribution is a VIEW, so we only modify transaction_attribution

-- Add column to track whether attribution is deterministic or heuristic (if not added already)
ALTER TABLE public.transaction_attribution 
ADD COLUMN IF NOT EXISTS is_deterministic BOOLEAN DEFAULT FALSE;

-- Create a dedicated table for storing attribution model metadata per donation
-- This supplements the donation_attribution view without modifying it
CREATE TABLE IF NOT EXISTS public.attribution_model_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.client_organizations(id),
  attribution_model_version TEXT DEFAULT 'v1.0-40-20-40',
  is_deterministic BOOLEAN DEFAULT FALSE,
  attribution_method TEXT, -- 'refcode', 'clickid', 'touchpoint', 'organic', 'unknown'
  channels JSONB, -- Store channel breakdown with weights
  calculated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for lookups
CREATE INDEX IF NOT EXISTS idx_attribution_model_log_transaction 
ON public.attribution_model_log(transaction_id);

CREATE INDEX IF NOT EXISTS idx_attribution_model_log_org 
ON public.attribution_model_log(organization_id);

-- Enable RLS
ALTER TABLE public.attribution_model_log ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their org's attribution logs" 
ON public.attribution_model_log FOR SELECT
USING (public.user_belongs_to_organization(organization_id));

CREATE POLICY "Admins can view all attribution logs"
ON public.attribution_model_log FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert attribution logs"
ON public.attribution_model_log FOR INSERT
WITH CHECK (true);

-- Phase 5.2: Add ingestion_run_id columns for provenance tracking (if not already added)
-- These may have been added in the failed migration, so use IF NOT EXISTS

ALTER TABLE public.sms_events 
ADD COLUMN IF NOT EXISTS ingestion_run_id UUID;

ALTER TABLE public.meta_ad_metrics 
ADD COLUMN IF NOT EXISTS ingestion_run_id UUID;