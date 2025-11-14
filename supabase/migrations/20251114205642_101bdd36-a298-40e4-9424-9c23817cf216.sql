-- 1. EXTEND sms_campaign_metrics table with detailed Switchboard data
ALTER TABLE public.sms_campaign_metrics
ADD COLUMN delivery_rate DECIMAL(5,2),
ADD COLUMN opt_out_rate DECIMAL(5,2),
ADD COLUMN click_through_rate DECIMAL(5,2),
ADD COLUMN conversion_rate DECIMAL(5,2),
ADD COLUMN cost_per_conversion DECIMAL(10,2),
ADD COLUMN time_to_conversion INTEGER,
ADD COLUMN audience_segment TEXT,
ADD COLUMN a_b_test_variant TEXT,
ADD COLUMN message_content TEXT,
ADD COLUMN send_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN delivery_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN bounce_rate DECIMAL(5,2);

-- 2. Create enum for creative types
CREATE TYPE public.creative_type AS ENUM ('image', 'video', 'carousel', 'collection', 'slideshow');

-- 3. EXPAND meta_ad_metrics table with creative and audience data
ALTER TABLE public.meta_ad_metrics
ADD COLUMN ad_creative_id TEXT,
ADD COLUMN ad_creative_name TEXT,
ADD COLUMN creative_type public.creative_type,
ADD COLUMN audience_demographics JSONB,
ADD COLUMN conversion_funnel_data JSONB,
ADD COLUMN cost_per_result DECIMAL(10,2),
ADD COLUMN frequency DECIMAL(10,2),
ADD COLUMN relevance_score DECIMAL(5,2),
ADD COLUMN attribution_window TEXT,
ADD COLUMN placement TEXT,
ADD COLUMN device_platform TEXT;

-- 4. CREATE new roi_analytics table for multi-attribution tracking
CREATE TABLE public.roi_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  date DATE NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('meta', 'sms', 'actblue')),
  first_touch_attribution DECIMAL(10,2) DEFAULT 0,
  last_touch_attribution DECIMAL(10,2) DEFAULT 0,
  linear_attribution DECIMAL(10,2) DEFAULT 0,
  time_decay_attribution DECIMAL(10,2) DEFAULT 0,
  position_based_attribution DECIMAL(10,2) DEFAULT 0,
  ltv_roi DECIMAL(10,2),
  campaign_roas DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(organization_id, campaign_id, date, platform)
);

-- Enable RLS on roi_analytics
ALTER TABLE public.roi_analytics ENABLE ROW LEVEL SECURITY;

-- RLS policies for roi_analytics
CREATE POLICY "Users can view own org roi analytics"
ON public.roi_analytics
FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage all roi analytics"
ON public.roi_analytics
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. ENABLE REAL-TIME on metrics tables
ALTER TABLE public.meta_ad_metrics REPLICA IDENTITY FULL;
ALTER TABLE public.sms_campaign_metrics REPLICA IDENTITY FULL;
ALTER TABLE public.actblue_transactions REPLICA IDENTITY FULL;
ALTER TABLE public.roi_analytics REPLICA IDENTITY FULL;
ALTER TABLE public.daily_aggregated_metrics REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.meta_ad_metrics;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sms_campaign_metrics;
ALTER PUBLICATION supabase_realtime ADD TABLE public.actblue_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.roi_analytics;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_aggregated_metrics;

-- 6. CREATE PERFORMANCE INDEXES
-- Composite indexes on (organization_id, date) for all metrics tables
CREATE INDEX idx_meta_ad_metrics_org_date 
ON public.meta_ad_metrics(organization_id, date DESC);

CREATE INDEX idx_sms_campaign_metrics_org_date 
ON public.sms_campaign_metrics(organization_id, date DESC);

CREATE INDEX idx_actblue_transactions_org_date 
ON public.actblue_transactions(organization_id, transaction_date DESC);

CREATE INDEX idx_roi_analytics_org_date 
ON public.roi_analytics(organization_id, date DESC);

CREATE INDEX idx_daily_aggregated_metrics_org_date 
ON public.daily_aggregated_metrics(organization_id, date DESC);

-- Campaign ID indexes for faster lookups
CREATE INDEX idx_meta_ad_metrics_campaign 
ON public.meta_ad_metrics(campaign_id, date DESC);

CREATE INDEX idx_sms_campaign_metrics_campaign 
ON public.sms_campaign_metrics(campaign_id, date DESC);

CREATE INDEX idx_roi_analytics_campaign 
ON public.roi_analytics(campaign_id, date DESC);

-- Additional performance indexes
CREATE INDEX idx_meta_ad_metrics_creative 
ON public.meta_ad_metrics(ad_creative_id) WHERE ad_creative_id IS NOT NULL;

CREATE INDEX idx_sms_campaign_metrics_segment 
ON public.sms_campaign_metrics(audience_segment) WHERE audience_segment IS NOT NULL;

-- 7. CREATE MATERIALIZED VIEW for aggregated metrics
CREATE MATERIALIZED VIEW public.mv_daily_metrics_summary AS
SELECT 
  organization_id,
  date,
  SUM(total_ad_spend) as total_ad_spend,
  SUM(total_sms_cost) as total_sms_cost,
  SUM(total_funds_raised) as total_funds_raised,
  SUM(total_donations) as total_donations,
  AVG(roi_percentage) as avg_roi_percentage,
  SUM(meta_clicks) as total_meta_clicks,
  SUM(meta_impressions) as total_meta_impressions,
  SUM(sms_sent) as total_sms_sent,
  SUM(sms_conversions) as total_sms_conversions,
  SUM(new_donors) as total_new_donors,
  COUNT(*) as days_count,
  MAX(calculated_at) as last_calculated
FROM public.daily_aggregated_metrics
GROUP BY organization_id, date;

-- Create index on materialized view
CREATE UNIQUE INDEX idx_mv_daily_metrics_org_date 
ON public.mv_daily_metrics_summary(organization_id, date DESC);

-- Create function to refresh materialized view
CREATE OR REPLACE FUNCTION public.refresh_daily_metrics_summary()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_daily_metrics_summary;
END;
$$;

-- Add trigger to automatically update roi_analytics timestamp
CREATE TRIGGER update_roi_analytics_updated_at
BEFORE UPDATE ON public.roi_analytics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE public.roi_analytics IS 'Multi-attribution tracking for ROI analysis across platforms';
COMMENT ON COLUMN public.sms_campaign_metrics.delivery_rate IS 'Percentage of messages successfully delivered';
COMMENT ON COLUMN public.sms_campaign_metrics.conversion_rate IS 'Percentage of recipients who converted';
COMMENT ON COLUMN public.meta_ad_metrics.creative_type IS 'Type of ad creative (image, video, carousel, etc.)';
COMMENT ON COLUMN public.meta_ad_metrics.audience_demographics IS 'JSON object containing demographic breakdowns';
COMMENT ON MATERIALIZED VIEW public.mv_daily_metrics_summary IS 'Aggregated daily metrics summary for faster reporting';