-- Migration: Create get_actblue_filtered_rollup RPC
-- This RPC provides timezone-aware daily bucketed ActBlue metrics with optional filtering

-- Create the filtered rollup function
CREATE OR REPLACE FUNCTION get_actblue_filtered_rollup(
  p_org_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_campaign_id UUID DEFAULT NULL,
  p_creative_id UUID DEFAULT NULL,
  p_timezone TEXT DEFAULT 'America/New_York'
)
RETURNS TABLE (
  day DATE,
  gross_raised NUMERIC,
  net_raised NUMERIC,
  refund_amount NUMERIC,
  transaction_count BIGINT,
  refund_count BIGINT,
  unique_donors BIGINT,
  recurring_count BIGINT,
  recurring_amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH filtered_transactions AS (
    SELECT
      t.organization_id,
      t.amount,
      t.net_amount,
      t.fee,
      t.transaction_type,
      t.is_recurring,
      t.donor_id_hash,
      t.refcode,
      t.source_campaign,
      -- Convert UTC timestamp to org timezone for day bucketing
      (t.transaction_date AT TIME ZONE 'UTC' AT TIME ZONE p_timezone)::DATE AS local_day
    FROM actblue_transactions_secure t
    WHERE t.organization_id = p_org_id
      AND t.transaction_date >= (p_start_date::TIMESTAMP AT TIME ZONE p_timezone AT TIME ZONE 'UTC')
      AND t.transaction_date < ((p_end_date + INTERVAL '1 day')::TIMESTAMP AT TIME ZONE p_timezone AT TIME ZONE 'UTC')
      -- Apply optional campaign filter via refcode/source_campaign
      AND (
        p_campaign_id IS NULL
        OR t.refcode IN (
          SELECT mc.refcode
          FROM meta_campaigns mc
          WHERE mc.id = p_campaign_id
        )
        OR t.source_campaign IN (
          SELECT mc.campaign_name
          FROM meta_campaigns mc
          WHERE mc.id = p_campaign_id
        )
      )
      -- Apply optional creative filter
      AND (
        p_creative_id IS NULL
        OR t.refcode IN (
          SELECT mci.refcode
          FROM meta_creative_insights mci
          WHERE mci.id = p_creative_id
        )
      )
  )
  SELECT
    ft.local_day AS day,
    COALESCE(SUM(
      CASE WHEN ft.transaction_type IS DISTINCT FROM 'refund'
      THEN ft.amount ELSE 0 END
    ), 0)::NUMERIC AS gross_raised,
    COALESCE(SUM(
      CASE WHEN ft.transaction_type IS DISTINCT FROM 'refund'
      THEN COALESCE(ft.net_amount, ft.amount - COALESCE(ft.fee, 0)) ELSE 0 END
    ), 0)::NUMERIC AS net_raised,
    COALESCE(SUM(
      CASE WHEN ft.transaction_type = 'refund'
      THEN ABS(COALESCE(ft.net_amount, ft.amount)) ELSE 0 END
    ), 0)::NUMERIC AS refund_amount,
    COUNT(*) FILTER (WHERE ft.transaction_type IS DISTINCT FROM 'refund') AS transaction_count,
    COUNT(*) FILTER (WHERE ft.transaction_type = 'refund') AS refund_count,
    COUNT(DISTINCT ft.donor_id_hash) AS unique_donors,
    COUNT(*) FILTER (WHERE ft.is_recurring = TRUE AND ft.transaction_type IS DISTINCT FROM 'refund') AS recurring_count,
    COALESCE(SUM(
      CASE WHEN ft.is_recurring = TRUE AND ft.transaction_type IS DISTINCT FROM 'refund'
      THEN ft.amount ELSE 0 END
    ), 0)::NUMERIC AS recurring_amount
  FROM filtered_transactions ft
  GROUP BY ft.local_day
  ORDER BY ft.local_day;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_actblue_filtered_rollup(UUID, DATE, DATE, UUID, UUID, TEXT) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION get_actblue_filtered_rollup IS
'Returns daily bucketed ActBlue metrics with timezone-aware date handling and optional campaign/creative filtering.
Parameters:
  - p_org_id: Organization UUID (required)
  - p_start_date: Start date inclusive (required)
  - p_end_date: End date inclusive (required)
  - p_campaign_id: Optional campaign UUID to filter by
  - p_creative_id: Optional creative UUID to filter by
  - p_timezone: Timezone for day bucketing (default: America/New_York)
Returns daily aggregated metrics including gross/net raised, refunds, donor counts, and recurring metrics.';
