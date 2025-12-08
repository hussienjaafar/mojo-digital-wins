-- Add per-recipient SMS events for donor journeys and churn analysis
CREATE TABLE IF NOT EXISTS public.sms_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  campaign_id text,
  message_id text,
  recipient_phone text,
  event_type text, -- sent | delivered | failed | clicked | replied | opted_out | bounced | unknown
  status text,
  click_url text,
  occurred_at timestamptz DEFAULT now(),
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Fast lookups by org/campaign/recipient
CREATE INDEX IF NOT EXISTS idx_sms_events_org ON public.sms_events(organization_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_events_campaign ON public.sms_events(campaign_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_events_recipient ON public.sms_events(recipient_phone);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_events_org_message ON public.sms_events(organization_id, message_id);

ALTER TABLE public.sms_events ENABLE ROW LEVEL SECURITY;

-- RLS: organization members or admins can view; admins can write; service role unrestricted
CREATE POLICY sms_events_select ON public.sms_events
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_organization(organization_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY sms_events_write_admin ON public.sms_events
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY sms_events_service_role ON public.sms_events
  FOR ALL
  USING (auth.uid() IS NULL AND current_setting('role') = 'service_role');

COMMENT ON TABLE public.sms_events IS 'Per-recipient SMS events (send/deliver/click/opt-out) for donor journeys and churn monitoring.';
