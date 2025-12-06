-- Fix the SECURITY DEFINER view issue by recreating it with SECURITY INVOKER
DROP VIEW IF EXISTS public.data_freshness_summary;

CREATE VIEW public.data_freshness_summary 
WITH (security_invoker = true) AS
SELECT 
  df.source,
  df.organization_id,
  co.name as organization_name,
  df.last_synced_at,
  df.last_sync_status,
  df.latest_data_timestamp,
  ROUND(df.data_lag_hours::numeric, 1) as data_lag_hours,
  df.freshness_sla_hours,
  df.is_within_sla,
  CASE 
    WHEN df.last_synced_at IS NULL THEN 'Never synced'
    WHEN df.is_within_sla THEN 'Fresh'
    WHEN df.data_lag_hours <= df.freshness_sla_hours * 1.5 THEN 'Slightly stale'
    ELSE 'Stale'
  END as freshness_status,
  CASE 
    WHEN df.source = 'meta' THEN 'Meta Ads'
    WHEN df.source = 'actblue_webhook' THEN 'ActBlue (Real-time)'
    WHEN df.source = 'actblue_csv' THEN 'ActBlue (CSV)'
    WHEN df.source = 'switchboard' THEN 'Switchboard SMS'
    ELSE df.source
  END as source_display_name,
  df.records_synced,
  df.last_error,
  df.updated_at
FROM public.data_freshness df
LEFT JOIN public.client_organizations co ON df.organization_id = co.id;

-- Grant access to view
GRANT SELECT ON public.data_freshness_summary TO authenticated;

-- Update scheduled jobs to meet freshness SLAs
-- 1. Enable ActBlue CSV sync and increase frequency
UPDATE public.scheduled_jobs 
SET is_active = true, schedule = '0 */6 * * *'
WHERE job_type = 'sync_actblue_csv';

-- 2. Increase Switchboard sync frequency to every hour
UPDATE public.scheduled_jobs 
SET schedule = '0 * * * *'
WHERE job_type = 'sync_switchboard_sms';