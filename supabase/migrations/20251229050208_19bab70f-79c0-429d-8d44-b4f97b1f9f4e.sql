-- Phase 1: Create missing tables for data pipeline

-- 1. Create donor_journeys table for tracking donor lifecycle events
CREATE TABLE public.donor_journeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  donor_key text NOT NULL, -- hashed donor identifier for privacy
  event_type text NOT NULL, -- first_donation, repeat_donation, recurring_signup, recurring_cancel, sms_click, ad_view, email_click, etc.
  occurred_at timestamp with time zone NOT NULL,
  amount numeric NULL, -- for donation events
  net_amount numeric NULL,
  source text NULL, -- actblue, meta, sms, email
  refcode text NULL,
  campaign_id text NULL,
  transaction_id text NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Indexes for donor_journeys
CREATE INDEX idx_donor_journeys_org_id ON public.donor_journeys(organization_id);
CREATE INDEX idx_donor_journeys_donor_key ON public.donor_journeys(donor_key);
CREATE INDEX idx_donor_journeys_occurred_at ON public.donor_journeys(occurred_at DESC);
CREATE INDEX idx_donor_journeys_event_type ON public.donor_journeys(event_type);
CREATE INDEX idx_donor_journeys_org_donor ON public.donor_journeys(organization_id, donor_key);

-- Enable RLS
ALTER TABLE public.donor_journeys ENABLE ROW LEVEL SECURITY;

-- RLS Policies for donor_journeys
CREATE POLICY "donor_journeys_select_org" ON public.donor_journeys
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.user_belongs_to_organization(organization_id)
  );

CREATE POLICY "donor_journeys_insert_org" ON public.donor_journeys
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.user_belongs_to_organization(organization_id)
  );

CREATE POLICY "donor_journeys_update_org" ON public.donor_journeys
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.user_belongs_to_organization(organization_id)
  );

CREATE POLICY "donor_journeys_delete_admin" ON public.donor_journeys
  FOR DELETE USING (
    public.has_role(auth.uid(), 'admin'::app_role)
  );

-- 2. Create donor_ltv_predictions table for ML/heuristic LTV predictions
CREATE TABLE public.donor_ltv_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  donor_key text NOT NULL, -- hashed donor identifier
  predicted_ltv_30 numeric NULL, -- 30-day predicted lifetime value
  predicted_ltv_90 numeric NULL, -- 90-day predicted lifetime value
  predicted_ltv_180 numeric NULL, -- 180-day predicted lifetime value
  predicted_ltv_365 numeric NULL, -- 365-day predicted lifetime value
  churn_risk numeric NULL, -- 0-1 probability of churning
  churn_risk_label text NULL, -- low, medium, high
  recency_days integer NULL, -- days since last donation
  frequency integer NULL, -- total donation count
  monetary_avg numeric NULL, -- average donation amount
  monetary_total numeric NULL, -- total donated
  rfm_score integer NULL, -- combined RFM score
  segment text NULL, -- champion, loyal, at_risk, lost, etc.
  model_version text NULL, -- version of prediction model used
  confidence_score numeric NULL, -- model confidence 0-1
  calculated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(organization_id, donor_key)
);

-- Indexes for donor_ltv_predictions
CREATE INDEX idx_donor_ltv_org_id ON public.donor_ltv_predictions(organization_id);
CREATE INDEX idx_donor_ltv_donor_key ON public.donor_ltv_predictions(donor_key);
CREATE INDEX idx_donor_ltv_churn_risk ON public.donor_ltv_predictions(churn_risk DESC);
CREATE INDEX idx_donor_ltv_segment ON public.donor_ltv_predictions(segment);
CREATE INDEX idx_donor_ltv_calculated_at ON public.donor_ltv_predictions(calculated_at DESC);

-- Enable RLS
ALTER TABLE public.donor_ltv_predictions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for donor_ltv_predictions
CREATE POLICY "donor_ltv_select_org" ON public.donor_ltv_predictions
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.user_belongs_to_organization(organization_id)
  );

CREATE POLICY "donor_ltv_insert_org" ON public.donor_ltv_predictions
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.user_belongs_to_organization(organization_id)
  );

CREATE POLICY "donor_ltv_update_org" ON public.donor_ltv_predictions
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.user_belongs_to_organization(organization_id)
  );

CREATE POLICY "donor_ltv_delete_admin" ON public.donor_ltv_predictions
  FOR DELETE USING (
    public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Trigger for updated_at
CREATE TRIGGER update_donor_ltv_predictions_updated_at
  BEFORE UPDATE ON public.donor_ltv_predictions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Create sms_events table for granular SMS engagement tracking
CREATE TABLE public.sms_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  phone_hash text NOT NULL, -- hashed phone for privacy
  event_type text NOT NULL, -- sent, delivered, failed, clicked, opted_out, replied
  occurred_at timestamp with time zone NOT NULL,
  campaign_id text NULL,
  campaign_name text NULL,
  message_id text NULL,
  link_clicked text NULL, -- for click events
  reply_text text NULL, -- for reply events (masked if needed)
  error_code text NULL, -- for failed events
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Indexes for sms_events
CREATE INDEX idx_sms_events_org_id ON public.sms_events(organization_id);
CREATE INDEX idx_sms_events_phone_hash ON public.sms_events(phone_hash);
CREATE INDEX idx_sms_events_occurred_at ON public.sms_events(occurred_at DESC);
CREATE INDEX idx_sms_events_event_type ON public.sms_events(event_type);
CREATE INDEX idx_sms_events_campaign_id ON public.sms_events(campaign_id);
CREATE INDEX idx_sms_events_org_campaign ON public.sms_events(organization_id, campaign_id);

-- Enable RLS
ALTER TABLE public.sms_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sms_events
CREATE POLICY "sms_events_select_org" ON public.sms_events
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.user_belongs_to_organization(organization_id)
  );

CREATE POLICY "sms_events_insert_org" ON public.sms_events
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.user_belongs_to_organization(organization_id)
  );

CREATE POLICY "sms_events_update_org" ON public.sms_events
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.user_belongs_to_organization(organization_id)
  );

CREATE POLICY "sms_events_delete_admin" ON public.sms_events
  FOR DELETE USING (
    public.has_role(auth.uid(), 'admin'::app_role)
  );