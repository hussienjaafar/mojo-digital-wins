-- Create RPC function to get webhook stats per organization
CREATE OR REPLACE FUNCTION public.get_org_webhook_stats(org_ids UUID[])
RETURNS TABLE (
  org_id UUID,
  total_events BIGINT,
  failures BIGINT,
  last_error TEXT,
  last_failure_at TIMESTAMPTZ,
  failure_rate NUMERIC
) AS $$
  SELECT 
    wl.organization_id as org_id,
    COUNT(*) as total_events,
    COUNT(*) FILTER (WHERE wl.success = false OR wl.error_message IS NOT NULL) as failures,
    (ARRAY_AGG(wl.error_message ORDER BY wl.created_at DESC) FILTER (WHERE wl.error_message IS NOT NULL))[1] as last_error,
    MAX(wl.created_at) FILTER (WHERE wl.success = false OR wl.error_message IS NOT NULL) as last_failure_at,
    ROUND(
      (COUNT(*) FILTER (WHERE wl.success = false OR wl.error_message IS NOT NULL)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 
      1
    ) as failure_rate
  FROM webhook_logs wl
  WHERE wl.organization_id = ANY(org_ids)
    AND wl.created_at > NOW() - INTERVAL '7 days'
  GROUP BY wl.organization_id
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Create RPC function to get data freshness per organization
CREATE OR REPLACE FUNCTION public.get_org_data_freshness(org_ids UUID[])
RETURNS TABLE (
  org_id UUID,
  last_transaction_at TIMESTAMPTZ,
  days_stale INTEGER,
  transaction_count_7d BIGINT
) AS $$
  SELECT 
    at.organization_id as org_id,
    MAX(at.created_at) as last_transaction_at,
    EXTRACT(DAY FROM NOW() - MAX(at.created_at))::INTEGER as days_stale,
    COUNT(*) as transaction_count_7d
  FROM actblue_transactions at
  WHERE at.organization_id = ANY(org_ids)
    AND at.created_at > NOW() - INTERVAL '7 days'
  GROUP BY at.organization_id
$$ LANGUAGE sql STABLE SECURITY DEFINER;