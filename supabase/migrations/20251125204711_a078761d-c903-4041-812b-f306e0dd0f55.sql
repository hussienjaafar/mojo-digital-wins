
-- Enable RLS on monitoring tables that currently have it disabled
-- These are operational/monitoring tables that should be read-only for admins

-- Enable RLS on backfill_status table
ALTER TABLE public.backfill_status ENABLE ROW LEVEL SECURITY;

-- Create policy: Only admins can read backfill status
CREATE POLICY "Admins can view backfill status"
ON public.backfill_status
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'::app_role
  )
);

-- Create policy: Service role can insert/update backfill status (for edge functions)
CREATE POLICY "Service role can manage backfill status"
ON public.backfill_status
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Enable RLS on bluesky_velocity_metrics table
ALTER TABLE public.bluesky_velocity_metrics ENABLE ROW LEVEL SECURITY;

-- Create policy: Only admins can read velocity metrics
CREATE POLICY "Admins can view velocity metrics"
ON public.bluesky_velocity_metrics
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'::app_role
  )
);

-- Create policy: Service role can insert velocity metrics (for edge functions)
CREATE POLICY "Service role can manage velocity metrics"
ON public.bluesky_velocity_metrics
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
