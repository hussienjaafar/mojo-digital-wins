-- Migration: Create attribute_transaction RPC function
-- Purpose: Implements the 4-tier Attribution Waterfall for refcode resolution
-- Part of the Attribution Waterfall system upgrade

-- Drop existing function if exists (for idempotent migrations)
DROP FUNCTION IF EXISTS public.attribute_transaction(UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT);

-- Create the main attribution waterfall function
CREATE OR REPLACE FUNCTION public.attribute_transaction(
  p_organization_id UUID,
  p_refcode TEXT,
  p_transaction_date TIMESTAMPTZ DEFAULT now(),
  p_click_id TEXT DEFAULT NULL,
  p_fbclid TEXT DEFAULT NULL
)
RETURNS TABLE (
  platform TEXT,
  confidence_score DECIMAL(3,2),
  confidence_level public.attribution_confidence_level,
  attribution_method TEXT,
  attribution_tier INT,
  matched_ad_id TEXT,
  matched_campaign_id TEXT,
  matched_creative_id TEXT,
  rule_name TEXT
) AS $$
DECLARE
  v_lower_refcode TEXT;
  v_result RECORD;
BEGIN
  -- Normalize refcode to lowercase for matching
  v_lower_refcode := LOWER(COALESCE(p_refcode, ''));

  -- ============================================================================
  -- TIER 1: DETERMINISTIC (100% confidence)
  -- Click ID or exact refcode mapping with ad_id
  -- ============================================================================

  -- 1a. Check for click_id/fbclid (Meta click tracking)
  IF p_click_id IS NOT NULL OR p_fbclid IS NOT NULL THEN
    RETURN QUERY SELECT
      'meta'::TEXT,
      1.00::DECIMAL(3,2),
      'deterministic'::public.attribution_confidence_level,
      'click_id'::TEXT,
      1::INT,
      NULL::TEXT,
      NULL::TEXT,
      NULL::TEXT,
      'Click ID Match'::TEXT;
    RETURN;
  END IF;

  -- 1b. Check for exact refcode mapping with ad_id (URL-proven)
  IF v_lower_refcode <> '' THEN
    SELECT
      rm.platform,
      rm.ad_id,
      rm.campaign_id,
      rm.creative_id
    INTO v_result
    FROM public.refcode_mappings rm
    WHERE rm.organization_id = p_organization_id
      AND LOWER(rm.refcode) = v_lower_refcode
      AND rm.ad_id IS NOT NULL  -- Must have ad_id for deterministic
    LIMIT 1;

    IF FOUND THEN
      RETURN QUERY SELECT
        v_result.platform::TEXT,
        1.00::DECIMAL(3,2),
        'deterministic'::public.attribution_confidence_level,
        'refcode_exact_with_ad'::TEXT,
        1::INT,
        v_result.ad_id::TEXT,
        v_result.campaign_id::TEXT,
        v_result.creative_id::TEXT,
        'Exact Refcode Mapping'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- ============================================================================
  -- TIER 2: HIGH PROBABILITY (85-95% confidence)
  -- Pattern rules from attribution_rules table
  -- ============================================================================
  IF v_lower_refcode <> '' THEN
    FOR v_result IN
      SELECT
        ar.platform,
        ar.confidence_score,
        ar.name,
        ar.pattern,
        ar.rule_type
      FROM public.attribution_rules ar
      WHERE ar.organization_id = p_organization_id
        AND ar.is_active = true
        AND (
          (ar.rule_type = 'prefix' AND v_lower_refcode LIKE LOWER(ar.pattern) || '%')
          OR (ar.rule_type = 'suffix' AND v_lower_refcode LIKE '%' || LOWER(ar.pattern))
          OR (ar.rule_type = 'contains' AND v_lower_refcode LIKE '%' || LOWER(ar.pattern) || '%')
          OR (ar.rule_type = 'exact' AND v_lower_refcode = LOWER(ar.pattern))
          OR (ar.rule_type = 'regex' AND v_lower_refcode ~ ar.pattern)
        )
      ORDER BY ar.priority ASC, ar.confidence_score DESC
      LIMIT 1
    LOOP
      RETURN QUERY SELECT
        v_result.platform::TEXT,
        v_result.confidence_score::DECIMAL(3,2),
        'high'::public.attribution_confidence_level,
        'pattern_rule'::TEXT,
        2::INT,
        NULL::TEXT,
        NULL::TEXT,
        NULL::TEXT,
        v_result.name::TEXT;
      RETURN;
    END LOOP;
  END IF;

  -- ============================================================================
  -- TIER 3: MEDIUM PROBABILITY (60-80% confidence)
  -- Fuzzy matching and refcode mapping without ad_id
  -- ============================================================================
  IF v_lower_refcode <> '' THEN
    -- 3a. Check for refcode mapping without ad_id (platform known but not ad-specific)
    SELECT
      rm.platform,
      rm.campaign_id,
      rm.creative_id
    INTO v_result
    FROM public.refcode_mappings rm
    WHERE rm.organization_id = p_organization_id
      AND LOWER(rm.refcode) = v_lower_refcode
      AND rm.ad_id IS NULL  -- No ad_id = less certain
    LIMIT 1;

    IF FOUND THEN
      RETURN QUERY SELECT
        v_result.platform::TEXT,
        0.75::DECIMAL(3,2),
        'medium'::public.attribution_confidence_level,
        'refcode_mapping_no_ad'::TEXT,
        3::INT,
        NULL::TEXT,
        v_result.campaign_id::TEXT,
        v_result.creative_id::TEXT,
        'Refcode Mapping (No Ad ID)'::TEXT;
      RETURN;
    END IF;

    -- 3b. Fuzzy match against existing refcode_mappings (typo tolerance)
    SELECT
      rm.platform,
      rm.refcode,
      rm.ad_id,
      rm.campaign_id,
      rm.creative_id,
      similarity(LOWER(rm.refcode), v_lower_refcode) as sim_score
    INTO v_result
    FROM public.refcode_mappings rm
    WHERE rm.organization_id = p_organization_id
      AND similarity(LOWER(rm.refcode), v_lower_refcode) > 0.6
    ORDER BY similarity(LOWER(rm.refcode), v_lower_refcode) DESC
    LIMIT 1;

    IF FOUND THEN
      RETURN QUERY SELECT
        v_result.platform::TEXT,
        LEAST(v_result.sim_score, 0.80)::DECIMAL(3,2),  -- Cap at 80% for fuzzy
        'medium'::public.attribution_confidence_level,
        'fuzzy_match'::TEXT,
        3::INT,
        v_result.ad_id::TEXT,
        v_result.campaign_id::TEXT,
        v_result.creative_id::TEXT,
        ('Fuzzy Match: ' || v_result.refcode)::TEXT;
      RETURN;
    END IF;
  END IF;

  -- ============================================================================
  -- TIER 4: LOW PROBABILITY (40% confidence)
  -- Temporal correlation - transaction occurred during active ad flight
  -- ============================================================================
  SELECT
    mc.campaign_id,
    mc.ad_id,
    mc.name
  INTO v_result
  FROM public.meta_ad_metrics_daily mad
  JOIN public.meta_campaigns mc ON mad.campaign_id = mc.campaign_id
  WHERE mad.organization_id = p_organization_id
    AND mad.date = p_transaction_date::DATE
    AND mad.spend > 0  -- Only active campaigns with spend
  ORDER BY mad.spend DESC  -- Prioritize highest spend campaign
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT
      'meta'::TEXT,
      0.40::DECIMAL(3,2),
      'low'::public.attribution_confidence_level,
      'temporal_correlation'::TEXT,
      4::INT,
      v_result.ad_id::TEXT,
      v_result.campaign_id::TEXT,
      NULL::TEXT,
      ('Active Campaign: ' || COALESCE(v_result.name, 'Unknown'))::TEXT;
    RETURN;
  END IF;

  -- ============================================================================
  -- NO MATCH: Unattributed
  -- ============================================================================
  RETURN QUERY SELECT
    'unattributed'::TEXT,
    0.00::DECIMAL(3,2),
    'none'::public.attribution_confidence_level,
    'no_match'::TEXT,
    0::INT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT;
  RETURN;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.attribute_transaction TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.attribute_transaction IS 'Attribution Waterfall: Resolves refcodes to platforms with confidence scoring.
