-- Drop existing functions first due to parameter name change
DROP FUNCTION IF EXISTS public.get_actblue_daily_rollup(uuid, date, date, boolean);
DROP FUNCTION IF EXISTS public.get_actblue_period_summary(uuid, date, date, boolean);
DROP FUNCTION IF EXISTS public.get_actblue_filtered_rollup(uuid, date, date, text, text, text, boolean);

-- Recreate get_actblue_daily_rollup with FIXED timezone conversion
CREATE OR REPLACE FUNCTION public.get_actblue_daily_rollup(
  p_organization_id uuid,
  p_start_date date,
  p_end_date date,
  p_use_utc boolean DEFAULT false
)
RETURNS TABLE (
  day date,
  gross_raised numeric,
  net_raised numeric,
  refund_amount numeric,
  transaction_count bigint,
  refund_count bigint,
  unique_donors bigint,
  recurring_count bigint,
  recurring_amount numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_timezone text;
BEGIN
  -- Get organization timezone, default to America/New_York (ActBlue default)
  SELECT COALESCE(timezone, 'America/New_York') INTO v_timezone
  FROM client_organizations
  WHERE id = p_organization_id;

  IF p_use_utc THEN
    v_timezone := 'UTC';
  END IF;

  RETURN QUERY
  WITH daily_data AS (
    SELECT
      -- FIXED: Single timezone conversion for timestamptz columns
      DATE(t.transaction_date AT TIME ZONE v_timezone) as tx_day,
      t.amount,
      t.net_amount,
      t.transaction_type,
      t.donor_email,
      t.is_recurring
    FROM actblue_transactions t
    WHERE t.organization_id = p_organization_id
      -- FIXED: Single timezone conversion for date filtering
      AND DATE(t.transaction_date AT TIME ZONE v_timezone) >= p_start_date
      AND DATE(t.transaction_date AT TIME ZONE v_timezone) <= p_end_date
  )
  SELECT
    d.tx_day as day,
    COALESCE(SUM(CASE WHEN d.transaction_type != 'Refund' THEN d.amount ELSE 0 END), 0) as gross_raised,
    COALESCE(SUM(CASE WHEN d.transaction_type != 'Refund' THEN COALESCE(d.net_amount, d.amount) ELSE 0 END), 0) as net_raised,
    COALESCE(SUM(CASE WHEN d.transaction_type = 'Refund' THEN ABS(COALESCE(d.net_amount, d.amount)) ELSE 0 END), 0) as refund_amount,
    COUNT(CASE WHEN d.transaction_type != 'Refund' THEN 1 END) as transaction_count,
    COUNT(CASE WHEN d.transaction_type = 'Refund' THEN 1 END) as refund_count,
    COUNT(DISTINCT CASE WHEN d.transaction_type != 'Refund' THEN d.donor_email END) as unique_donors,
    COUNT(CASE WHEN d.is_recurring = true AND d.transaction_type != 'Refund' THEN 1 END) as recurring_count,
    COALESCE(SUM(CASE WHEN d.is_recurring = true AND d.transaction_type != 'Refund' THEN COALESCE(d.net_amount, d.amount) ELSE 0 END), 0) as recurring_amount
  FROM daily_data d
  GROUP BY d.tx_day
  ORDER BY d.tx_day;
END;
$$;

-- Recreate get_actblue_period_summary with FIXED timezone conversion
CREATE OR REPLACE FUNCTION public.get_actblue_period_summary(
  p_organization_id uuid,
  p_start_date date,
  p_end_date date,
  p_use_utc boolean DEFAULT false
)
RETURNS TABLE (
  gross_raised numeric,
  net_raised numeric,
  refund_amount numeric,
  transaction_count bigint,
  refund_count bigint,
  unique_donors bigint,
  recurring_count bigint,
  recurring_amount numeric,
  avg_donation numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_timezone text;
BEGIN
  -- Get organization timezone, default to America/New_York (ActBlue default)
  SELECT COALESCE(timezone, 'America/New_York') INTO v_timezone
  FROM client_organizations
  WHERE id = p_organization_id;

  IF p_use_utc THEN
    v_timezone := 'UTC';
  END IF;

  RETURN QUERY
  WITH filtered_data AS (
    SELECT
      t.amount,
      t.net_amount,
      t.transaction_type,
      t.donor_email,
      t.is_recurring
    FROM actblue_transactions t
    WHERE t.organization_id = p_organization_id
      -- FIXED: Single timezone conversion for timestamptz columns
      AND DATE(t.transaction_date AT TIME ZONE v_timezone) >= p_start_date
      AND DATE(t.transaction_date AT TIME ZONE v_timezone) <= p_end_date
  )
  SELECT
    COALESCE(SUM(CASE WHEN d.transaction_type != 'Refund' THEN d.amount ELSE 0 END), 0) as gross_raised,
    COALESCE(SUM(CASE WHEN d.transaction_type != 'Refund' THEN COALESCE(d.net_amount, d.amount) ELSE 0 END), 0) as net_raised,
    COALESCE(SUM(CASE WHEN d.transaction_type = 'Refund' THEN ABS(COALESCE(d.net_amount, d.amount)) ELSE 0 END), 0) as refund_amount,
    COUNT(CASE WHEN d.transaction_type != 'Refund' THEN 1 END) as transaction_count,
    COUNT(CASE WHEN d.transaction_type = 'Refund' THEN 1 END) as refund_count,
    COUNT(DISTINCT CASE WHEN d.transaction_type != 'Refund' THEN d.donor_email END) as unique_donors,
    COUNT(CASE WHEN d.is_recurring = true AND d.transaction_type != 'Refund' THEN 1 END) as recurring_count,
    COALESCE(SUM(CASE WHEN d.is_recurring = true AND d.transaction_type != 'Refund' THEN COALESCE(d.net_amount, d.amount) ELSE 0 END), 0) as recurring_amount,
    CASE 
      WHEN COUNT(CASE WHEN d.transaction_type != 'Refund' THEN 1 END) > 0 
      THEN COALESCE(SUM(CASE WHEN d.transaction_type != 'Refund' THEN COALESCE(d.net_amount, d.amount) ELSE 0 END), 0) / COUNT(CASE WHEN d.transaction_type != 'Refund' THEN 1 END)
      ELSE 0 
    END as avg_donation
  FROM filtered_data d;
END;
$$;

-- Recreate get_actblue_filtered_rollup with FIXED timezone conversion
CREATE OR REPLACE FUNCTION public.get_actblue_filtered_rollup(
  p_org_id uuid,
  p_start_date date,
  p_end_date date,
  p_campaign_id text DEFAULT NULL,
  p_creative_id text DEFAULT NULL,
  p_timezone text DEFAULT 'America/New_York',
  p_use_utc boolean DEFAULT false
)
RETURNS TABLE (
  day date,
  gross_raised numeric,
  net_raised numeric,
  refund_amount numeric,
  transaction_count bigint,
  refund_count bigint,
  unique_donors bigint,
  recurring_count bigint,
  recurring_amount numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_timezone text;
BEGIN
  -- Determine timezone to use
  IF p_use_utc THEN
    v_timezone := 'UTC';
  ELSE
    v_timezone := COALESCE(p_timezone, 'America/New_York');
  END IF;

  RETURN QUERY
  WITH daily_data AS (
    SELECT
      -- FIXED: Single timezone conversion for timestamptz columns
      DATE(t.transaction_date AT TIME ZONE v_timezone) as tx_day,
      t.amount,
      t.net_amount,
      t.transaction_type,
      t.donor_email,
      t.is_recurring
    FROM actblue_transactions t
    LEFT JOIN attributed_donations ad ON ad.transaction_id = t.transaction_id
    WHERE t.organization_id = p_org_id
      -- FIXED: Single timezone conversion for date filtering
      AND DATE(t.transaction_date AT TIME ZONE v_timezone) >= p_start_date
      AND DATE(t.transaction_date AT TIME ZONE v_timezone) <= p_end_date
      AND (p_campaign_id IS NULL OR ad.campaign_id = p_campaign_id)
      AND (p_creative_id IS NULL OR ad.creative_id = p_creative_id)
  )
  SELECT
    d.tx_day as day,
    COALESCE(SUM(CASE WHEN d.transaction_type != 'Refund' THEN d.amount ELSE 0 END), 0) as gross_raised,
    COALESCE(SUM(CASE WHEN d.transaction_type != 'Refund' THEN COALESCE(d.net_amount, d.amount) ELSE 0 END), 0) as net_raised,
    COALESCE(SUM(CASE WHEN d.transaction_type = 'Refund' THEN ABS(COALESCE(d.net_amount, d.amount)) ELSE 0 END), 0) as refund_amount,
    COUNT(CASE WHEN d.transaction_type != 'Refund' THEN 1 END) as transaction_count,
    COUNT(CASE WHEN d.transaction_type = 'Refund' THEN 1 END) as refund_count,
    COUNT(DISTINCT CASE WHEN d.transaction_type != 'Refund' THEN d.donor_email END) as unique_donors,
    COUNT(CASE WHEN d.is_recurring = true AND d.transaction_type != 'Refund' THEN 1 END) as recurring_count,
    COALESCE(SUM(CASE WHEN d.is_recurring = true AND d.transaction_type != 'Refund' THEN COALESCE(d.net_amount, d.amount) ELSE 0 END), 0) as recurring_amount
  FROM daily_data d
  GROUP BY d.tx_day
  ORDER BY d.tx_day;
END;
$$;