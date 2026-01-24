-- Create RPC function for timezone-aware attributed revenue calculation
-- This properly converts transaction_date to the org's timezone before date comparison

CREATE OR REPLACE FUNCTION get_attributed_revenue_tz(
  p_organization_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_timezone TEXT DEFAULT 'America/New_York'
)
RETURNS TABLE (
  channel TEXT,
  donation_count BIGINT,
  gross_raised NUMERIC,
  net_raised NUMERIC
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the user can access this organization's data
  IF NOT can_access_organization_data(p_organization_id) THEN
    RAISE EXCEPTION 'Access denied to organization data';
  END IF;

  RETURN QUERY
  SELECT 
    CASE
      -- Tier 1: Click-based attribution (highest confidence)
      WHEN t.click_id IS NOT NULL OR t.fbclid IS NOT NULL THEN 'meta'
      -- Tier 2: Refcode mapping from refcode_mappings table
      WHEN rm.platform = 'meta' THEN 'meta'
      WHEN rm.platform = 'sms' THEN 'sms'
      -- Tier 3: Form-based hints
      WHEN t.contribution_form ILIKE '%sms%' THEN 'sms'
      -- Tier 4: Unattributed
      ELSE 'unattributed'
    END as channel,
    COUNT(*)::BIGINT as donation_count,
    SUM(t.amount)::NUMERIC as gross_raised,
    SUM(COALESCE(t.net_amount, t.amount))::NUMERIC as net_raised
  FROM actblue_transactions t
  LEFT JOIN refcode_mappings rm 
    ON t.organization_id = rm.organization_id 
    AND t.refcode = rm.refcode
  WHERE t.organization_id = p_organization_id
    AND t.transaction_type = 'donation'
    AND (t.transaction_date AT TIME ZONE p_timezone)::DATE >= p_start_date
    AND (t.transaction_date AT TIME ZONE p_timezone)::DATE <= p_end_date
  GROUP BY 1;
END;
$$ LANGUAGE plpgsql;