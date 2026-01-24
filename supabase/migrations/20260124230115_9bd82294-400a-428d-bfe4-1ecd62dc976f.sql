-- ============================================================================
-- Link Tracking RPCs with Correct Click ID Suffix Matching
-- ============================================================================

-- Function to get link tracking metrics by refcode with accurate Click ID matching
CREATE OR REPLACE FUNCTION public.get_link_tracking_metrics(
  p_organization_id UUID,
  p_start_date TEXT,
  p_end_date TEXT
)
RETURNS TABLE (
  refcode TEXT,
  total_clicks BIGINT,
  unique_sessions BIGINT,
  meta_ad_clicks BIGINT,
  with_fbp BIGINT,
  with_fbc BIGINT,
  cookie_capture_rate NUMERIC,
  conversions BIGINT,
  revenue NUMERIC,
  attribution_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH touchpoint_data AS (
    SELECT 
      COALESCE(t.refcode, '(no refcode)') as refcode,
      t.id,
      t.metadata->>'session_id' as session_id,
      t.metadata->>'fbclid' as fbclid,
      t.metadata->>'fbc' as fbc,
      t.metadata->>'fbp' as fbp,
      -- Extract suffix after _aem_ or take last 24 chars
      CASE 
        WHEN POSITION('_aem_' IN COALESCE(t.metadata->>'fbclid', '')) > 0 
        THEN SUBSTRING(t.metadata->>'fbclid' FROM POSITION('_aem_' IN t.metadata->>'fbclid') + 5)
        WHEN LENGTH(COALESCE(t.metadata->>'fbclid', '')) >= 24
        THEN RIGHT(t.metadata->>'fbclid', 24)
        ELSE NULL
      END as fbclid_suffix
    FROM attribution_touchpoints t
    WHERE t.organization_id = p_organization_id
      AND t.occurred_at::date >= p_start_date::date
      AND t.occurred_at::date <= p_end_date::date
  ),
  donation_data AS (
    SELECT 
      d.id,
      COALESCE(d.refcode, '(no refcode)') as refcode,
      d.amount,
      -- Extract the actual suffix from refcode2 by removing fb_m_ prefix
      CASE 
        WHEN d.refcode2 LIKE 'fb_m_%' THEN REPLACE(d.refcode2, 'fb_m_', '')
        WHEN d.refcode2 LIKE 'fb_%' THEN REPLACE(d.refcode2, 'fb_', '')
        ELSE d.refcode2
      END as suffix
    FROM actblue_transactions d
    WHERE d.organization_id = p_organization_id
      AND d.transaction_date::date >= p_start_date::date
      AND d.transaction_date::date <= p_end_date::date
      AND d.refcode2 IS NOT NULL
      AND d.refcode2 LIKE 'fb_%'
      AND d.transaction_type = 'donation'
  ),
  -- Match donations to touchpoints via suffix
  click_id_matches AS (
    SELECT DISTINCT ON (dd.id)
      dd.refcode,
      dd.id as donation_id,
      dd.amount
    FROM donation_data dd
    INNER JOIN touchpoint_data tp ON tp.fbclid_suffix = dd.suffix
    WHERE tp.fbclid_suffix IS NOT NULL AND dd.suffix IS NOT NULL
  ),
  -- Aggregate matches by refcode
  click_id_aggregated AS (
    SELECT 
      cm.refcode,
      COUNT(*) as conversions,
      SUM(cm.amount) as revenue
    FROM click_id_matches cm
    GROUP BY cm.refcode
  ),
  -- Aggregate touchpoints by refcode
  touchpoint_aggregated AS (
    SELECT 
      tp.refcode,
      COUNT(*) as total_clicks,
      COUNT(DISTINCT tp.session_id) FILTER (WHERE tp.session_id IS NOT NULL) as unique_sessions,
      COUNT(*) FILTER (WHERE tp.fbclid IS NOT NULL OR tp.fbc IS NOT NULL) as meta_ad_clicks,
      COUNT(*) FILTER (WHERE tp.fbp IS NOT NULL) as with_fbp,
      COUNT(*) FILTER (WHERE tp.fbc IS NOT NULL) as with_fbc
    FROM touchpoint_data tp
    GROUP BY tp.refcode
  )
  SELECT 
    ta.refcode,
    ta.total_clicks,
    CASE WHEN ta.unique_sessions > 0 THEN ta.unique_sessions ELSE ta.total_clicks END as unique_sessions,
    ta.meta_ad_clicks,
    ta.with_fbp,
    ta.with_fbc,
    CASE 
      WHEN ta.total_clicks > 0 
      THEN ROUND(100.0 * (ta.with_fbp + ta.with_fbc) / ta.total_clicks, 1)
      ELSE 0 
    END as cookie_capture_rate,
    COALESCE(ca.conversions, 0)::BIGINT as conversions,
    COALESCE(ca.revenue, 0)::NUMERIC as revenue,
    CASE WHEN ca.conversions > 0 THEN 'click_id' ELSE 'none' END as attribution_type
  FROM touchpoint_aggregated ta
  LEFT JOIN click_id_aggregated ca ON ta.refcode = ca.refcode
  ORDER BY ta.total_clicks DESC;
END;
$$;

-- Function to get link tracking summary totals
CREATE OR REPLACE FUNCTION public.get_link_tracking_summary(
  p_organization_id UUID,
  p_start_date TEXT,
  p_end_date TEXT
)
RETURNS TABLE (
  total_clicks BIGINT,
  unique_sessions BIGINT,
  meta_ad_clicks BIGINT,
  cookie_capture_rate NUMERIC,
  conversions BIGINT,
  attributed_revenue NUMERIC,
  conversion_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH touchpoint_data AS (
    SELECT 
      t.id,
      t.metadata->>'session_id' as session_id,
      t.metadata->>'fbclid' as fbclid,
      t.metadata->>'fbc' as fbc,
      t.metadata->>'fbp' as fbp,
      CASE 
        WHEN POSITION('_aem_' IN COALESCE(t.metadata->>'fbclid', '')) > 0 
        THEN SUBSTRING(t.metadata->>'fbclid' FROM POSITION('_aem_' IN t.metadata->>'fbclid') + 5)
        WHEN LENGTH(COALESCE(t.metadata->>'fbclid', '')) >= 24
        THEN RIGHT(t.metadata->>'fbclid', 24)
        ELSE NULL
      END as fbclid_suffix
    FROM attribution_touchpoints t
    WHERE t.organization_id = p_organization_id
      AND t.occurred_at::date >= p_start_date::date
      AND t.occurred_at::date <= p_end_date::date
  ),
  donation_data AS (
    SELECT 
      d.id,
      d.amount,
      CASE 
        WHEN d.refcode2 LIKE 'fb_m_%' THEN REPLACE(d.refcode2, 'fb_m_', '')
        WHEN d.refcode2 LIKE 'fb_%' THEN REPLACE(d.refcode2, 'fb_', '')
        ELSE d.refcode2
      END as suffix
    FROM actblue_transactions d
    WHERE d.organization_id = p_organization_id
      AND d.transaction_date::date >= p_start_date::date
      AND d.transaction_date::date <= p_end_date::date
      AND d.refcode2 IS NOT NULL
      AND d.refcode2 LIKE 'fb_%'
      AND d.transaction_type = 'donation'
  ),
  click_id_matches AS (
    SELECT DISTINCT ON (dd.id)
      dd.id as donation_id,
      dd.amount
    FROM donation_data dd
    INNER JOIN touchpoint_data tp ON tp.fbclid_suffix = dd.suffix
    WHERE tp.fbclid_suffix IS NOT NULL AND dd.suffix IS NOT NULL
  ),
  summary_stats AS (
    SELECT 
      COUNT(*) as total_clicks,
      COUNT(DISTINCT t.session_id) FILTER (WHERE t.session_id IS NOT NULL) as unique_sessions,
      COUNT(*) FILTER (WHERE t.fbclid IS NOT NULL OR t.fbc IS NOT NULL) as meta_ad_clicks,
      COUNT(*) FILTER (WHERE t.fbp IS NOT NULL OR t.fbc IS NOT NULL) as with_cookies
    FROM touchpoint_data t
  ),
  conversion_stats AS (
    SELECT 
      COUNT(*) as conversions,
      SUM(amount) as revenue
    FROM click_id_matches
  )
  SELECT 
    ss.total_clicks,
    CASE WHEN ss.unique_sessions > 0 THEN ss.unique_sessions ELSE ss.total_clicks END as unique_sessions,
    ss.meta_ad_clicks,
    CASE 
      WHEN ss.total_clicks > 0 
      THEN ROUND(100.0 * ss.with_cookies / ss.total_clicks, 1)
      ELSE 0 
    END as cookie_capture_rate,
    COALESCE(cs.conversions, 0)::BIGINT as conversions,
    COALESCE(cs.revenue, 0)::NUMERIC as attributed_revenue,
    CASE 
      WHEN ss.total_clicks > 0 
      THEN ROUND(100.0 * COALESCE(cs.conversions, 0) / ss.total_clicks, 2)
      ELSE 0 
    END as conversion_rate
  FROM summary_stats ss
  CROSS JOIN conversion_stats cs;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_link_tracking_metrics(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_link_tracking_summary(UUID, TEXT, TEXT) TO authenticated;