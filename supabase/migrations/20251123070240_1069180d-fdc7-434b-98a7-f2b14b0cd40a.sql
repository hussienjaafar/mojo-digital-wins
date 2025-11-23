
-- Create attribution_health_logs table to store health check results
CREATE TABLE IF NOT EXISTS public.attribution_health_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_alerts INTEGER NOT NULL DEFAULT 0,
  critical_alerts INTEGER NOT NULL DEFAULT 0,
  alerts JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.attribution_health_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view health logs
CREATE POLICY "Admins can view health logs"
  ON public.attribution_health_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can insert health logs
CREATE POLICY "Service can insert health logs"
  ON public.attribution_health_logs
  FOR INSERT
  WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_attribution_health_logs_checked_at 
  ON public.attribution_health_logs(checked_at DESC);
