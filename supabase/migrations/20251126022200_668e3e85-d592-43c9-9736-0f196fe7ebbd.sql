-- Create polling alert configurations table
CREATE TABLE IF NOT EXISTS public.polling_alert_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  state TEXT,
  poll_type TEXT NOT NULL CHECK (poll_type IN ('senate', 'house', 'presidential', 'gubernatorial')),
  threshold_percentage INTEGER NOT NULL DEFAULT 5 CHECK (threshold_percentage > 0 AND threshold_percentage <= 20),
  is_active BOOLEAN NOT NULL DEFAULT true,
  notify_email BOOLEAN NOT NULL DEFAULT true,
  notify_in_app BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.polling_alert_configs ENABLE ROW LEVEL SECURITY;

-- Policies for polling alert configs
CREATE POLICY "Users can view their org's polling alert configs"
  ON public.polling_alert_configs FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.client_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their org's polling alert configs"
  ON public.polling_alert_configs FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.client_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their org's polling alert configs"
  ON public.polling_alert_configs FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.client_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their org's polling alert configs"
  ON public.polling_alert_configs FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.client_users WHERE id = auth.uid()
    )
  );

-- Add index
CREATE INDEX idx_polling_alert_configs_org ON public.polling_alert_configs(organization_id);
CREATE INDEX idx_polling_alert_configs_active ON public.polling_alert_configs(is_active) WHERE is_active = true;

-- Trigger for updated_at
CREATE TRIGGER update_polling_alert_configs_updated_at
  BEFORE UPDATE ON public.polling_alert_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();