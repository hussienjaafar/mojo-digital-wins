-- Drop the old function first
DROP FUNCTION IF EXISTS public.get_donation_heatmap(uuid, date, date, text);

-- Recreate with count and recurring filter
CREATE FUNCTION public.get_donation_heatmap(
  _organization_id uuid,
  _start_date date,
  _end_date date,
  _timezone text DEFAULT 'UTC'
)
RETURNS TABLE (
  day_of_week integer,
  hour integer,
  value numeric,
  count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify user has access to this organization
  IF NOT (
    public.user_belongs_to_organization(_organization_id) OR
    public.has_role(auth.uid(), 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied to organization data';
  END IF;

  RETURN QUERY
  WITH first_recurring AS (
    -- For recurring donations, find the first transaction per donor email
    SELECT 
      t.donor_email,
      MIN(t.transaction_date) AS first_date
    FROM public.actblue_transactions t
    WHERE t.organization_id = _organization_id
      AND t.is_recurring = true
      AND t.transaction_type IS DISTINCT FROM 'refund'
    GROUP BY t.donor_email
  ),
  filtered_transactions AS (
    SELECT 
      t.created_at,
      t.transaction_date,
      t.net_amount,
      t.amount
    FROM public.actblue_transactions t
    LEFT JOIN first_recurring fr ON t.donor_email = fr.donor_email AND t.is_recurring = true
    WHERE t.organization_id = _organization_id
      AND t.transaction_date >= _start_date
      AND t.transaction_date <= _end_date
      AND t.transaction_type IS DISTINCT FROM 'refund'
      AND (
        -- Include non-recurring donations
        t.is_recurring IS NOT TRUE
        -- Or include only the first recurring donation per donor
        OR (t.is_recurring = true AND t.transaction_date = fr.first_date)
      )
  )
  SELECT 
    EXTRACT(DOW FROM (COALESCE(ft.created_at, ft.transaction_date::timestamp) AT TIME ZONE _timezone))::integer AS day_of_week,
    EXTRACT(HOUR FROM (COALESCE(ft.created_at, ft.transaction_date::timestamp) AT TIME ZONE _timezone))::integer AS hour,
    SUM(COALESCE(ft.net_amount, ft.amount, 0))::numeric AS value,
    COUNT(*)::bigint AS count
  FROM filtered_transactions ft
  GROUP BY 
    EXTRACT(DOW FROM (COALESCE(ft.created_at, ft.transaction_date::timestamp) AT TIME ZONE _timezone)),
    EXTRACT(HOUR FROM (COALESCE(ft.created_at, ft.transaction_date::timestamp) AT TIME ZONE _timezone));
END;
$$;