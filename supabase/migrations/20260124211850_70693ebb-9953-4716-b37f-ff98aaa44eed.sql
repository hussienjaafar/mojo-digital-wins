-- Create timezone-aware function for ad performance donation attribution
-- This fixes the UTC vs Eastern timezone mismatch causing incorrect raised amounts

CREATE OR REPLACE FUNCTION get_ad_performance_donations_tz(
  p_organization_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_timezone TEXT DEFAULT 'America/New_York'
)
RETURNS TABLE (
  attributed_ad_id TEXT,
  attributed_creative_id TEXT,
  attributed_campaign_id TEXT,
  refcode TEXT,
  attribution_method TEXT,
  amount NUMERIC,
  net_amount NUMERIC,
  donor_email TEXT,
  transaction_date TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    da.attributed_ad_id,
    da.attributed_creative_id,
    da.attributed_campaign_id,
    da.refcode,
    da.attribution_method,
    da.amount,
    da.net_amount,
    da.donor_email,
    da.transaction_date
  FROM donation_attribution da
  WHERE da.organization_id = p_organization_id
    AND da.transaction_type = 'donation'
    -- Use timezone-aware date comparison
    AND (da.transaction_date AT TIME ZONE p_timezone)::DATE >= p_start_date
    AND (da.transaction_date AT TIME ZONE p_timezone)::DATE <= p_end_date;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_ad_performance_donations_tz(UUID, DATE, DATE, TEXT) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION get_ad_performance_donations_tz IS 
'Returns donation attribution data with timezone-aware date filtering. 
Fixes the UTC vs Eastern timezone mismatch that caused incorrect raised amounts on the Ad Performance page.
Default timezone is America/New_York to match ActBlue reporting boundaries.';