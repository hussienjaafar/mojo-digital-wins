-- =====================================================
-- Donor Demographics Aggregation RPC Functions
-- =====================================================

-- Function to get aggregated donor demographics summary
-- Returns totals, state-level stats, occupation stats, and channel stats
-- Designed to replace client-side select(*) aggregation for performance
CREATE OR REPLACE FUNCTION public.get_donor_demographics_summary(
  _organization_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Verify user has access to this organization
  IF NOT (
    public.user_belongs_to_organization(_organization_id) OR
    public.has_role(auth.uid(), 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied to organization data';
  END IF;

  WITH transaction_data AS (
    SELECT 
      donor_email,
      amount,
      state,
      occupation,
      refcode,
      is_express,
      transaction_type
    FROM actblue_transactions
    WHERE organization_id = _organization_id
      AND transaction_type IS DISTINCT FROM 'refund'
  ),
  totals AS (
    SELECT 
      COUNT(DISTINCT donor_email) FILTER (WHERE donor_email IS NOT NULL) as unique_donor_count,
      COUNT(*) as transaction_count,
      COALESCE(SUM(amount), 0) as total_revenue
    FROM transaction_data
  ),
  state_stats AS (
    SELECT 
      UPPER(TRIM(state)) as state_abbr,
      COUNT(DISTINCT donor_email) FILTER (WHERE donor_email IS NOT NULL) as unique_donors,
      COUNT(*) as transaction_count,
      COALESCE(SUM(amount), 0) as revenue
    FROM transaction_data
    WHERE state IS NOT NULL AND TRIM(state) != ''
    GROUP BY UPPER(TRIM(state))
    ORDER BY revenue DESC
  ),
  occupation_stats AS (
    SELECT 
      COALESCE(NULLIF(TRIM(occupation), ''), 'Not Provided') as occupation,
      COUNT(DISTINCT donor_email) FILTER (WHERE donor_email IS NOT NULL) as unique_donors,
      COUNT(*) as count,
      COALESCE(SUM(amount), 0) as revenue
    FROM transaction_data
    GROUP BY COALESCE(NULLIF(TRIM(occupation), ''), 'Not Provided')
    HAVING COALESCE(NULLIF(TRIM(occupation), ''), 'Not Provided') != 'Not Provided'
    ORDER BY revenue DESC
    LIMIT 15
  ),
  channel_stats AS (
    SELECT 
      CASE 
        WHEN refcode IS NOT NULL AND refcode != '' THEN 'Campaign'
        WHEN is_express = true THEN 'Express'
        ELSE 'Direct'
      END as channel,
      COUNT(*) as count,
      COALESCE(SUM(amount), 0) as revenue
    FROM transaction_data
    GROUP BY 
      CASE 
        WHEN refcode IS NOT NULL AND refcode != '' THEN 'Campaign'
        WHEN is_express = true THEN 'Express'
        ELSE 'Direct'
      END
    ORDER BY revenue DESC
  )
  SELECT jsonb_build_object(
    'totals', (SELECT row_to_json(t) FROM totals t),
    'state_stats', (SELECT COALESCE(jsonb_agg(row_to_json(s)), '[]'::jsonb) FROM state_stats s),
    'occupation_stats', (SELECT COALESCE(jsonb_agg(row_to_json(o)), '[]'::jsonb) FROM occupation_stats o),
    'channel_stats', (SELECT COALESCE(jsonb_agg(row_to_json(c)), '[]'::jsonb) FROM channel_stats c)
  ) INTO result;

  RETURN result;
END;
$$;

-- Function to get city-level breakdown for a specific state
-- Called on-demand when user clicks a state for drilldown
CREATE OR REPLACE FUNCTION public.get_state_city_breakdown(
  _organization_id uuid,
  _state_abbr text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  normalized_state text;
BEGIN
  -- Verify user has access to this organization
  IF NOT (
    public.user_belongs_to_organization(_organization_id) OR
    public.has_role(auth.uid(), 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied to organization data';
  END IF;

  -- Normalize state input to uppercase
  normalized_state := UPPER(TRIM(_state_abbr));

  WITH city_data AS (
    SELECT 
      TRIM(city) as city,
      COUNT(DISTINCT donor_email) FILTER (WHERE donor_email IS NOT NULL) as unique_donors,
      COUNT(*) as transaction_count,
      COALESCE(SUM(amount), 0) as revenue
    FROM actblue_transactions
    WHERE organization_id = _organization_id
      AND UPPER(TRIM(state)) = normalized_state
      AND city IS NOT NULL AND TRIM(city) != ''
      AND transaction_type IS DISTINCT FROM 'refund'
    GROUP BY TRIM(city)
    ORDER BY revenue DESC
    LIMIT 25
  )
  SELECT jsonb_build_object(
    'state', normalized_state,
    'cities', (SELECT COALESCE(jsonb_agg(row_to_json(c)), '[]'::jsonb) FROM city_data c)
  ) INTO result;

  RETURN result;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_donor_demographics_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_state_city_breakdown(uuid, text) TO authenticated;