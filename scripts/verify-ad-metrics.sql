-- =====================================================
-- Ad-Level Metrics Verification Queries
-- Run these after deploying to verify data integrity
-- =====================================================

-- 1. Check if meta_ad_metrics_daily table exists and has data
SELECT
  'meta_ad_metrics_daily row count' as check_name,
  COUNT(*) as value
FROM meta_ad_metrics_daily;

-- 2. Get summary by organization
SELECT
  co.name as organization_name,
  mad.organization_id,
  COUNT(DISTINCT mad.ad_id) as unique_ads,
  COUNT(*) as total_records,
  MIN(mad.date) as earliest_date,
  MAX(mad.date) as latest_date,
  SUM(mad.spend) as total_spend,
  SUM(mad.impressions) as total_impressions,
  SUM(mad.clicks) as total_clicks
FROM meta_ad_metrics_daily mad
JOIN client_organizations co ON co.id = mad.organization_id
GROUP BY mad.organization_id, co.name
ORDER BY total_spend DESC;

-- 3. Verify ad_ids are populated (should be 100%)
SELECT
  'Ad ID population rate' as check_name,
  ROUND(
    COUNT(CASE WHEN ad_id IS NOT NULL AND ad_id != '' THEN 1 END)::numeric /
    NULLIF(COUNT(*)::numeric, 0) * 100, 2
  ) as percentage
FROM meta_ad_metrics_daily;

-- 4. Verify spend totals match between tables (for comparison period)
-- Replace dates with your test range
WITH date_range AS (
  SELECT '2024-12-01'::date as start_date, '2024-12-31'::date as end_date
),
daily_totals AS (
  SELECT
    organization_id,
    SUM(spend) as daily_spend
  FROM meta_ad_metrics_daily, date_range
  WHERE date >= date_range.start_date AND date <= date_range.end_date
  GROUP BY organization_id
),
campaign_totals AS (
  SELECT
    organization_id,
    SUM(spend) as campaign_spend
  FROM meta_ad_metrics, date_range
  WHERE date >= date_range.start_date AND date <= date_range.end_date
  GROUP BY organization_id
)
SELECT
  COALESCE(d.organization_id, c.organization_id) as organization_id,
  d.daily_spend as ad_level_spend,
  c.campaign_spend as campaign_level_spend,
  ROUND(
    ABS(COALESCE(d.daily_spend, 0) - COALESCE(c.campaign_spend, 0))::numeric, 2
  ) as difference,
  CASE
    WHEN COALESCE(c.campaign_spend, 0) = 0 THEN 'N/A'
    ELSE ROUND(
      (1 - COALESCE(d.daily_spend, 0) / NULLIF(c.campaign_spend, 0)) * 100, 2
    )::text || '%'
  END as variance_pct
FROM daily_totals d
FULL OUTER JOIN campaign_totals c ON d.organization_id = c.organization_id;

-- 5. Check for ads with spend but missing in meta_creative_insights
SELECT
  mad.ad_id,
  mad.campaign_id,
  mad.ad_name,
  SUM(mad.spend) as total_spend,
  CASE WHEN mci.ad_id IS NULL THEN 'MISSING' ELSE 'OK' END as creative_status
FROM meta_ad_metrics_daily mad
LEFT JOIN meta_creative_insights mci ON mad.ad_id = mci.ad_id
GROUP BY mad.ad_id, mad.campaign_id, mad.ad_name, mci.ad_id
HAVING SUM(mad.spend) > 0
ORDER BY creative_status DESC, total_spend DESC
LIMIT 50;

-- 6. Sample of recent ad-level records
SELECT
  date,
  ad_id,
  ad_name,
  campaign_id,
  spend,
  impressions,
  clicks,
  meta_roas,
  quality_ranking
FROM meta_ad_metrics_daily
WHERE spend > 0
ORDER BY date DESC, spend DESC
LIMIT 20;

-- 7. Data freshness check
SELECT
  organization_id,
  MAX(date) as most_recent_date,
  CURRENT_DATE - MAX(date) as days_behind,
  MAX(synced_at) as last_sync
FROM meta_ad_metrics_daily
GROUP BY organization_id;

-- 8. Compare ad counts between tables
SELECT
  'meta_ad_metrics_daily' as table_name,
  COUNT(DISTINCT ad_id) as unique_ad_ids
