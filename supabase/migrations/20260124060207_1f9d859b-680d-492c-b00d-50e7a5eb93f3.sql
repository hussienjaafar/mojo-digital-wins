-- Fix parameter names to match original function signatures
-- The frontend uses p_organization_id, not p_org_id

DROP FUNCTION IF EXISTS public.get_actblue_daily_rollup(UUID, DATE, DATE, BOOLEAN);
DROP FUNCTION IF EXISTS public.get_actblue_period_summary(UUID, DATE, DATE, BOOLEAN);
DROP FUNCTION IF EXISTS public.get_actblue_filtered_rollup(UUID, DATE, DATE, TEXT, TEXT, TEXT, BOOLEAN);

-- Recreate get_actblue_daily_rollup with correct parameter names
CREATE OR REPLACE FUNCTION public.get_actblue_daily_rollup(
  p_organization_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_use_utc BOOLEAN DEFAULT FALSE
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
SET search_path = public
AS $$
DECLARE
  v_timezone TEXT := 'America/New_York';
BEGIN
  RETURN QUERY
  WITH daily_data AS (
    SELECT
      CASE 
        WHEN p_use_utc THEN DATE(t.transaction_date)
        ELSE DATE(t.transaction_date AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)
      END as tx_day,
      t.amount,
      t.net_amount,
      t.transaction_type,
      t.donor_email,
      t.is_recurring
    FROM actblue_transactions t
    WHERE t.organization_id = p_organization_id
      AND CASE 
        WHEN p_use_utc THEN DATE(t.transaction_date)
        ELSE DATE(t.transaction_date AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)
      END BETWEEN p_start_date AND p_end_date
  )
  SELECT
    d.tx_day as day,
    COALESCE(SUM(CASE WHEN d.transaction_type != 'Refund' THEN d.amount ELSE 0 END), 0) as gross_raised,
    COALESCE(SUM(CASE WHEN d.transaction_type != 'Refund' THEN d.net_amount ELSE 0 END), 0) as net_raised,
    COALESCE(SUM(CASE WHEN d.transaction_type = 'Refund' THEN ABS(d.amount) ELSE 0 END), 0) as refund_amount,
    COUNT(CASE WHEN d.transaction_type != 'Refund' THEN 1 END) as transaction_count,
    COUNT(CASE WHEN d.transaction_type = 'Refund' THEN 1 END) as refund_count,
    COUNT(DISTINCT CASE WHEN d.transaction_type != 'Refund' THEN d.donor_email END) as unique_donors,
    COUNT(CASE WHEN d.transaction_type != 'Refund' AND d.is_recurring = true THEN 1 END) as recurring_count,
    COALESCE(SUM(CASE WHEN d.transaction_type != 'Refund' AND d.is_recurring = true THEN d.amount ELSE 0 END), 0) as recurring_amount
  FROM daily_data d
  GROUP BY d.tx_day
  ORDER BY d.tx_day;
END;
$$;

-- Recreate get_actblue_period_summary with correct parameter names
CREATE OR REPLACE FUNCTION public.get_actblue_period_summary(
  p_organization_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_use_utc BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  gross_raised NUMERIC,
  net_raised NUMERIC,
  refund_amount NUMERIC,
  transaction_count BIGINT,
  refund_count BIGINT,
  unique_donors BIGINT,
  recurring_count BIGINT,
  recurring_amount NUMERIC,
  avg_donation NUMERIC,
  total_fees NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_timezone TEXT := 'America/New_York';
BEGIN
  RETURN QUERY
  WITH filtered_data AS (
    SELECT
      t.amount,
      t.net_amount,
      t.fee,
      t.transaction_type,
      t.donor_email,
      t.is_recurring
    FROM actblue_transactions t
    WHERE t.organization_id = p_organization_id
      AND CASE 
        WHEN p_use_utc THEN DATE(t.transaction_date)
        ELSE DATE(t.transaction_date AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)
      END BETWEEN p_start_date AND p_end_date
  )
  SELECT
    COALESCE(SUM(CASE WHEN f.transaction_type != 'Refund' THEN f.amount ELSE 0 END), 0) as gross_raised,
    COALESCE(SUM(CASE WHEN f.transaction_type != 'Refund' THEN f.net_amount ELSE 0 END), 0) as net_raised,
    COALESCE(SUM(CASE WHEN f.transaction_type = 'Refund' THEN ABS(f.amount) ELSE 0 END), 0) as refund_amount,
    COUNT(CASE WHEN f.transaction_type != 'Refund' THEN 1 END) as transaction_count,
    COUNT(CASE WHEN f.transaction_type = 'Refund' THEN 1 END) as refund_count,
    COUNT(DISTINCT CASE WHEN f.transaction_type != 'Refund' THEN f.donor_email END) as unique_donors,
    COUNT(CASE WHEN f.transaction_type != 'Refund' AND f.is_recurring = true THEN 1 END) as recurring_count,
    COALESCE(SUM(CASE WHEN f.transaction_type != 'Refund' AND f.is_recurring = true THEN f.amount ELSE 0 END), 0) as recurring_amount,
    CASE 
      WHEN COUNT(CASE WHEN f.transaction_type != 'Refund' THEN 1 END) > 0 
      THEN COALESCE(SUM(CASE WHEN f.transaction_type != 'Refund' THEN f.amount ELSE 0 END), 0) / COUNT(CASE WHEN f.transaction_type != 'Refund' THEN 1 END)
      ELSE 0 
    END as avg_donation,
    COALESCE(SUM(CASE WHEN f.transaction_type != 'Refund' THEN COALESCE(f.fee, 0) ELSE 0 END), 0) as total_fees
  FROM filtered_data f;
END;
$$;

-- Recreate get_actblue_filtered_rollup with correct parameter names
CREATE OR REPLACE FUNCTION public.get_actblue_filtered_rollup(
  p_organization_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_campaign_id TEXT DEFAULT NULL,
  p_creative_id TEXT DEFAULT NULL,
  p_timezone TEXT DEFAULT 'America/New_York',
  p_use_utc BOOLEAN DEFAULT FALSE
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
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH attributed AS (
    SELECT DISTINCT ad.transaction_id
    FROM attributed_donations ad
    WHERE ad.organization_id = p_organization_id
      AND (p_campaign_id IS NULL OR ad.campaign_id = p_campaign_id)
      AND (p_creative_id IS NULL OR ad.creative_id = p_creative_id)
  ),
  daily_data AS (
    SELECT
      CASE 
        WHEN p_use_utc THEN DATE(t.transaction_date)
        ELSE DATE(t.transaction_date AT TIME ZONE 'UTC' AT TIME ZONE p_timezone)
      END as tx_day,
      t.amount,
      t.net_amount,
      t.transaction_type,
      t.donor_email,
      t.is_recurring
    FROM actblue_transactions t
    WHERE t.organization_id = p_organization_id
      AND CASE 
        WHEN p_use_utc THEN DATE(t.transaction_date)
        ELSE DATE(t.transaction_date AT TIME ZONE 'UTC' AT TIME ZONE p_timezone)
      END BETWEEN p_start_date AND p_end_date
      AND (
        (p_campaign_id IS NULL AND p_creative_id IS NULL)
        OR t.transaction_id IN (SELECT transaction_id FROM attributed)
      )
  )
  SELECT
    d.tx_day as day,
    COALESCE(SUM(CASE WHEN d.transaction_type != 'Refund' THEN d.amount ELSE 0 END), 0) as gross_raised,
    COALESCE(SUM(CASE WHEN d.transaction_type != 'Refund' THEN d.net_amount ELSE 0 END), 0) as net_raised,
    COALESCE(SUM(CASE WHEN d.transaction_type = 'Refund' THEN ABS(d.amount) ELSE 0 END), 0) as refund_amount,
    COUNT(CASE WHEN d.transaction_type != 'Refund' THEN 1 END) as transaction_count,
    COUNT(CASE WHEN d.transaction_type = 'Refund' THEN 1 END) as refund_count,
    COUNT(DISTINCT CASE WHEN d.transaction_type != 'Refund' THEN d.donor_email END) as unique_donors,
    COUNT(CASE WHEN d.transaction_type != 'Refund' AND d.is_recurring = true THEN 1 END) as recurring_count,
    COALESCE(SUM(CASE WHEN d.transaction_type != 'Refund' AND d.is_recurring = true THEN d.amount ELSE 0 END), 0) as recurring_amount
  FROM daily_data d
  GROUP BY d.tx_day
  ORDER BY d.tx_day;
END;
$$;