Tier 1: Deterministic (click_id, exact refcode with ad_id) - 100%
Tier 2: Pattern Rules (regex, prefix matching) - 85-95%
Tier 3: Fuzzy/Partial (typo tolerance, mapping without ad_id) - 60-80%
Tier 4: Temporal Correlation (active ad flight) - 40%';


-- ============================================================================
-- Batch attribution function for efficiency
-- ============================================================================
DROP FUNCTION IF EXISTS public.batch_attribute_transactions(UUID, JSONB);

CREATE OR REPLACE FUNCTION public.batch_attribute_transactions(
  p_organization_id UUID,
  p_transactions JSONB  -- Array of {refcode, transaction_date, click_id, fbclid}
)
RETURNS TABLE (
  refcode TEXT,
  transaction_date TIMESTAMPTZ,
  platform TEXT,
  confidence_score DECIMAL(3,2),
  confidence_level public.attribution_confidence_level,
  attribution_method TEXT,
  attribution_tier INT,
  matched_ad_id TEXT,
  matched_campaign_id TEXT,
  rule_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.refcode,
    t.transaction_date,
    attr.platform,
    attr.confidence_score,
    attr.confidence_level,
    attr.attribution_method,
    attr.attribution_tier,
    attr.matched_ad_id,
    attr.matched_campaign_id,
    attr.rule_name
  FROM jsonb_to_recordset(p_transactions) AS t(
    refcode TEXT,
    transaction_date TIMESTAMPTZ,
    click_id TEXT,
    fbclid TEXT
  )
  CROSS JOIN LATERAL public.attribute_transaction(
    p_organization_id,
    t.refcode,
    t.transaction_date,
    t.click_id,
    t.fbclid
  ) attr;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.batch_attribute_transactions TO authenticated;

COMMENT ON FUNCTION public.batch_attribute_transactions IS 'Batch attribution for multiple transactions. More efficient than calling attribute_transaction in a loop.';


-- ============================================================================
-- Helper function to get attribution summary statistics
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_attribution_summary(UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION public.get_attribution_summary(
  p_organization_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  total_transactions BIGINT,
  deterministic_count BIGINT,
  deterministic_pct DECIMAL(5,2),
  high_confidence_count BIGINT,
  high_confidence_pct DECIMAL(5,2),
  medium_confidence_count BIGINT,
  medium_confidence_pct DECIMAL(5,2),
  low_confidence_count BIGINT,
  low_confidence_pct DECIMAL(5,2),
  unattributed_count BIGINT,
  unattributed_pct DECIMAL(5,2),
  meta_count BIGINT,
  sms_count BIGINT,
  email_count BIGINT,
  other_count BIGINT
) AS $$
WITH attributed AS (
  SELECT
    t.id,
    t.refcode,
    t.transaction_date,
    t.click_id,
    t.fbclid,
    attr.*
  FROM public.actblue_transactions t
  CROSS JOIN LATERAL public.attribute_transaction(
    p_organization_id,
    t.refcode,
    t.transaction_date,
    t.click_id,
    t.fbclid
  ) attr
  WHERE t.organization_id = p_organization_id
    AND t.transaction_date >= p_start_date
    AND t.transaction_date < p_end_date + INTERVAL '1 day'
    AND t.transaction_type = 'donation'
)
SELECT
  COUNT(*)::BIGINT as total_transactions,
  COUNT(*) FILTER (WHERE confidence_level = 'deterministic')::BIGINT as deterministic_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE confidence_level = 'deterministic') / NULLIF(COUNT(*), 0), 2) as deterministic_pct,
  COUNT(*) FILTER (WHERE confidence_level = 'high')::BIGINT as high_confidence_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE confidence_level = 'high') / NULLIF(COUNT(*), 0), 2) as high_confidence_pct,
  COUNT(*) FILTER (WHERE confidence_level = 'medium')::BIGINT as medium_confidence_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE confidence_level = 'medium') / NULLIF(COUNT(*), 0), 2) as medium_confidence_pct,
  COUNT(*) FILTER (WHERE confidence_level = 'low')::BIGINT as low_confidence_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE confidence_level = 'low') / NULLIF(COUNT(*), 0), 2) as low_confidence_pct,
  COUNT(*) FILTER (WHERE confidence_level = 'none')::BIGINT as unattributed_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE confidence_level = 'none') / NULLIF(COUNT(*), 0), 2) as unattributed_pct,
  COUNT(*) FILTER (WHERE platform = 'meta')::BIGINT as meta_count,
  COUNT(*) FILTER (WHERE platform = 'sms')::BIGINT as sms_count,
  COUNT(*) FILTER (WHERE platform = 'email')::BIGINT as email_count,
  COUNT(*) FILTER (WHERE platform = 'other')::BIGINT as other_count
FROM attributed;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_attribution_summary TO authenticated;

COMMENT ON FUNCTION public.get_attribution_summary IS 'Returns attribution quality summary for a date range. Shows breakdown by confidence level and platform.';
