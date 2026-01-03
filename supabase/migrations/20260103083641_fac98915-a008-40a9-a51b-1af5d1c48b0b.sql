-- Update get_state_city_breakdown to normalize city names (case-insensitive grouping)
CREATE OR REPLACE FUNCTION public.get_state_city_breakdown(_organization_id uuid, _state_abbr text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  normalized_state text;
BEGIN
  -- Normalize state abbreviation
  normalized_state := UPPER(TRIM(_state_abbr));
  
  WITH city_data AS (
    SELECT 
      INITCAP(LOWER(TRIM(city))) as city,
      COUNT(DISTINCT donor_email) FILTER (WHERE donor_email IS NOT NULL) as unique_donors,
      COUNT(*) as transaction_count,
      COALESCE(SUM(amount), 0) as revenue
    FROM actblue_transactions
    WHERE organization_id = _organization_id
      AND UPPER(TRIM(state)) = normalized_state
      AND city IS NOT NULL AND TRIM(city) != ''
      AND transaction_type IS DISTINCT FROM 'refund'
    GROUP BY UPPER(TRIM(city))
    ORDER BY revenue DESC
    LIMIT 25
  )
  SELECT jsonb_build_object(
    'state', normalized_state,
    'cities', COALESCE(jsonb_agg(
      jsonb_build_object(
        'city', city,
        'unique_donors', unique_donors,
        'transaction_count', transaction_count,
        'revenue', revenue
      )
    ), '[]'::jsonb)
  ) INTO result
  FROM city_data;
  
  RETURN COALESCE(result, jsonb_build_object('state', normalized_state, 'cities', '[]'::jsonb));
END;
$$;