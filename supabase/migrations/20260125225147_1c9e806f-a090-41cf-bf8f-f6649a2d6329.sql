-- Performance optimization: Add timezone-aware expression index for Eastern Time
-- This enables index usage when querying with AT TIME ZONE 'America/New_York'
-- which is the standard for ActBlue reporting

-- Create expression index for Eastern Time bucketing (most common case)
CREATE INDEX IF NOT EXISTS idx_actblue_transactions_org_date_tz_et
  ON public.actblue_transactions (
    organization_id,
    ((transaction_date AT TIME ZONE 'America/New_York')::date)
  );

-- Add a comment explaining the index purpose
COMMENT ON INDEX idx_actblue_transactions_org_date_tz_et IS 
  'Expression index for timezone-aware date bucketing in Eastern Time. Used by get_actblue_dashboard_metrics RPC.';