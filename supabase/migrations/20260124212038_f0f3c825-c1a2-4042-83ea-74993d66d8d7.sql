-- Drop and recreate the RPC to query actblue_transactions directly
-- This avoids RLS issues with the donation_attribution view

DROP FUNCTION IF EXISTS get_ad_performance_donations_tz(UUID, DATE, DATE, TEXT);

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
  WITH ad_date_ranges AS (
    SELECT 
      rmh.organization_id,
      rmh.refcode AS rc,
      rmh.ad_id,
      rmh.creative_id,
      rmh.campaign_id,
      COALESCE(MIN(madm.date), rmh.first_seen_at::date) AS effective_start_date,
      COALESCE(MAX(madm.date), rmh.last_seen_at::date) AS effective_end_date,
      rmh.is_active
    FROM refcode_mapping_history rmh
    LEFT JOIN meta_ad_metrics_daily madm ON rmh.ad_id = madm.ad_id
    WHERE rmh.organization_id = p_organization_id
    GROUP BY rmh.organization_id, rmh.refcode, rmh.ad_id, rmh.creative_id, rmh.campaign_id, rmh.first_seen_at, rmh.last_seen_at, rmh.is_active
  )
  SELECT 
    COALESCE(matched_history.ad_id, rm.ad_id)::TEXT AS attributed_ad_id,
    COALESCE(matched_history.creative_id, rm.creative_id)::TEXT AS attributed_creative_id,
    COALESCE(matched_history.campaign_id, rm.campaign_id)::TEXT AS attributed_campaign_id,
    t.refcode,
    CASE
      WHEN matched_history.ad_id IS NOT NULL AND matched_history.match_type = 'exact_range' THEN 'refcode_exact_date'
      WHEN matched_history.ad_id IS NOT NULL AND matched_history.match_type = 'active_fallback' THEN 'refcode_active_ad'
      WHEN matched_history.ad_id IS NOT NULL THEN 'refcode_historical'
      WHEN rm.refcode IS NOT NULL AND rm.platform = 'meta' THEN 'refcode_meta'
      WHEN rm.refcode IS NOT NULL THEN 'refcode_current'
      ELSE 'unattributed'
    END AS attribution_method,
    t.amount,
    t.net_amount,
    t.donor_email,
    t.transaction_date
  FROM actblue_transactions t
  LEFT JOIN LATERAL (
    SELECT 
      adr.ad_id,
      adr.creative_id,
      adr.campaign_id,
      adr.effective_start_date,
      adr.effective_end_date,
      CASE
        WHEN (t.transaction_date AT TIME ZONE p_timezone)::DATE >= adr.effective_start_date 
             AND (t.transaction_date AT TIME ZONE p_timezone)::DATE <= adr.effective_end_date THEN 'exact_range'
        WHEN adr.is_active = true THEN 'active_fallback'
        ELSE 'historical'
      END AS match_type
    FROM ad_date_ranges adr
    WHERE adr.organization_id = t.organization_id 
      AND adr.rc = t.refcode
      AND (
        ((t.transaction_date AT TIME ZONE p_timezone)::DATE >= adr.effective_start_date 
         AND (t.transaction_date AT TIME ZONE p_timezone)::DATE <= adr.effective_end_date)
        OR (adr.is_active = true AND NOT EXISTS (
          SELECT 1 FROM ad_date_ranges adr2
          WHERE adr2.organization_id = t.organization_id 
            AND adr2.rc = t.refcode
            AND (t.transaction_date AT TIME ZONE p_timezone)::DATE >= adr2.effective_start_date 
            AND (t.transaction_date AT TIME ZONE p_timezone)::DATE <= adr2.effective_end_date
        ))
      )
    ORDER BY 
      CASE WHEN (t.transaction_date AT TIME ZONE p_timezone)::DATE >= adr.effective_start_date 
                AND (t.transaction_date AT TIME ZONE p_timezone)::DATE <= adr.effective_end_date THEN 0 ELSE 1 END,
      adr.effective_start_date DESC
    LIMIT 1
  ) matched_history ON true
  LEFT JOIN refcode_mappings rm ON t.organization_id = rm.organization_id 
    AND t.refcode = rm.refcode 
    AND matched_history.ad_id IS NULL
  WHERE t.organization_id = p_organization_id
    AND t.transaction_type = 'donation'
    AND (t.transaction_date AT TIME ZONE p_timezone)::DATE >= p_start_date
    AND (t.transaction_date AT TIME ZONE p_timezone)::DATE <= p_end_date;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_ad_performance_donations_tz(UUID, DATE, DATE, TEXT) TO authenticated;

COMMENT ON FUNCTION get_ad_performance_donations_tz IS 
'Returns donation attribution data with timezone-aware date filtering.
Queries actblue_transactions directly to avoid RLS issues with donation_attribution view.
Includes refcode-to-ad mapping via refcode_mapping_history and refcode_mappings tables.
Default timezone is America/New_York to match ActBlue reporting boundaries.';