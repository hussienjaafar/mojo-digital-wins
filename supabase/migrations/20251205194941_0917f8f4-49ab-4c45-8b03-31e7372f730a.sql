-- Update scheduled_jobs to use correct job_type values (keep endpoint as placeholder)
UPDATE public.scheduled_jobs 
SET job_type = 'sync_actblue_csv', endpoint = 'sync-actblue-csv'
WHERE job_name = 'Sync ActBlue CSV';

UPDATE public.scheduled_jobs 
SET job_type = 'sync_meta_ads', endpoint = 'admin-sync-meta'
WHERE job_name = 'Sync Meta Ads';

UPDATE public.scheduled_jobs 
SET job_type = 'sync_switchboard_sms', endpoint = 'sync-switchboard-sms'
WHERE job_name = 'Sync Switchboard SMS';

UPDATE public.scheduled_jobs 
SET job_type = 'calculate_roi_all', endpoint = 'calculate-roi'
WHERE job_name = 'Calculate ROI All Orgs';

-- Add data_freshness_alerts table for monitoring stale data
CREATE TABLE IF NOT EXISTS public.data_freshness_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.client_organizations(id),
  platform TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  hours_stale NUMERIC,
  last_data_date TIMESTAMPTZ,
  expected_freshness_hours INTEGER DEFAULT 24,
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for checking unresolved alerts
CREATE INDEX IF NOT EXISTS idx_data_freshness_unresolved ON public.data_freshness_alerts(organization_id, is_resolved) WHERE is_resolved = false;

-- RLS for data_freshness_alerts
ALTER TABLE public.data_freshness_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage data freshness alerts"
ON public.data_freshness_alerts FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Client users can view their org alerts"
ON public.data_freshness_alerts FOR SELECT
USING (organization_id = public.get_user_organization_id());