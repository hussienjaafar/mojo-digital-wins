-- Migration: Update attribute_transaction to support global rules
-- Purpose: Check org-specific rules first, then fall back to global rules
--
-- Priority order for pattern matching:
--   1. Org-specific rules (organization_id = p_organization_id)
--   2. Global rules (organization_id IS NULL)

-- Drop existing function to recreate with updated logic
DROP FUNCTION IF EXISTS public.attribute_transaction(UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT);

-- Recreate with global rules support
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
  rule_name TEXT,
  is_global_rule BOOLEAN
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
      'Click ID Match'::TEXT,
      false::BOOLEAN;
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
        'Exact Refcode Mapping'::TEXT,
        false::BOOLEAN;
      RETURN;
    END IF;
  END IF;

  -- ============================================================================
  -- TIER 2: HIGH PROBABILITY (85-95% confidence)
  -- Pattern rules from attribution_rules table
  -- Priority: Org-specific rules first, then global rules
  -- ============================================================================
  IF v_lower_refcode <> '' THEN
    -- Check both org-specific AND global rules, ordered by:
    -- 1. Org-specific first (organization_id = p_organization_id)
    -- 2. Then global (organization_id IS NULL)
    -- 3. Within each, by priority ASC, confidence DESC
    FOR v_result IN
      SELECT
        ar.platform,
        ar.confidence_score,
        ar.name,
        ar.pattern,
        ar.rule_type,
        ar.organization_id IS NULL as is_global
      FROM public.attribution_rules ar
      WHERE ar.is_active = true
        AND (ar.organization_id = p_organization_id OR ar.organization_id IS NULL)
        AND (
          (ar.rule_type = 'prefix' AND v_lower_refcode LIKE LOWER(ar.pattern) || '%')
          OR (ar.rule_type = 'suffix' AND v_lower_refcode LIKE '%' || LOWER(ar.pattern))
          OR (ar.rule_type = 'contains' AND v_lower_refcode LIKE '%' || LOWER(ar.pattern) || '%')
          OR (ar.rule_type = 'exact' AND v_lower_refcode = LOWER(ar.pattern))
          OR (ar.rule_type = 'regex' AND v_lower_refcode ~ ar.pattern)
        )
      ORDER BY
        -- Org-specific rules take precedence over global rules
        CASE WHEN ar.organization_id IS NULL THEN 1 ELSE 0 END ASC,
        ar.priority ASC,
        ar.confidence_score DESC
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
        v_result.name::TEXT,
        v_result.is_global::BOOLEAN;
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
        'Refcode Mapping (No Ad ID)'::TEXT,
        false::BOOLEAN;
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
        ('Fuzzy Match: ' || v_result.refcode)::TEXT,
        false::BOOLEAN;
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
      ('Active Campaign: ' || COALESCE(v_result.name, 'Unknown'))::TEXT,
      false::BOOLEAN;
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
    NULL::TEXT,
    false::BOOLEAN;
  RETURN;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.attribute_transaction TO authenticated;

-- Update comment
COMMENT ON FUNCTION public.attribute_transaction IS 'Attribution Waterfall: Resolves refcodes to platforms with confidence scoring.

Uses GLOBAL rules (organization_id IS NULL) that apply to ALL organizations.
Org-specific rules can override global rules if needed.

Tier 1: Deterministic (click_id, exact refcode with ad_id) - 100%
Tier 2: Pattern Rules (regex, prefix matching) - 85-95% (global rules)
Tier 3: Fuzzy/Partial (typo tolerance, mapping without ad_id) - 60-80%
Tier 4: Temporal Correlation (active ad flight) - 40%';


-- ============================================================================
-- Update batch function to include is_global_rule
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
  rule_name TEXT,
  is_global_rule BOOLEAN
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
    attr.rule_name,
    attr.is_global_rule
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


-- ============================================================================
-- Add function to list all active rules (for admin UI)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_active_attribution_rules(
  p_organization_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  name TEXT,
  description TEXT,
  pattern TEXT,
  rule_type public.attribution_rule_type,
  platform TEXT,
  confidence_score DECIMAL(3,2),
  priority INT,
  is_global BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ar.id,
    ar.organization_id,
    ar.name,
    ar.description,
    ar.pattern,
    ar.rule_type,
    ar.platform,
    ar.confidence_score,
    ar.priority,
    ar.organization_id IS NULL as is_global,
    ar.created_at
  FROM public.attribution_rules ar
  WHERE ar.is_active = true
    AND (
      ar.organization_id IS NULL  -- Global rules
      OR ar.organization_id = p_organization_id  -- Org-specific rules
    )
  ORDER BY
    CASE WHEN ar.organization_id IS NULL THEN 1 ELSE 0 END ASC,
    ar.priority ASC,
    ar.name ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_active_attribution_rules TO authenticated;

COMMENT ON FUNCTION public.get_active_attribution_rules IS
'Returns all active attribution rules for an organization, including global rules.
Pass NULL to get only global rules.';
