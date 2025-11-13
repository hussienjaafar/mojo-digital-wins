-- Phase 1: Client Portal Database Schema

-- Create client organizations table
CREATE TABLE public.client_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  primary_contact_email TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create client users table (extends auth.users)
CREATE TABLE public.client_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.client_organizations(id) ON DELETE CASCADE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT DEFAULT 'viewer' CHECK (role IN ('viewer', 'manager', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

-- Create API credentials storage table (encrypted)
CREATE TABLE public.client_api_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.client_organizations(id) ON DELETE CASCADE NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('meta', 'switchboard', 'actblue')),
  encrypted_credentials JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, platform)
);

-- Meta Ads Campaign Data
CREATE TABLE public.meta_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.client_organizations(id) ON DELETE CASCADE NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT,
  status TEXT,
  objective TEXT,
  daily_budget DECIMAL(10,2),
  lifetime_budget DECIMAL(10,2),
  start_date DATE,
  end_date DATE,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, campaign_id)
);

-- Meta Ads Daily Metrics
CREATE TABLE public.meta_ad_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.client_organizations(id) ON DELETE CASCADE NOT NULL,
  campaign_id TEXT NOT NULL,
  ad_set_id TEXT,
  ad_id TEXT,
  date DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  spend DECIMAL(10,2) DEFAULT 0,
  reach INTEGER DEFAULT 0,
  cpc DECIMAL(10,4),
  cpm DECIMAL(10,4),
  ctr DECIMAL(10,4),
  conversions INTEGER DEFAULT 0,
  conversion_value DECIMAL(10,2) DEFAULT 0,
  roas DECIMAL(10,4),
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, campaign_id, ad_set_id, ad_id, date)
);

-- Switchboard SMS Metrics
CREATE TABLE public.sms_campaign_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.client_organizations(id) ON DELETE CASCADE NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT,
  date DATE NOT NULL,
  messages_sent INTEGER DEFAULT 0,
  messages_delivered INTEGER DEFAULT 0,
  messages_failed INTEGER DEFAULT 0,
  opt_outs INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  amount_raised DECIMAL(10,2) DEFAULT 0,
  cost DECIMAL(10,2) DEFAULT 0,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, campaign_id, date)
);

-- ActBlue Transaction Data
CREATE TABLE public.actblue_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.client_organizations(id) ON DELETE CASCADE NOT NULL,
  transaction_id TEXT UNIQUE NOT NULL,
  donor_email TEXT,
  donor_name TEXT,
  amount DECIMAL(10,2) NOT NULL,
  refcode TEXT,
  source_campaign TEXT,
  transaction_type TEXT DEFAULT 'donation' CHECK (transaction_type IN ('donation', 'refund', 'cancellation')),
  is_recurring BOOLEAN DEFAULT false,
  transaction_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Aggregated Metrics Table
CREATE TABLE public.daily_aggregated_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.client_organizations(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  total_ad_spend DECIMAL(10,2) DEFAULT 0,
  total_sms_cost DECIMAL(10,2) DEFAULT 0,
  total_funds_raised DECIMAL(10,2) DEFAULT 0,
  total_donations INTEGER DEFAULT 0,
  new_donors INTEGER DEFAULT 0,
  roi_percentage DECIMAL(10,2),
  meta_impressions INTEGER DEFAULT 0,
  meta_clicks INTEGER DEFAULT 0,
  sms_sent INTEGER DEFAULT 0,
  sms_conversions INTEGER DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, date)
);

-- Campaign Attribution Table
CREATE TABLE public.campaign_attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.client_organizations(id) ON DELETE CASCADE NOT NULL,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  refcode TEXT,
  meta_campaign_id TEXT,
  switchboard_campaign_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Phase 2: Security Functions and RLS Policies

-- Function to get user's organization ID
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.client_users WHERE id = auth.uid()
$$;

-- Function to check if user is client admin/manager
CREATE OR REPLACE FUNCTION public.is_client_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'manager')
  )
$$;

-- Enable RLS on all tables
ALTER TABLE public.client_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_api_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_ad_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_campaign_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actblue_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_aggregated_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_attribution ENABLE ROW LEVEL SECURITY;

-- RLS Policies for client_organizations
CREATE POLICY "Users can view own organization"
  ON public.client_organizations FOR SELECT
  USING (id = public.get_user_organization_id());

CREATE POLICY "Admins can view all organizations"
  ON public.client_organizations FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage organizations"
  ON public.client_organizations FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for client_users
CREATE POLICY "Users can view own profile"
  ON public.client_users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can view org members"
  ON public.client_users FOR SELECT
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Admins can manage all client users"
  ON public.client_users FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update own last login"
  ON public.client_users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- RLS Policies for client_api_credentials
CREATE POLICY "Only admins can view credentials"
  ON public.client_api_credentials FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can manage credentials"
  ON public.client_api_credentials FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for meta_campaigns
CREATE POLICY "Users can view own org campaigns"
  ON public.meta_campaigns FOR SELECT
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Admins can view all campaigns"
  ON public.meta_campaigns FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage campaigns"
  ON public.meta_campaigns FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for meta_ad_metrics
CREATE POLICY "Users can view own org metrics"
  ON public.meta_ad_metrics FOR SELECT
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Admins can manage all metrics"
  ON public.meta_ad_metrics FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for sms_campaign_metrics
CREATE POLICY "Users can view own org sms metrics"
  ON public.sms_campaign_metrics FOR SELECT
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Admins can manage sms metrics"
  ON public.sms_campaign_metrics FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for actblue_transactions
CREATE POLICY "Users can view own org transactions"
  ON public.actblue_transactions FOR SELECT
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Admins can manage transactions"
  ON public.actblue_transactions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for daily_aggregated_metrics
CREATE POLICY "Users can view own org aggregated metrics"
  ON public.daily_aggregated_metrics FOR SELECT
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Admins can manage aggregated metrics"
  ON public.daily_aggregated_metrics FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for campaign_attribution
CREATE POLICY "Users can view own org attribution"
  ON public.campaign_attribution FOR SELECT
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Admins can manage attribution"
  ON public.campaign_attribution FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Phase 3: Performance Indexes
CREATE INDEX idx_client_users_org ON public.client_users(organization_id);
CREATE INDEX idx_meta_campaigns_org ON public.meta_campaigns(organization_id);
CREATE INDEX idx_meta_metrics_org_date ON public.meta_ad_metrics(organization_id, date DESC);
CREATE INDEX idx_meta_metrics_campaign ON public.meta_ad_metrics(campaign_id, date DESC);
CREATE INDEX idx_sms_metrics_org_date ON public.sms_campaign_metrics(organization_id, date DESC);
CREATE INDEX idx_transactions_org_date ON public.actblue_transactions(organization_id, transaction_date DESC);
CREATE INDEX idx_transactions_refcode ON public.actblue_transactions(refcode);
CREATE INDEX idx_aggregated_org_date ON public.daily_aggregated_metrics(organization_id, date DESC);
CREATE INDEX idx_attribution_org ON public.campaign_attribution(organization_id);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_client_organizations_updated_at
  BEFORE UPDATE ON public.client_organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_api_credentials_updated_at
  BEFORE UPDATE ON public.client_api_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();