-- Migration: Ad-Level Daily Metrics Table
-- Purpose: Enable TRUE ad-level ROAS tracking by storing daily metrics per ad_id
-- The existing meta_ad_metrics table stores campaign-level aggregates with empty ad_id.
-- This new table stores granular ad-level data for accurate ROAS calculations.

-- Create the ad-level daily metrics table
CREATE TABLE IF NOT EXISTS public.meta_ad_metrics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.client_organizations(id) ON DELETE CASCADE NOT NULL,
  ad_account_id TEXT NOT NULL,
  date DATE NOT NULL,
  ad_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  adset_id TEXT,
  creative_id TEXT,
  ad_name TEXT,
  -- Core metrics from Meta Ads API
  spend DECIMAL(12,4) DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  -- Derived metrics from Meta API
  cpc DECIMAL(12,6),
  cpm DECIMAL(12,6),
  ctr DECIMAL(12,6),
  frequency DECIMAL(10,4),
  -- Conversion metrics
  conversions INTEGER DEFAULT 0,
  conversion_value DECIMAL(12,4) DEFAULT 0,
  cost_per_result DECIMAL(12,6),
  -- Meta's calculated ROAS (from purchase_roas field)
  meta_roas DECIMAL(12,6),
  -- Quality metrics
  quality_ranking TEXT,
  engagement_ranking TEXT,
  conversion_ranking TEXT,
  -- Tracking
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  -- Unique constraint: one row per org/account/date/ad combination
  CONSTRAINT meta_ad_metrics_daily_unique UNIQUE (organization_id, ad_account_id, date, ad_id)
);

-- Performance indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_meta_ad_metrics_daily_org_date
  ON public.meta_ad_metrics_daily(organization_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_meta_ad_metrics_daily_ad
  ON public.meta_ad_metrics_daily(ad_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_meta_ad_metrics_daily_campaign
  ON public.meta_ad_metrics_daily(campaign_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_meta_ad_metrics_daily_creative
  ON public.meta_ad_metrics_daily(creative_id, date DESC)
  WHERE creative_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_meta_ad_metrics_daily_lookup
  ON public.meta_ad_metrics_daily(organization_id, date, ad_id);

-- Enable RLS
ALTER TABLE public.meta_ad_metrics_daily ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own organization's metrics
CREATE POLICY "Users can view own org ad metrics daily"
  ON public.meta_ad_metrics_daily FOR SELECT
  USING (organization_id = public.get_user_organization_id());

-- RLS Policy: Admins can manage all metrics
CREATE POLICY "Admins can manage ad metrics daily"
  ON public.meta_ad_metrics_daily FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- RLS Policy: Service role can insert/update (for edge functions)
CREATE POLICY "Service role can manage ad metrics daily"
  ON public.meta_ad_metrics_daily FOR ALL
  USING (auth.role() = 'service_role');

-- Comment for documentation
COMMENT ON TABLE public.meta_ad_metrics_daily IS
  'Stores daily ad-level metrics from Meta Ads API for accurate ROAS calculations. Each row represents one ad on one day.';

COMMENT ON COLUMN public.meta_ad_metrics_daily.ad_id IS
  'Meta Ad ID (required) - this is the primary granularity key';

COMMENT ON COLUMN public.meta_ad_metrics_daily.creative_id IS
  'Meta Creative ID (optional) - populated when available from ad.creative field';

COMMENT ON COLUMN public.meta_ad_metrics_daily.meta_roas IS
  'ROAS value from Meta API purchase_roas field - matches Ads Manager exactly';
