-- Fix get_donation_heatmap RPC to use transaction_date (when donation occurred)
-- instead of created_at (when data was uploaded)
-- This fixes incorrect time analysis for bulk-imported historical data

CREATE OR REPLACE FUNCTION public.get_donation_heatmap(
  _organization_id uuid,
  _start_date date,
  _end_date date,
  _timezone text DEFAULT 'America/New_York'
)
RETURNS TABLE (
  day_of_week integer,
  hour integer,
  value numeric,
  count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tz text;
BEGIN
  -- Validate timezone, default to America/New_York if invalid
  BEGIN
    PERFORM now() AT TIME ZONE _timezone;
    _tz := _timezone;
  EXCEPTION
    WHEN OTHERS THEN
      _tz := 'America/New_York';
  END;

  RETURN QUERY
  WITH first_recurring AS (
    -- Find the first donation for each recurring donor to exclude subsequent recurring charges
    SELECT DISTINCT ON (t.donor_email, t.organization_id)
      t.donor_email,
      t.organization_id,
      t.transaction_date::date as first_date
    FROM public.actblue_transactions t
    WHERE t.organization_id = _organization_id
      AND t.is_recurring = true
      AND t.transaction_type IS DISTINCT FROM 'refund'
    ORDER BY t.donor_email, t.organization_id, t.transaction_date ASC
  ),
  filtered_transactions AS (
    SELECT 
      t.transaction_date,  -- Use actual transaction time, NOT created_at (upload time)
      t.net_amount,
      t.amount
    FROM public.actblue_transactions t
    LEFT JOIN first_recurring fr 
      ON t.donor_email = fr.donor_email 
      AND t.organization_id = fr.organization_id
    WHERE t.organization_id = _organization_id
      AND t.transaction_date >= _start_date
      AND t.transaction_date < _end_date
      AND t.transaction_type IS DISTINCT FROM 'refund'
      -- Exclude subsequent recurring donations (keep only first)
      AND (
        t.is_recurring = false 
        OR t.is_recurring IS NULL
        OR (t.is_recurring = true AND t.transaction_date::date = fr.first_date)
      )
  )
  SELECT 
    -- FIXED: Use transaction_date directly instead of COALESCE(created_at, transaction_date)
    -- transaction_date is when the donation actually occurred
    -- created_at is when the record was uploaded to the database (wrong for bulk imports)
    EXTRACT(DOW FROM (ft.transaction_date AT TIME ZONE _tz))::integer AS day_of_week,
    EXTRACT(HOUR FROM (ft.transaction_date AT TIME ZONE _tz))::integer AS hour,
    SUM(COALESCE(ft.net_amount, ft.amount, 0))::numeric AS value,
    COUNT(*)::bigint AS count
  FROM filtered_transactions ft
  GROUP BY 
    EXTRACT(DOW FROM (ft.transaction_date AT TIME ZONE _tz)),
    EXTRACT(HOUR FROM (ft.transaction_date AT TIME ZONE _tz));
END;
$$;

-- Add comment explaining the fix
COMMENT ON FUNCTION public.get_donation_heatmap IS 'Returns donation heatmap data grouped by day-of-week and hour using the actual transaction_date (when donation occurred), not created_at (when data was uploaded). Fixed Jan 2026 to correct bulk import time analysis.';