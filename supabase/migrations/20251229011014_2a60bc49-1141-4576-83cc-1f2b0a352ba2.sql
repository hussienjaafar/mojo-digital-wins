CREATE OR REPLACE FUNCTION public.get_donation_heatmap(_organization_id uuid, _start_date date, _end_date date, _timezone text DEFAULT 'UTC'::text)
 RETURNS TABLE(day_of_week integer, hour integer, value numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    EXTRACT(DOW FROM (COALESCE(t.created_at, t.transaction_date::timestamp) AT TIME ZONE _timezone))::integer AS day_of_week,
    EXTRACT(HOUR FROM (COALESCE(t.created_at, t.transaction_date::timestamp) AT TIME ZONE _timezone))::integer AS hour,
    SUM(COALESCE(t.net_amount, t.amount, 0))::numeric AS value
  FROM public.actblue_transactions t
  WHERE t.organization_id = _organization_id
    AND t.transaction_date >= _start_date
    AND t.transaction_date <= _end_date
    AND t.transaction_type IS DISTINCT FROM 'refund'
  GROUP BY 
    EXTRACT(DOW FROM (COALESCE(t.created_at, t.transaction_date::timestamp) AT TIME ZONE _timezone)),
    EXTRACT(HOUR FROM (COALESCE(t.created_at, t.transaction_date::timestamp) AT TIME ZONE _timezone));
END;
$function$;