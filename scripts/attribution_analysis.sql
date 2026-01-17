-- ============================================================================
-- ATTRIBUTION SYSTEM VALIDATION ANALYSIS
-- Run this AFTER applying migrations (supabase db push)
-- ============================================================================

-- ============================================================================
-- STEP 1: Find Organization IDs for Real Clients
-- ============================================================================
SELECT
  id,
  name,
  created_at
FROM organizations
WHERE LOWER(name) LIKE '%michael%blake%'
   OR LOWER(name) LIKE '%new%policy%'
   OR LOWER(name) LIKE '%anewpolicy%'
ORDER BY name;

-- ============================================================================
-- STEP 2: Verify Global Attribution Rules Exist
-- ============================================================================
SELECT
  name,
  pattern,
  rule_type,
  platform,
  confidence_score,
  CASE WHEN organization_id IS NULL THEN 'GLOBAL' ELSE 'ORG-SPECIFIC' END as scope
FROM attribution_rules
WHERE is_active = true
ORDER BY
  CASE WHEN organization_id IS NULL THEN 0 ELSE 1 END,
  platform,
  priority;

-- ============================================================================
-- STEP 3: Attribution Analysis for Each Client
-- Replace 'YOUR_ORG_ID' with actual org ID from Step 1
-- ============================================================================

-- 3a. Get attribution summary for Michael Blake (replace ID)
-- SELECT * FROM get_attribution_summary('YOUR_ORG_ID', '2024-01-01', '2025-12-31');

-- 3b. Detailed breakdown by confidence tier
WITH attributed AS (
  SELECT
    t.id,
    t.refcode,
    t.amount,
    t.transaction_date,
    t.click_id,
    t.fbclid,
    attr.*
  FROM actblue_transactions t
  CROSS JOIN LATERAL attribute_transaction(
    t.organization_id,
    t.refcode,
    t.transaction_date,
    t.click_id,
    t.fbclid
  ) attr
  WHERE t.organization_id = 'YOUR_ORG_ID'  -- Replace with actual org ID
    AND t.transaction_type = 'donation'
    AND t.transaction_date >= '2024-01-01'
)
SELECT
  confidence_level,
  attribution_method,
  platform,
  COUNT(*) as transaction_count,
  SUM(amount) as total_revenue,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as pct_of_transactions,
  ROUND(100.0 * SUM(amount) / SUM(SUM(amount)) OVER(), 2) as pct_of_revenue
FROM attributed
GROUP BY confidence_level, attribution_method, platform
ORDER BY
  CASE confidence_level
    WHEN 'deterministic' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
    ELSE 5
  END,
  total_revenue DESC;

-- ============================================================================
-- STEP 4: Identify Orphaned Refcodes (Not Matching Any Pattern)
-- These are potential revenue recovery opportunities
-- ============================================================================
WITH orphaned AS (
  SELECT
    t.refcode,
    COUNT(*) as donation_count,
    SUM(t.amount) as total_amount,
    MIN(t.transaction_date) as first_seen,
    MAX(t.transaction_date) as last_seen,
    attr.platform,
    attr.confidence_level,
    attr.attribution_method
  FROM actblue_transactions t
  CROSS JOIN LATERAL attribute_transaction(
    t.organization_id,
    t.refcode,
    t.transaction_date,
    t.click_id,
    t.fbclid
  ) attr
  WHERE t.organization_id = 'YOUR_ORG_ID'  -- Replace with actual org ID
    AND t.transaction_type = 'donation'
    AND t.refcode IS NOT NULL
    AND t.refcode != ''
  GROUP BY t.refcode, attr.platform, attr.confidence_level, attr.attribution_method
)
SELECT *
FROM orphaned
WHERE confidence_level IN ('medium', 'none')  -- Not deterministic or high confidence
  AND attribution_method IN ('refcode_unknown_pattern', 'no_match')
ORDER BY total_amount DESC
LIMIT 50;

-- ============================================================================
-- STEP 5: Unique Refcode Patterns Analysis
-- Shows all unique refcode prefixes to identify missing patterns
-- ============================================================================
SELECT
  LOWER(LEFT(refcode, 3)) as prefix_3char,
  LOWER(LEFT(refcode, 5)) as prefix_5char,
  COUNT(*) as count,
  SUM(amount) as total_revenue,
  array_agg(DISTINCT LOWER(LEFT(refcode, 10))) as sample_refcodes
FROM actblue_transactions
WHERE organization_id = 'YOUR_ORG_ID'  -- Replace with actual org ID
  AND transaction_type = 'donation'
  AND refcode IS NOT NULL
  AND refcode != ''
GROUP BY LOWER(LEFT(refcode, 3)), LOWER(LEFT(refcode, 5))
ORDER BY total_revenue DESC
LIMIT 30;

