
-- Fix get_actblue_filtered_rollup to not use donor_id_hash (doesn't exist in base table)
DROP FUNCTION IF EXISTS public.get_actblue_filtered_rollup(uuid, date, date, uuid, uuid, text);

CREATE FUNCTION public.get_actblue_filtered_rollup(
  p_org_id uuid, 
  p_start_date date, 
  p_end_date date, 
  p_campaign_id uuid DEFAULT NULL::uuid, 
  p_creative_id uuid DEFAULT NULL::uuid, 
  p_timezone text DEFAULT 'America/New_York'::text
)
RETURNS TABLE(
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
SET search_path TO 'public'
AS $function$
BEGIN
  -- Verify user has access to this organization
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    EXISTS (
      SELECT 1 FROM client_users cu
      WHERE cu.id = auth.uid()
        AND cu.organization_id = p_org_id
    )
  ) THEN
    RAISE EXCEPTION 'Access denied to organization data';
  END IF;

  RETURN QUERY
  WITH filtered_transactions AS (
    SELECT
      t.organization_id,
      t.amount,
      t.net_amount,
      t.fee,
      t.transaction_type,
      t.is_recurring,
      t.donor_email,
      t.first_name,
      t.last_name,
      t.refcode,
      t.source_campaign,
      (t.transaction_date AT TIME ZONE 'UTC' AT TIME ZONE p_timezone)::DATE AS local_day
    FROM actblue_transactions t
    WHERE t.organization_id = p_org_id
      AND t.transaction_date >= (p_start_date::TIMESTAMP AT TIME ZONE p_timezone AT TIME ZONE 'UTC')
      AND t.transaction_date < ((p_end_date + INTERVAL '1 day')::TIMESTAMP AT TIME ZONE p_timezone AT TIME ZONE 'UTC')
      AND (
        p_campaign_id IS NULL
        OR t.refcode IN (
          SELECT mc.refcode
          FROM meta_campaigns mc
          WHERE mc.id = p_campaign_id
        )
        OR t.source_campaign IN (
          SELECT mc.campaign_name
          FROM meta_campaigns mc
          WHERE mc.id = p_campaign_id
        )
      )
      AND (
        p_creative_id IS NULL
        OR t.refcode IN (
          SELECT mci.refcode
          FROM meta_creative_insights mci
          WHERE mci.id = p_creative_id
        )
      )
  )
  SELECT
    ft.local_day AS day,
    COALESCE(SUM(
      CASE WHEN ft.transaction_type IS DISTINCT FROM 'refund'
      THEN ft.amount ELSE 0 END
    ), 0)::NUMERIC AS gross_raised,
    COALESCE(SUM(
      CASE WHEN ft.transaction_type IS DISTINCT FROM 'refund'
      THEN COALESCE(ft.net_amount, ft.amount - COALESCE(ft.fee, 0)) ELSE 0 END
    ), 0)::NUMERIC AS net_raised,
    COALESCE(SUM(
      CASE WHEN ft.transaction_type = 'refund'
      THEN ABS(COALESCE(ft.net_amount, ft.amount)) ELSE 0 END
    ), 0)::NUMERIC AS refund_amount,
    COUNT(*) FILTER (WHERE ft.transaction_type IS DISTINCT FROM 'refund') AS transaction_count,
    COUNT(*) FILTER (WHERE ft.transaction_type = 'refund') AS refund_count,
    -- Use donor_email for unique donor counting instead of donor_id_hash
    COUNT(DISTINCT COALESCE(ft.donor_email, ft.first_name || ' ' || ft.last_name)) AS unique_donors,
    COUNT(*) FILTER (WHERE ft.is_recurring = TRUE AND ft.transaction_type IS DISTINCT FROM 'refund') AS recurring_count,
    COALESCE(SUM(
      CASE WHEN ft.is_recurring = TRUE AND ft.transaction_type IS DISTINCT FROM 'refund'
      THEN ft.amount ELSE 0 END
    ), 0)::NUMERIC AS recurring_amount
  FROM filtered_transactions ft
  GROUP BY ft.local_day
  ORDER BY ft.local_day;
END;
$function$;
