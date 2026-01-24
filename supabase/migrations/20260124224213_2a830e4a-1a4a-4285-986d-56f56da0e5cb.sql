-- Create meta_adsets table to store real ad set names from Meta API
CREATE TABLE IF NOT EXISTS public.meta_adsets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES client_organizations(id) ON DELETE CASCADE,
  adset_id TEXT NOT NULL,
  adset_name TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  status TEXT DEFAULT 'ACTIVE',
  targeting_summary JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, adset_id)
);

-- Create index for lookups
CREATE INDEX IF NOT EXISTS idx_meta_adsets_org_id ON public.meta_adsets(organization_id);
CREATE INDEX IF NOT EXISTS idx_meta_adsets_campaign_id ON public.meta_adsets(campaign_id);

-- Enable RLS
ALTER TABLE public.meta_adsets ENABLE ROW LEVEL SECURITY;

-- Allow org members to view their adsets
CREATE POLICY "Users can view own org adsets"
  ON public.meta_adsets FOR SELECT
  USING (user_belongs_to_organization(organization_id));

-- Allow service role and admins to manage adsets
CREATE POLICY "Admins can manage adsets"
  ON public.meta_adsets FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_meta_adsets_updated_at
  BEFORE UPDATE ON public.meta_adsets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();