-- ============================================================================
-- STEP 6: Before/After Comparison
-- Compare old detection (simple patterns) vs new waterfall
-- ============================================================================
WITH comparison AS (
  SELECT
    t.id,
    t.refcode,
    t.amount,
    -- OLD METHOD: Simple pattern matching
    CASE
      WHEN t.click_id IS NOT NULL OR t.fbclid IS NOT NULL THEN 'meta'
      WHEN LOWER(t.refcode) LIKE 'txt%' OR LOWER(t.refcode) LIKE 'sms%' THEN 'sms'
      WHEN LOWER(t.refcode) LIKE 'em%' OR LOWER(t.refcode) LIKE 'email%' THEN 'email'
      WHEN t.refcode IS NOT NULL AND t.refcode != '' THEN 'other'
      ELSE 'unattributed'
    END as old_channel,
    -- NEW METHOD: Full waterfall
    attr.platform as new_channel,
    attr.confidence_level,
    attr.attribution_method
  FROM actblue_transactions t
  CROSS JOIN LATERAL attribute_transaction(
    t.organization_id,
    t.refcode,
    t.transaction_date,
    t.click_id,
    t.fbclid
  ) attr
  WHERE t.organization_id = 'YOUR_ORG_ID'  -- Replace with actual org ID
    AND t.transaction_type = 'donation'
    AND t.transaction_date >= '2024-01-01'
)
SELECT
  old_channel,
  new_channel,
  COUNT(*) as transaction_count,
  SUM(amount) as total_revenue,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as pct
FROM comparison
GROUP BY old_channel, new_channel
ORDER BY transaction_count DESC;

-- ============================================================================
-- STEP 7: Revenue Recovery Analysis
-- How much revenue moved from "other/unattributed" to a known channel
-- ============================================================================
WITH comparison AS (
  SELECT
    t.amount,
    CASE
      WHEN t.click_id IS NOT NULL OR t.fbclid IS NOT NULL THEN 'meta'
      WHEN LOWER(t.refcode) LIKE 'txt%' OR LOWER(t.refcode) LIKE 'sms%' THEN 'sms'
      WHEN LOWER(t.refcode) LIKE 'em%' OR LOWER(t.refcode) LIKE 'email%' THEN 'email'
      WHEN t.refcode IS NOT NULL AND t.refcode != '' THEN 'other'
      ELSE 'unattributed'
    END as old_channel,
    attr.platform as new_channel
  FROM actblue_transactions t
  CROSS JOIN LATERAL attribute_transaction(
    t.organization_id,
    t.refcode,
    t.transaction_date,
    t.click_id,
    t.fbclid
  ) attr
  WHERE t.organization_id = 'YOUR_ORG_ID'  -- Replace with actual org ID
    AND t.transaction_type = 'donation'
    AND t.transaction_date >= '2024-01-01'
)
SELECT
  'RECOVERED FROM OTHER TO META' as metric,
  COUNT(*) as transactions,
  SUM(amount) as revenue
FROM comparison
WHERE old_channel = 'other' AND new_channel = 'meta'

UNION ALL

SELECT
  'RECOVERED FROM OTHER TO SMS' as metric,
  COUNT(*) as transactions,
  SUM(amount) as revenue
FROM comparison
WHERE old_channel = 'other' AND new_channel = 'sms'

UNION ALL

SELECT
  'RECOVERED FROM OTHER TO EMAIL' as metric,
  COUNT(*) as transactions,
  SUM(amount) as revenue
FROM comparison
WHERE old_channel = 'other' AND new_channel = 'email'

UNION ALL

SELECT
  'TOTAL RECOVERED FROM OTHER' as metric,
  COUNT(*) as transactions,
  SUM(amount) as revenue
FROM comparison
WHERE old_channel = 'other' AND new_channel IN ('meta', 'sms', 'email');

-- ============================================================================
-- STEP 8: Meta Ads Reconciliation
-- Compare Meta-reported revenue vs attributed revenue
-- ============================================================================
WITH meta_reported AS (
  SELECT
    SUM(conversion_value) as platform_revenue,
    SUM(spend) as total_spend
  FROM meta_ad_metrics
  WHERE organization_id = 'YOUR_ORG_ID'  -- Replace with actual org ID
    AND date >= '2024-01-01'
),
attributed AS (
  SELECT
    SUM(t.amount) as attributed_revenue
  FROM actblue_transactions t
  CROSS JOIN LATERAL attribute_transaction(
    t.organization_id,
    t.refcode,
    t.transaction_date,
    t.click_id,
    t.fbclid
  ) attr
  WHERE t.organization_id = 'YOUR_ORG_ID'  -- Replace with actual org ID
    AND t.transaction_type = 'donation'
    AND t.transaction_date >= '2024-01-01'
    AND attr.platform = 'meta'
)
SELECT
  m.platform_revenue as "Meta Reported Revenue",
  a.attributed_revenue as "First-Party Attributed Revenue",
  m.platform_revenue - a.attributed_revenue as "Attribution Gap",
  ROUND(100.0 * a.attributed_revenue / NULLIF(m.platform_revenue, 0), 2) as "Reconciliation Rate %",
  m.total_spend as "Total Meta Spend",
  ROUND(a.attributed_revenue / NULLIF(m.total_spend, 0), 2) as "Attributed ROAS"
FROM meta_reported m, attributed a;