FROM meta_ad_metrics_daily
WHERE ad_id IS NOT NULL AND ad_id != ''
UNION ALL
SELECT
  'meta_creative_insights' as table_name,
  COUNT(DISTINCT ad_id) as unique_ad_ids
FROM meta_creative_insights
WHERE ad_id IS NOT NULL AND ad_id != '';

-- =====================================================
-- DATE RANGE DIAGNOSTICS (for debugging "No Data" issues)
-- =====================================================

-- 9. Check all available date ranges per organization
SELECT
  'Date ranges per organization' as check_name,
  organization_id,
  MIN(date) as earliest_date,
  MAX(date) as latest_date,
  COUNT(DISTINCT date) as days_with_data
FROM meta_ad_metrics
GROUP BY organization_id
ORDER BY latest_date DESC;

-- 10. For a specific org, check what dates have data
-- Replace 'YOUR_ORG_ID' with actual organization ID
-- SELECT
--   date,
--   COUNT(*) as records,
--   SUM(spend) as total_spend
-- FROM meta_ad_metrics
-- WHERE organization_id = 'YOUR_ORG_ID'
-- GROUP BY date
-- ORDER BY date DESC
-- LIMIT 30;

-- 11. Check meta_creative_insights campaign coverage
SELECT
  'Creatives per organization' as check_name,
  organization_id,
  COUNT(*) as total_creatives,
  COUNT(DISTINCT campaign_id) as unique_campaigns,
  COUNT(DISTINCT ad_id) as unique_ads
FROM meta_creative_insights
GROUP BY organization_id;

-- 12. Identify campaigns with metrics but no creatives (potential join miss)
WITH campaigns_with_metrics AS (
  SELECT DISTINCT organization_id, campaign_id
  FROM meta_ad_metrics
  WHERE campaign_id IS NOT NULL
),
campaigns_with_creatives AS (
  SELECT DISTINCT organization_id, campaign_id
  FROM meta_creative_insights
  WHERE campaign_id IS NOT NULL
)
SELECT
  cwm.organization_id,
  COUNT(DISTINCT cwm.campaign_id) as campaigns_with_metrics,
  COUNT(DISTINCT cwc.campaign_id) as campaigns_with_creatives,
  COUNT(DISTINCT CASE WHEN cwc.campaign_id IS NULL THEN cwm.campaign_id END) as campaigns_missing_creatives
FROM campaigns_with_metrics cwm
LEFT JOIN campaigns_with_creatives cwc
  ON cwm.organization_id = cwc.organization_id
  AND cwm.campaign_id = cwc.campaign_id
GROUP BY cwm.organization_id;

-- 13. Debug query: Show exactly what the hook would find for a given date range
-- Replace ORG_ID, START_DATE, END_DATE with actual values
-- Example: '2025-12-14' to '2026-01-13' for "Last 30 days"
/*
WITH params AS (
  SELECT
    'YOUR_ORG_ID'::uuid as org_id,
    '2025-12-14'::date as start_date,
    '2026-01-13'::date as end_date
)
SELECT
  'meta_ad_metrics_daily' as source,
  (SELECT COUNT(*) FROM meta_ad_metrics_daily m, params p
   WHERE m.organization_id = p.org_id AND m.date >= p.start_date AND m.date <= p.end_date) as row_count,
  (SELECT SUM(spend) FROM meta_ad_metrics_daily m, params p
   WHERE m.organization_id = p.org_id AND m.date >= p.start_date AND m.date <= p.end_date) as total_spend
UNION ALL
SELECT
  'meta_ad_metrics (fallback)' as source,
  (SELECT COUNT(*) FROM meta_ad_metrics m, params p
   WHERE m.organization_id = p.org_id AND m.date >= p.start_date AND m.date <= p.end_date) as row_count,
  (SELECT SUM(spend) FROM meta_ad_metrics m, params p
   WHERE m.organization_id = p.org_id AND m.date >= p.start_date AND m.date <= p.end_date) as total_spend
UNION ALL
SELECT
  'meta_creative_insights' as source,
  (SELECT COUNT(*) FROM meta_creative_insights m, params p
   WHERE m.organization_id = p.org_id) as row_count,
  NULL as total_spend;
*/
