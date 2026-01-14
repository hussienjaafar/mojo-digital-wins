-- =============================================================================
-- AD PERFORMANCE DATA VERIFICATION SCRIPT
-- =============================================================================
-- Run this script against your Supabase database to diagnose ad-level metrics
-- and attribution issues.
--
-- Usage: Replace <ORG_ID>, <START_DATE>, and <END_DATE> with actual values
-- Example: <ORG_ID> = 'abc123-def456-...'
--          <START_DATE> = '2025-12-01'
--          <END_DATE> = '2025-12-31'
-- =============================================================================

-- Set your parameters here:
-- \set org_id 'your-org-id-here'
-- \set start_date '2025-12-01'
-- \set end_date '2025-12-31'

-- =============================================================================
-- STEP 1: Check if meta_ad_metrics_daily table exists and has data
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'meta_ad_metrics_daily'
  ) THEN
    RAISE NOTICE 'ERROR: meta_ad_metrics_daily table does not exist!';
    RAISE NOTICE 'ACTION: Apply migration 20260113000001_ad_level_metrics_daily.sql';
  ELSE
    RAISE NOTICE 'OK: meta_ad_metrics_daily table exists';
  END IF;
END $$;

-- Count rows in meta_ad_metrics_daily for all orgs
SELECT
  'meta_ad_metrics_daily row counts by org' as check_name,
  organization_id,
  COUNT(*) as total_rows,
  COUNT(DISTINCT ad_id) as distinct_ads,
  COUNT(*) FILTER (WHERE ad_id IS NULL) as null_ad_id_rows,
  MIN(date) as earliest_date,
  MAX(date) as latest_date,
  SUM(spend) as total_spend
FROM meta_ad_metrics_daily
GROUP BY organization_id
ORDER BY total_rows DESC;

-- =============================================================================
-- STEP 2: Check meta_creative_insights for ad_id population
-- =============================================================================
SELECT
  'meta_creative_insights ad_id population' as check_name,
  organization_id,
  COUNT(*) as total_creatives,
  COUNT(ad_id) as has_ad_id,
  COUNT(*) FILTER (WHERE ad_id IS NULL) as missing_ad_id,
  COUNT(extracted_refcode) as has_refcode,
  ROUND(100.0 * COUNT(ad_id) / NULLIF(COUNT(*), 0), 1) as ad_id_percent
FROM meta_creative_insights
GROUP BY organization_id
ORDER BY total_creatives DESC;

-- =============================================================================
-- STEP 3: Check refcode_mappings for ad_id population
-- =============================================================================
SELECT
  'refcode_mappings ad_id population' as check_name,
  organization_id,
  COUNT(*) as total_mappings,
  COUNT(ad_id) as has_ad_id,
  COUNT(creative_id) as has_creative_id,
  COUNT(campaign_id) as has_campaign_id,
  ROUND(100.0 * COUNT(ad_id) / NULLIF(COUNT(*), 0), 1) as ad_id_percent
FROM refcode_mappings
GROUP BY organization_id
ORDER BY total_mappings DESC;

-- =============================================================================
-- STEP 4: Check donation attribution coverage
-- =============================================================================
SELECT
  'donation_attribution coverage' as check_name,
  organization_id,
  COUNT(*) as total_donations,
  COUNT(attributed_ad_id) as attributed_to_ad,
  COUNT(attributed_creative_id) as attributed_to_creative,
  COUNT(attributed_campaign_id) as attributed_to_campaign,
  COUNT(refcode) as has_refcode,
  ROUND(100.0 * COUNT(attributed_ad_id) / NULLIF(COUNT(*), 0), 1) as ad_attribution_percent,
  SUM(net_amount) as total_raised,
  SUM(net_amount) FILTER (WHERE attributed_ad_id IS NOT NULL) as raised_attributed_to_ad
FROM donation_attribution
WHERE transaction_type = 'donation'
GROUP BY organization_id
ORDER BY total_donations DESC;

-- =============================================================================
-- STEP 5: Check for duplicate ad_id in meta_ad_metrics_daily (same date)
-- This would indicate data quality issues
-- =============================================================================
SELECT
  'duplicate check - meta_ad_metrics_daily' as check_name,
  organization_id,
  date,
  ad_id,
  COUNT(*) as duplicate_count
