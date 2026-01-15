-- Create function to get hourly metrics for a single day (for "Today" view)
CREATE OR REPLACE FUNCTION public.get_actblue_hourly_metrics(
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
      EXTRACT(HOUR FROM (transaction_date AT TIME ZONE _timezone))::INTEGER AS hr,
      COUNT(*)::BIGINT AS cnt,
      COALESCE(SUM(amount), 0) AS gross,
      COALESCE(SUM(net_amount), 0) AS net,
      COUNT(DISTINCT donor_email)::BIGINT AS donors,
      COUNT(*) FILTER (WHERE is_recurring = true)::BIGINT AS recurring
    FROM actblue_transactions
    WHERE organization_id = _organization_id
      AND (transaction_date AT TIME ZONE _timezone)::DATE = _date
    GROUP BY EXTRACT(HOUR FROM (transaction_date AT TIME ZONE _timezone))
  )
  SELECT
    h.hour AS hour,
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

-- Create function to get comparison metrics for today vs yesterday and same day last week
CREATE OR REPLACE FUNCTION public.get_today_comparison_metrics(
  _organization_id UUID,
  _date DATE,
  _timezone TEXT DEFAULT 'America/New_York'
)
RETURNS TABLE (
  period TEXT,
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
DECLARE
  _yesterday DATE := _date - INTERVAL '1 day';
  _last_week DATE := _date - INTERVAL '7 days';
BEGIN
  RETURN QUERY
  WITH metrics AS (
    SELECT 
      CASE 
        WHEN (transaction_date AT TIME ZONE _timezone)::DATE = _date THEN 'today'
        WHEN (transaction_date AT TIME ZONE _timezone)::DATE = _yesterday THEN 'yesterday'
        WHEN (transaction_date AT TIME ZONE _timezone)::DATE = _last_week THEN 'last_week'
      END AS prd,
      COUNT(*)::BIGINT AS cnt,
      COALESCE(SUM(amount), 0) AS gross,
      COALESCE(SUM(net_amount), 0) AS net,
      COUNT(DISTINCT donor_email)::BIGINT AS donors,
      COUNT(*) FILTER (WHERE is_recurring = true)::BIGINT AS recurring
    FROM actblue_transactions
    WHERE organization_id = _organization_id
      AND (transaction_date AT TIME ZONE _timezone)::DATE IN (_date, _yesterday, _last_week)
    GROUP BY CASE 
        WHEN (transaction_date AT TIME ZONE _timezone)::DATE = _date THEN 'today'
        WHEN (transaction_date AT TIME ZONE _timezone)::DATE = _yesterday THEN 'yesterday'
        WHEN (transaction_date AT TIME ZONE _timezone)::DATE = _last_week THEN 'last_week'
      END
  )
  SELECT 
    p.period::TEXT,
    COALESCE(m.cnt, 0)::BIGINT AS donation_count,
    COALESCE(m.gross, 0)::NUMERIC AS gross_amount,
    COALESCE(m.net, 0)::NUMERIC AS net_amount,
    COALESCE(m.donors, 0)::BIGINT AS unique_donors,
    CASE WHEN COALESCE(m.cnt, 0) > 0 
      THEN ROUND(m.gross / m.cnt, 2) 
      ELSE 0 
    END AS avg_donation,
    COALESCE(m.recurring, 0)::BIGINT AS recurring_count
  FROM (VALUES ('today'), ('yesterday'), ('last_week')) AS p(period)
  LEFT JOIN metrics m ON m.prd = p.period;
END;
$$;

-- Create function to get recent donations for activity feed
CREATE OR REPLACE FUNCTION public.get_recent_donations(
  _organization_id UUID,
  _date DATE,
  _limit INTEGER DEFAULT 20,
  _timezone TEXT DEFAULT 'America/New_York'
)
RETURNS TABLE (
  id UUID,
  amount NUMERIC,
  donor_name TEXT,
  transaction_date TIMESTAMPTZ,
  is_recurring BOOLEAN,
  source_campaign TEXT,
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
    t.donor_name,
    t.transaction_date,
    t.is_recurring,
    t.source_campaign,
    t.refcode
  FROM actblue_transactions t
  WHERE t.organization_id = _organization_id
    AND (t.transaction_date AT TIME ZONE _timezone)::DATE = _date
  ORDER BY t.transaction_date DESC
  LIMIT _limit;
END;
$$;