-- Drop existing functions first to allow return type changes
DROP FUNCTION IF EXISTS public.get_actblue_hourly_metrics(UUID, DATE, TEXT);
DROP FUNCTION IF EXISTS public.get_today_comparison_metrics(UUID, DATE, TEXT);
DROP FUNCTION IF EXISTS public.get_recent_donations(UUID, DATE, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.get_actblue_true_unique_donors(UUID, DATE, DATE, TEXT);

-- Fix get_actblue_hourly_metrics ambiguous column error by using explicit table aliases
CREATE FUNCTION public.get_actblue_hourly_metrics(
  _organization_id UUID,
  _date DATE,
  _timezone TEXT DEFAULT 'America/New_York'
)
RETURNS TABLE (
  hour INTEGER,
  hour_label TEXT,
  donation_count BIGINT,
  gross_amount NUMERIC,
  net_amount NUMERIC,
  unique_donors BIGINT,
  avg_donation NUMERIC,
  recurring_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH hourly_data AS (
    SELECT 
      EXTRACT(HOUR FROM (t.transaction_date AT TIME ZONE _timezone))::INTEGER AS hr,
      COUNT(*)::BIGINT AS cnt,
      COALESCE(SUM(t.amount), 0) AS gross,
      COALESCE(SUM(t.net_amount), 0) AS net,
      COUNT(DISTINCT t.donor_email)::BIGINT AS donors,
      COUNT(*) FILTER (WHERE t.is_recurring = true)::BIGINT AS recurring
    FROM actblue_transactions t
    WHERE t.organization_id = _organization_id
      AND (t.transaction_date AT TIME ZONE _timezone)::DATE = _date
      AND t.transaction_type = 'donation'
    GROUP BY EXTRACT(HOUR FROM (t.transaction_date AT TIME ZONE _timezone))
  )
  SELECT
    h.hour::INTEGER AS hour,
    TO_CHAR(h.hour, 'FM00') || ':00' AS hour_label,
    COALESCE(hd.cnt, 0)::BIGINT AS donation_count,
    COALESCE(hd.gross, 0)::NUMERIC AS gross_amount,
    COALESCE(hd.net, 0)::NUMERIC AS net_amount,
    COALESCE(hd.donors, 0)::BIGINT AS unique_donors,
    CASE WHEN COALESCE(hd.cnt, 0) > 0 
      THEN ROUND(hd.gross / hd.cnt, 2) 
      ELSE 0 
    END AS avg_donation,
    COALESCE(hd.recurring, 0)::BIGINT AS recurring_count
  FROM generate_series(0, 23) AS h(hour)
  LEFT JOIN hourly_data hd ON hd.hr = h.hour
  ORDER BY h.hour;
END;
$$;

-- Recreate get_today_comparison_metrics with explicit table aliases
CREATE FUNCTION public.get_today_comparison_metrics(
  _organization_id UUID,
  _date DATE,
  _timezone TEXT DEFAULT 'America/New_York'
)
RETURNS TABLE (
  period_name TEXT,
  gross_amount NUMERIC,
  net_amount NUMERIC,
  donation_count BIGINT,
  unique_donors BIGINT,
  recurring_count BIGINT,
  avg_donation NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _yesterday DATE := _date - INTERVAL '1 day';
  _last_week DATE := _date - INTERVAL '7 days';
BEGIN
  RETURN QUERY
  SELECT 
    'today'::TEXT AS period_name,
    COALESCE(SUM(t.amount), 0)::NUMERIC AS gross_amount,
    COALESCE(SUM(t.net_amount), 0)::NUMERIC AS net_amount,
    COUNT(*)::BIGINT AS donation_count,
    COUNT(DISTINCT t.donor_email)::BIGINT AS unique_donors,
    COUNT(*) FILTER (WHERE t.is_recurring = true)::BIGINT AS recurring_count,
    CASE WHEN COUNT(*) > 0 THEN ROUND(SUM(t.amount) / COUNT(*), 2) ELSE 0 END AS avg_donation
  FROM actblue_transactions t
  WHERE t.organization_id = _organization_id
    AND (t.transaction_date AT TIME ZONE _timezone)::DATE = _date
    AND t.transaction_type = 'donation'
  
  UNION ALL
  
  SELECT 
    'yesterday'::TEXT AS period_name,
    COALESCE(SUM(t.amount), 0)::NUMERIC AS gross_amount,
    COALESCE(SUM(t.net_amount), 0)::NUMERIC AS net_amount,
    COUNT(*)::BIGINT AS donation_count,
    COUNT(DISTINCT t.donor_email)::BIGINT AS unique_donors,
    COUNT(*) FILTER (WHERE t.is_recurring = true)::BIGINT AS recurring_count,
    CASE WHEN COUNT(*) > 0 THEN ROUND(SUM(t.amount) / COUNT(*), 2) ELSE 0 END AS avg_donation
  FROM actblue_transactions t
  WHERE t.organization_id = _organization_id
    AND (t.transaction_date AT TIME ZONE _timezone)::DATE = _yesterday
    AND t.transaction_type = 'donation'
  
  UNION ALL
  
  SELECT 
    'last_week'::TEXT AS period_name,
    COALESCE(SUM(t.amount), 0)::NUMERIC AS gross_amount,
    COALESCE(SUM(t.net_amount), 0)::NUMERIC AS net_amount,
    COUNT(*)::BIGINT AS donation_count,
    COUNT(DISTINCT t.donor_email)::BIGINT AS unique_donors,
    COUNT(*) FILTER (WHERE t.is_recurring = true)::BIGINT AS recurring_count,
    CASE WHEN COUNT(*) > 0 THEN ROUND(SUM(t.amount) / COUNT(*), 2) ELSE 0 END AS avg_donation
  FROM actblue_transactions t
  WHERE t.organization_id = _organization_id
    AND (t.transaction_date AT TIME ZONE _timezone)::DATE = _last_week
    AND t.transaction_type = 'donation';
END;
$$;

-- Recreate get_recent_donations with explicit table aliases
CREATE FUNCTION public.get_recent_donations(
  _organization_id UUID,
  _date DATE,
  _timezone TEXT DEFAULT 'America/New_York',
  _limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  amount NUMERIC,
  net_amount NUMERIC,
  donor_first_name TEXT,
  is_recurring BOOLEAN,
  transaction_date TIMESTAMPTZ,
  refcode TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.amount,
    t.net_amount,
    COALESCE(t.first_name, 'Anonymous')::TEXT AS donor_first_name,
    COALESCE(t.is_recurring, false) AS is_recurring,
    t.transaction_date,
    t.refcode
  FROM actblue_transactions t
  WHERE t.organization_id = _organization_id
    AND (t.transaction_date AT TIME ZONE _timezone)::DATE = _date
    AND t.transaction_type = 'donation'
  ORDER BY t.transaction_date DESC
  LIMIT _limit;
END;
$$;

-- Create true unique donors RPC that correctly counts distinct donors across date range
CREATE FUNCTION public.get_actblue_true_unique_donors(
  p_organization_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_timezone TEXT DEFAULT 'America/New_York'
)
RETURNS TABLE (
  unique_donors BIGINT,
  new_donors BIGINT,
  returning_donors BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH period_donors AS (
    SELECT DISTINCT t.donor_email
    FROM actblue_transactions t
    WHERE t.organization_id = p_organization_id
      AND (t.transaction_date AT TIME ZONE p_timezone)::DATE >= p_start_date
      AND (t.transaction_date AT TIME ZONE p_timezone)::DATE <= p_end_date
      AND t.transaction_type = 'donation'
      AND t.donor_email IS NOT NULL
  ),
  historical_donors AS (
    SELECT DISTINCT t.donor_email
    FROM actblue_transactions t
    WHERE t.organization_id = p_organization_id
      AND (t.transaction_date AT TIME ZONE p_timezone)::DATE < p_start_date
      AND t.transaction_type = 'donation'
      AND t.donor_email IS NOT NULL
  ),
  donor_status AS (
    SELECT 
      pd.donor_email,
      CASE WHEN hd.donor_email IS NOT NULL THEN 'returning' ELSE 'new' END AS donor_type
    FROM period_donors pd
    LEFT JOIN historical_donors hd ON pd.donor_email = hd.donor_email
  )
  SELECT
    COUNT(*)::BIGINT AS unique_donors,
    COUNT(*) FILTER (WHERE ds.donor_type = 'new')::BIGINT AS new_donors,
    COUNT(*) FILTER (WHERE ds.donor_type = 'returning')::BIGINT AS returning_donors
  FROM donor_status ds;
END;
$$;