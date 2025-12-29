-- Add server-side aggregation RPC for donation heatmap
-- Reduces client-side processing by aggregating donations into 7x24 bins on the server

CREATE OR REPLACE FUNCTION public.get_donation_heatmap(
  _organization_id UUID,
  _start_date DATE,
  _end_date DATE,
  _timezone TEXT DEFAULT 'UTC'
)
RETURNS TABLE(
  day_of_week INT,
  hour INT,
  value NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verify user has access to organization using existing RLS helper
  IF NOT (
    public.user_belongs_to_organization(_organization_id) OR
    public.has_role(auth.uid(), 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied to organization data';
  END IF;

  RETURN QUERY
  SELECT
    EXTRACT(DOW FROM (COALESCE(t.created_at, t.transaction_date::timestamp) AT TIME ZONE _timezone))::INT AS day_of_week,
    EXTRACT(HOUR FROM (COALESCE(t.created_at, t.transaction_date::timestamp) AT TIME ZONE _timezone))::INT AS hour,
    SUM(COALESCE(t.net_amount, t.amount, 0))::NUMERIC AS value
  FROM public.actblue_transactions t
  WHERE t.organization_id = _organization_id
    AND t.transaction_date >= _start_date
    AND t.transaction_date <= _end_date
    AND t.transaction_type IS DISTINCT FROM 'refund'
  GROUP BY
    EXTRACT(DOW FROM (COALESCE(t.created_at, t.transaction_date::timestamp) AT TIME ZONE _timezone)),
    EXTRACT(HOUR FROM (COALESCE(t.created_at, t.transaction_date::timestamp) AT TIME ZONE _timezone));
END;
$$;

COMMENT ON FUNCTION public.get_donation_heatmap IS 'Server-side aggregation for donation heatmap. Returns net revenue by day of week and hour, excluding refunds.';
