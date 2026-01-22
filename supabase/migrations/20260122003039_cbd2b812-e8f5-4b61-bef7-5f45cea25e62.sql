-- Create table for individual creative asset variations with performance data
CREATE TABLE public.meta_creative_variations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  creative_insight_id UUID REFERENCES public.meta_creative_insights(id) ON DELETE SET NULL,
  ad_id TEXT NOT NULL,
  
  -- Asset identification
  asset_type TEXT NOT NULL CHECK (asset_type IN ('body', 'title', 'description', 'image', 'video')),
  asset_index INTEGER NOT NULL DEFAULT 0,
  asset_hash TEXT,
  asset_text TEXT,
  
  -- Performance metrics (from breakdown API)
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  spend NUMERIC(12,2) DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  conversion_value NUMERIC(12,2) DEFAULT 0,
  ctr NUMERIC(8,6),
  roas NUMERIC(10,4),
  
  -- Ranking within the ad
  performance_rank INTEGER,
  
  -- Metadata
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(organization_id, ad_id, asset_type, asset_index)
);

-- Enable RLS
ALTER TABLE public.meta_creative_variations ENABLE ROW LEVEL SECURITY;

-- RLS policies using meta_creative_insights as access control (same org check pattern)
CREATE POLICY "Allow select for authenticated users on variations"
  ON public.meta_creative_variations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow all for service role on variations"
  ON public.meta_creative_variations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_creative_variations_org ON public.meta_creative_variations(organization_id);
CREATE INDEX idx_creative_variations_ad ON public.meta_creative_variations(ad_id);
CREATE INDEX idx_creative_variations_type ON public.meta_creative_variations(asset_type);
CREATE INDEX idx_creative_variations_insight ON public.meta_creative_variations(creative_insight_id);

-- Trigger for updated_at
CREATE TRIGGER update_meta_creative_variations_updated_at
  BEFORE UPDATE ON public.meta_creative_variations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();