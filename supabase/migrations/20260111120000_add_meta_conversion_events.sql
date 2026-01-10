-- Add Meta conversion events storage for server-side tracking

CREATE TABLE IF NOT EXISTS public.meta_conversion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.client_organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_id TEXT,
  event_name TEXT NOT NULL,
  event_source_url TEXT,
  event_time TIMESTAMPTZ NOT NULL,
  campaign_id TEXT,
  ad_set_id TEXT,
  ad_id TEXT,
  trend_event_id UUID REFERENCES public.trend_events(id) ON DELETE SET NULL,
  refcode TEXT,
  custom_data JSONB,
  meta_response JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'retrying')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_meta_conversion_events_org_event
  ON public.meta_conversion_events(organization_id, event_id)
  WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_meta_conversion_events_org_time
  ON public.meta_conversion_events(organization_id, event_time DESC);

CREATE INDEX IF NOT EXISTS idx_meta_conversion_events_trend
  ON public.meta_conversion_events(trend_event_id)
  WHERE trend_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_meta_conversion_events_campaign
  ON public.meta_conversion_events(campaign_id)
  WHERE campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_meta_conversion_events_retry
  ON public.meta_conversion_events(status, next_retry_at)
  WHERE status IN ('failed', 'retrying');

ALTER TABLE public.meta_conversion_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org conversion events"
  ON public.meta_conversion_events FOR SELECT
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Admins can manage conversion events"
  ON public.meta_conversion_events FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Queue table for retrying failed Meta conversion deliveries
CREATE TABLE IF NOT EXISTS public.meta_conversion_retry_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_conversion_event_id UUID REFERENCES public.meta_conversion_events(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.client_organizations(id) ON DELETE CASCADE NOT NULL,
  event_id TEXT NOT NULL,
  event_payload JSONB NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_meta_conversion_retry_queue_event
  ON public.meta_conversion_retry_queue(organization_id, event_id);

CREATE INDEX IF NOT EXISTS idx_meta_conversion_retry_queue_next
  ON public.meta_conversion_retry_queue(next_retry_at);

ALTER TABLE public.meta_conversion_retry_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_manage_meta_conversion_retry_queue"
  ON public.meta_conversion_retry_queue FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
