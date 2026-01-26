-- Drop and recreate get_recent_donations RPC to include channel detection
DROP FUNCTION IF EXISTS public.get_recent_donations(UUID, DATE, INTEGER, TEXT);

CREATE FUNCTION public.get_recent_donations(
  _organization_id UUID,
  _date DATE,
  _limit INTEGER DEFAULT 20,
  _timezone TEXT DEFAULT 'America/New_York'
)
RETURNS TABLE (
  id UUID,
  amount NUMERIC,
  net_amount NUMERIC,
  donor_first_name TEXT,
  transaction_date TIMESTAMPTZ,
  is_recurring BOOLEAN,
  refcode TEXT,
  channel TEXT
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
    t.first_name AS donor_first_name,
    t.transaction_date,
    COALESCE(t.is_recurring, false) AS is_recurring,
    t.refcode,
    public.detect_donation_channel(
      t.contribution_form,
      t.refcode,
      t.source_campaign,
      t.click_id,
      t.fbclid,
      NULL::TEXT,
      NULL::TEXT,
      NULL::TEXT
    ) AS channel
  FROM actblue_transactions t
  WHERE t.organization_id = _organization_id
    AND (t.transaction_date AT TIME ZONE _timezone)::DATE = _date
    AND t.transaction_type = 'donation'
  ORDER BY t.transaction_date DESC
  LIMIT _limit;
END;
$$;