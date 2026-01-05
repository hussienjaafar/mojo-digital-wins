-- Add RLS to new pipeline tables
ALTER TABLE pipeline_heartbeat ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_deadman_alerts ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (admins) to read pipeline status
CREATE POLICY "Allow authenticated read on pipeline_heartbeat"
ON pipeline_heartbeat FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Allow authenticated read on pipeline_deadman_alerts"
ON pipeline_deadman_alerts FOR SELECT TO authenticated
USING (true);

-- Drop security definer from views (convert to security invoker)
DROP VIEW IF EXISTS public.pipeline_freshness;
CREATE VIEW public.pipeline_freshness 
WITH (security_invoker = true)
AS
SELECT
  h.job_type,
  h.job_name,
  h.last_started_at,
  h.last_success_at,
  h.last_failure_at,
  h.last_status,
  h.last_error,
  h.last_duration_ms,
  h.sla_minutes,
  h.is_critical,
  h.consecutive_failures,
  EXTRACT(EPOCH FROM (NOW() - COALESCE(h.last_success_at, h.last_started_at))) / 60 AS age_minutes,
  CASE
    WHEN h.last_status = 'failed' AND h.consecutive_failures >= 3 THEN 'critical'
    WHEN h.last_success_at IS NULL THEN 'unknown'
    WHEN EXTRACT(EPOCH FROM (NOW() - h.last_success_at)) / 60 > h.sla_minutes * 3 THEN 'critical'
    WHEN EXTRACT(EPOCH FROM (NOW() - h.last_success_at)) / 60 > h.sla_minutes THEN 'stale'
    ELSE 'live'
  END AS freshness_status,
  GREATEST(0, h.sla_minutes - EXTRACT(EPOCH FROM (NOW() - COALESCE(h.last_success_at, h.last_started_at))) / 60) AS minutes_until_sla_breach,
  h.updated_at
FROM pipeline_heartbeat h;

GRANT SELECT ON pipeline_freshness TO authenticated, anon;