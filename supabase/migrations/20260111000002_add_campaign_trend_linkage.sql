-- Phase 2: Add trend_event_id linkage to campaign tables
-- This enables the feedback loop: campaigns can be traced back to the trends that generated them

-- Add trend_event_id to meta_campaigns
ALTER TABLE public.meta_campaigns
ADD COLUMN IF NOT EXISTS trend_event_id UUID REFERENCES public.trend_events(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS suggested_action_id UUID;

-- Add trend_event_id to sms_campaigns
ALTER TABLE public.sms_campaigns
ADD COLUMN IF NOT EXISTS trend_event_id UUID REFERENCES public.trend_events(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS suggested_action_id UUID;

-- Add indexes for learning queries (partial indexes for non-null values)
CREATE INDEX IF NOT EXISTS idx_meta_campaigns_trend
ON public.meta_campaigns(trend_event_id)
WHERE trend_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sms_campaigns_trend
ON public.sms_campaigns(trend_event_id)
WHERE trend_event_id IS NOT NULL;

-- Add composite index for org + trend queries
CREATE INDEX IF NOT EXISTS idx_meta_campaigns_org_trend
ON public.meta_campaigns(organization_id, trend_event_id)
WHERE trend_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sms_campaigns_org_trend
ON public.sms_campaigns(organization_id, trend_event_id)
WHERE trend_event_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.meta_campaigns.trend_event_id IS 'Links this campaign back to the trend_event that generated it for learning feedback';
COMMENT ON COLUMN public.meta_campaigns.suggested_action_id IS 'The suggested_action record that was used to create this campaign';
COMMENT ON COLUMN public.sms_campaigns.trend_event_id IS 'Links this campaign back to the trend_event that generated it for learning feedback';
COMMENT ON COLUMN public.sms_campaigns.suggested_action_id IS 'The suggested_action record that was used to create this campaign';
