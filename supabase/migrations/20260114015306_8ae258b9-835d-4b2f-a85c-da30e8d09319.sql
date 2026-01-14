
-- Create refcode_mapping_history table to track refcode usage across multiple ads over time
-- This allows proper attribution of donations to the correct ad based on transaction_date

CREATE TABLE IF NOT EXISTS public.refcode_mapping_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  refcode TEXT NOT NULL,
  ad_id TEXT NOT NULL,
  campaign_id TEXT,
  creative_id TEXT,
  landing_page TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Each (org, refcode, ad_id) combo is unique
  CONSTRAINT refcode_mapping_history_unique UNIQUE (organization_id, refcode, ad_id)
);

-- Enable RLS
ALTER TABLE public.refcode_mapping_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view refcode history for their organization"
  ON public.refcode_mapping_history
  FOR SELECT
  USING (can_access_organization_data(organization_id));

CREATE POLICY "Service role can manage refcode history"
  ON public.refcode_mapping_history
  FOR ALL
  USING (auth.role() = 'service_role');

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_refcode_history_org_refcode 
  ON public.refcode_mapping_history(organization_id, refcode);

CREATE INDEX IF NOT EXISTS idx_refcode_history_org_refcode_dates 
  ON public.refcode_mapping_history(organization_id, refcode, first_seen_at, last_seen_at);

CREATE INDEX IF NOT EXISTS idx_refcode_history_ad_id 
  ON public.refcode_mapping_history(ad_id);

-- Create trigger for updated_at
CREATE TRIGGER update_refcode_mapping_history_updated_at
  BEFORE UPDATE ON public.refcode_mapping_history
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill existing refcode_mappings into history table
INSERT INTO public.refcode_mapping_history (
  organization_id, refcode, ad_id, campaign_id, creative_id, landing_page,
  first_seen_at, last_seen_at, is_active, created_at
)
SELECT 
  organization_id,
  refcode,
  ad_id,
  campaign_id,
  creative_id,
  landing_page,
  COALESCE(created_at, now()),
  COALESCE(updated_at, now()),
  true,
  COALESCE(created_at, now())
FROM public.refcode_mappings
WHERE ad_id IS NOT NULL
ON CONFLICT (organization_id, refcode, ad_id) DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE public.refcode_mapping_history IS 
  'Tracks historical mapping of refcodes to ads over time. Used for accurate donation attribution when refcodes are reused across multiple ads.';
