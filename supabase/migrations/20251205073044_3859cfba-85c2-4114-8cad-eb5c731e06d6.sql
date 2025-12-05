-- Create sms_campaigns table for Switchboard SMS data
CREATE TABLE IF NOT EXISTS public.sms_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.client_organizations(id),
  campaign_id TEXT NOT NULL,
  campaign_name TEXT,
  status TEXT,
  messages_sent INTEGER DEFAULT 0,
  messages_delivered INTEGER DEFAULT 0,
  messages_failed INTEGER DEFAULT 0,
  opt_outs INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  amount_raised DECIMAL(12,2) DEFAULT 0,
  cost DECIMAL(12,2) DEFAULT 0,
  message_text TEXT,
  phone_list_name TEXT,
  replies INTEGER DEFAULT 0,
  skipped INTEGER DEFAULT 0,
  previously_opted_out INTEGER DEFAULT 0,
  send_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, campaign_id)
);

-- Enable RLS
ALTER TABLE public.sms_campaigns ENABLE ROW LEVEL SECURITY;

-- RLS policies for sms_campaigns
CREATE POLICY "Users can view their organization SMS campaigns"
  ON public.sms_campaigns
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM client_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all SMS campaigns"
  ON public.sms_campaigns
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Create index for faster queries
CREATE INDEX idx_sms_campaigns_org_date ON public.sms_campaigns(organization_id, send_date DESC);
CREATE INDEX idx_sms_campaigns_campaign_id ON public.sms_campaigns(campaign_id);