FROM meta_ad_metrics_daily
GROUP BY organization_id, date, ad_id
HAVING COUNT(*) > 1
LIMIT 20;

-- =============================================================================
-- STEP 6: Compare spend between meta_ad_metrics_daily and meta_ad_metrics
-- This helps identify if ad-level data matches campaign-level totals
-- =============================================================================
WITH daily_spend AS (
  SELECT
    organization_id,
    SUM(spend) as daily_total_spend
  FROM meta_ad_metrics_daily
  GROUP BY organization_id
),
campaign_spend AS (
  SELECT
    organization_id,
    SUM(spend) as campaign_total_spend
  FROM meta_ad_metrics
  GROUP BY organization_id
)
SELECT
  'spend comparison: daily vs campaign' as check_name,
  COALESCE(d.organization_id, c.organization_id) as organization_id,
  d.daily_total_spend,
  c.campaign_total_spend,
  CASE
    WHEN d.daily_total_spend IS NULL THEN 'NO DAILY DATA'
    WHEN c.campaign_total_spend IS NULL THEN 'NO CAMPAIGN DATA'
    WHEN ABS(d.daily_total_spend - c.campaign_total_spend) < 1 THEN 'MATCH'
    ELSE 'MISMATCH: ' || ROUND(d.daily_total_spend - c.campaign_total_spend, 2)::text
  END as status
FROM daily_spend d
FULL OUTER JOIN campaign_spend c ON d.organization_id = c.organization_id;

-- =============================================================================
-- STEP 7: Sample of meta_ad_metrics_daily data for inspection
-- =============================================================================
SELECT
  'sample meta_ad_metrics_daily rows' as check_name,
  organization_id,
  date,
  ad_id,
  ad_name,
  campaign_id,
  creative_id,
  spend,
  impressions,
  clicks,
  ctr,
  meta_roas
FROM meta_ad_metrics_daily
ORDER BY date DESC, spend DESC
LIMIT 20;

-- =============================================================================
-- STEP 8: Check ActBlue transactions for refcode population
-- =============================================================================
SELECT
  'actblue_transactions refcode population' as check_name,
  organization_id,
  COUNT(*) as total_transactions,
  COUNT(refcode) as has_refcode,
  COUNT(refcode2) as has_refcode2,
  COUNT(click_id) as has_click_id,
  COUNT(fbclid) as has_fbclid,
  ROUND(100.0 * COUNT(refcode) / NULLIF(COUNT(*), 0), 1) as refcode_percent
FROM actblue_transactions
WHERE transaction_type = 'donation'
GROUP BY organization_id
ORDER BY total_transactions DESC;

-- =============================================================================
-- STEP 9: Check if refcodes in ActBlue match refcodes in refcode_mappings
-- =============================================================================
WITH actblue_refcodes AS (
  SELECT DISTINCT organization_id, refcode
  FROM actblue_transactions
  WHERE refcode IS NOT NULL AND refcode != ''
),
mapping_refcodes AS (
  SELECT DISTINCT organization_id, refcode
  FROM refcode_mappings
  WHERE refcode IS NOT NULL
)
SELECT
  'refcode match analysis' as check_name,
  a.organization_id,
  COUNT(DISTINCT a.refcode) as actblue_unique_refcodes,
  COUNT(DISTINCT m.refcode) as mapped_unique_refcodes,
  COUNT(DISTINCT a.refcode) FILTER (WHERE m.refcode IS NOT NULL) as matched_refcodes,
  ROUND(100.0 * COUNT(DISTINCT a.refcode) FILTER (WHERE m.refcode IS NOT NULL) /
    NULLIF(COUNT(DISTINCT a.refcode), 0), 1) as match_percent
FROM actblue_refcodes a
LEFT JOIN mapping_refcodes m ON a.organization_id = m.organization_id AND a.refcode = m.refcode
GROUP BY a.organization_id;

-- =============================================================================
-- STEP 10: Summary diagnosis
-- =============================================================================
SELECT 'SUMMARY' as check_name, 'Run refcode-reconcile if ad_id is missing from refcode_mappings' as action
UNION ALL
SELECT 'SUMMARY', 'Run sync-meta-ads to populate meta_ad_metrics_daily'
UNION ALL
SELECT 'SUMMARY', 'Ensure ActBlue webhook captures refcode from donation URLs';
