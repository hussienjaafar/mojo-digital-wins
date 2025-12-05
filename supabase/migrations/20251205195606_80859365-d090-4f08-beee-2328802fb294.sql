-- Create webhook_logs table for tracking incoming webhooks
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL,
  event_type TEXT,
  payload JSONB,
  headers JSONB,
  processing_status TEXT DEFAULT 'received',
  error_message TEXT,
  organization_id UUID REFERENCES public.client_organizations(id),
  received_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add index for querying recent webhooks
CREATE INDEX IF NOT EXISTS idx_webhook_logs_platform_received ON public.webhook_logs(platform, received_at DESC);

-- Enable RLS
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view webhook logs
CREATE POLICY "Admins can view webhook logs"
ON public.webhook_logs FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));