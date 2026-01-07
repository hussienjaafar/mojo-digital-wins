-- Enable RLS on source_health_alerts table
ALTER TABLE public.source_health_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_health_alerts FORCE ROW LEVEL SECURITY;

-- Allow authenticated users to read alerts (system monitoring data)
CREATE POLICY "Authenticated users can view source health alerts"
ON public.source_health_alerts
FOR SELECT
TO authenticated
USING (true);

-- Allow admin users to insert alerts (system creates these)
CREATE POLICY "Admins can insert source health alerts"
ON public.source_health_alerts
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow admin users to update alerts (resolve them)
CREATE POLICY "Admins can update source health alerts"
ON public.source_health_alerts
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow admin users to delete alerts
CREATE POLICY "Admins can delete source health alerts"
ON public.source_health_alerts
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));