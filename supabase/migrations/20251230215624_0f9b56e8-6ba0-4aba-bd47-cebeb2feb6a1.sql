-- Create donor_identity_links table for cross-referencing phone and email based donor identities
CREATE TABLE IF NOT EXISTS public.donor_identity_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  email_hash TEXT,
  phone_hash TEXT,
  donor_email TEXT,
  confidence_score NUMERIC DEFAULT 1.0,
  source TEXT DEFAULT 'actblue',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, email_hash, phone_hash)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_donor_identity_links_org ON public.donor_identity_links(organization_id);
CREATE INDEX IF NOT EXISTS idx_donor_identity_links_email ON public.donor_identity_links(email_hash);
CREATE INDEX IF NOT EXISTS idx_donor_identity_links_phone ON public.donor_identity_links(phone_hash);
CREATE INDEX IF NOT EXISTS idx_donor_identity_links_org_phone ON public.donor_identity_links(organization_id, phone_hash);

-- Enable RLS
ALTER TABLE public.donor_identity_links ENABLE ROW LEVEL SECURITY;

-- RLS policies - only organization members can access
CREATE POLICY "Users can view their organization's identity links"
ON public.donor_identity_links
FOR SELECT
USING (public.user_belongs_to_organization(organization_id));

CREATE POLICY "Service role can manage identity links"
ON public.donor_identity_links
FOR ALL
USING (auth.role() = 'service_role');

-- Add refcode column to attribution_touchpoints if not exists (for better donor matching)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'attribution_touchpoints' 
    AND column_name = 'refcode'
  ) THEN
    ALTER TABLE public.attribution_touchpoints ADD COLUMN refcode TEXT;
    CREATE INDEX idx_attribution_touchpoints_refcode ON public.attribution_touchpoints(refcode);
  END IF;
END $$;

-- Add campaign_id column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'attribution_touchpoints' 
    AND column_name = 'campaign_id'
  ) THEN
    ALTER TABLE public.attribution_touchpoints ADD COLUMN campaign_id TEXT;
    CREATE INDEX idx_attribution_touchpoints_campaign ON public.attribution_touchpoints(campaign_id);
  END IF;
END $$;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_donor_identity_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = 'public';

DROP TRIGGER IF EXISTS update_donor_identity_links_timestamp ON public.donor_identity_links;
CREATE TRIGGER update_donor_identity_links_timestamp
  BEFORE UPDATE ON public.donor_identity_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_donor_identity_links_updated_at();