-- Fix ambiguous column reference in debug_timezone_totals
DROP FUNCTION IF EXISTS public.debug_timezone_totals(UUID, DATE);

CREATE FUNCTION public.debug_timezone_totals(
  p_org_id UUID,
  p_date DATE
)
RETURNS TABLE (
  method TEXT,
  donation_count BIGINT,
  gross_amount NUMERIC,
  org_timezone TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_timezone TEXT;
BEGIN
  SELECT COALESCE(co.org_timezone, 'America/New_York')
  INTO v_timezone
  FROM client_organizations co
  WHERE co.id = p_org_id;

  RETURN QUERY
  -- Method 1: Pure UTC date (transaction_date::date)
  SELECT
    'utc_date'::TEXT as method,
    COUNT(*) FILTER (WHERE t.transaction_type = 'donation') as donation_count,
    COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'donation'), 0) as gross_amount,
    v_timezone as org_timezone
  FROM actblue_transactions t
  WHERE t.organization_id = p_org_id
    AND t.transaction_date::DATE = p_date
  UNION ALL
  -- Method 2: Correct local timezone conversion for timestamptz
  SELECT
    'local_timezone'::TEXT as method,
    COUNT(*) FILTER (WHERE t.transaction_type = 'donation') as donation_count,
    COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'donation'), 0) as gross_amount,
    v_timezone as org_timezone
  FROM actblue_transactions t
  WHERE t.organization_id = p_org_id
    AND DATE(t.transaction_date AT TIME ZONE v_timezone) = p_date;
END;
$$;

GRANT EXECUTE ON FUNCTION public.debug_timezone_totals(UUID, DATE) TO authenticated, anon;