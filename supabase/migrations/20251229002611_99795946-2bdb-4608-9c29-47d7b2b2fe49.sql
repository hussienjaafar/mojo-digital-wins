-- Create get_donation_heatmap RPC function for server-side aggregation with timezone support
CREATE OR REPLACE FUNCTION public.get_donation_heatmap(
  _organization_id uuid,
  _start_date date,
  _end_date date,
  _timezone text DEFAULT 'UTC'
)
RETURNS TABLE (
  day_of_week integer,
  hour integer,
  value numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
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
  SELECT 
    EXTRACT(DOW FROM (t.created_at AT TIME ZONE _timezone))::integer AS day_of_week,
    EXTRACT(HOUR FROM (t.created_at AT TIME ZONE _timezone))::integer AS hour,
    SUM(COALESCE(t.net_amount, t.amount, 0))::numeric AS value
  FROM public.actblue_transactions t
  WHERE t.organization_id = _organization_id
    AND t.transaction_date >= _start_date
    AND t.transaction_date <= _end_date
    AND t.transaction_type IS DISTINCT FROM 'refund'
  GROUP BY 
    EXTRACT(DOW FROM (t.created_at AT TIME ZONE _timezone)),
    EXTRACT(HOUR FROM (t.created_at AT TIME ZONE _timezone));
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_donation_heatmap IS 'Returns donation aggregations by day of week and hour for heatmap visualization. Supports timezone conversion.';