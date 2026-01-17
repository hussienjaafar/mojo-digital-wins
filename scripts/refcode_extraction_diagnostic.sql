-- ============================================================================
-- REFCODE EXTRACTION DIAGNOSTIC
-- Purpose: Identify why Meta ad refcodes aren't being matched deterministically
-- Organization: Michael Blake (a2b47f29-51ea-47da-b45e-f9f539c6811b)
-- ============================================================================

-- ============================================================================
-- STEP 1: Check what's in refcode_mappings for Michael Blake
-- This is where deterministic mappings should exist
-- ============================================================================
SELECT
  refcode,
  platform,
  ad_id,
  campaign_id,
  creative_id,
  created_at
FROM refcode_mappings
WHERE organization_id = 'a2b47f29-51ea-47da-b45e-f9f539c6811b'
ORDER BY created_at DESC
LIMIT 50;

-- ============================================================================
-- STEP 2: Check meta_creative_insights for extracted_refcode field
-- This is where the sync-meta-ads function stores extracted refcodes
-- ============================================================================
SELECT
  ad_id,
  ad_name,
  destination_url,
  extracted_refcode,
  created_at
FROM meta_creative_insights
WHERE organization_id = 'a2b47f29-51ea-47da-b45e-f9f539c6811b'
  AND (
    destination_url IS NOT NULL
    OR extracted_refcode IS NOT NULL
  )
ORDER BY created_at DESC
LIMIT 50;

-- ============================================================================
-- STEP 3: Check if destination_url contains recognizable refcodes
-- Look for URLs that SHOULD have refcodes extracted
-- ============================================================================
SELECT
  ad_id,
  ad_name,
  destination_url,
  extracted_refcode,
  -- Check if URL contains our missing refcode patterns
  CASE
    WHEN destination_url ILIKE '%gaza%' THEN 'HAS gaza'
    WHEN destination_url ILIKE '%img%' THEN 'HAS img'
    WHEN destination_url ILIKE '%spint%' THEN 'HAS spint'
    WHEN destination_url ILIKE '%intro%' THEN 'HAS intro'
    WHEN destination_url ILIKE '%wedeserve%' THEN 'HAS wedeserve'
    WHEN destination_url ILIKE '%social%' THEN 'HAS social'
    ELSE 'OTHER'
  END as url_pattern_check
FROM meta_creative_insights
WHERE organization_id = 'a2b47f29-51ea-47da-b45e-f9f539c6811b'
ORDER BY
  CASE
    WHEN destination_url ILIKE '%gaza%' OR destination_url ILIKE '%img%'
         OR destination_url ILIKE '%spint%' OR destination_url ILIKE '%intro%' THEN 0
    ELSE 1
  END,
  created_at DESC
LIMIT 100;

-- ============================================================================
-- STEP 4: Check ActBlue transactions with orphaned refcodes
-- These are the refcodes we need to match
-- ============================================================================
SELECT
  refcode,
  COUNT(*) as transaction_count,
  SUM(amount) as total_revenue,
  MIN(transaction_date) as first_seen,
  MAX(transaction_date) as last_seen
FROM actblue_transactions
WHERE organization_id = 'a2b47f29-51ea-47da-b45e-f9f539c6811b'
  AND transaction_type = 'donation'
  AND refcode IS NOT NULL
  AND LOWER(refcode) LIKE ANY(ARRAY['gaza%', 'img%', 'spint%', 'intro%', 'wedeserve%', 'social%'])
GROUP BY refcode
ORDER BY total_revenue DESC;

-- ============================================================================
-- STEP 5: Check meta_ads table for ad destination URLs
-- The raw ads data from Meta API
-- ============================================================================
SELECT
  id,
  name,
  creative_id,
  effective_status,
  created_time
FROM meta_ads
WHERE organization_id = 'a2b47f29-51ea-47da-b45e-f9f539c6811b'
ORDER BY created_time DESC
LIMIT 50;

-- ============================================================================
-- STEP 6: Check meta_campaigns for campaign names that match refcode patterns
-- Sometimes refcodes match campaign naming conventions
-- ============================================================================
SELECT
  campaign_id,
  name,
  status,
  created_time
FROM meta_campaigns
WHERE organization_id = 'a2b47f29-51ea-47da-b45e-f9f539c6811b'
  AND (
    name ILIKE '%gaza%'
    OR name ILIKE '%img%'
    OR name ILIKE '%spint%'
    OR name ILIKE '%intro%'
  )
ORDER BY created_time DESC;

-- ============================================================================
-- STEP 7: Check if there are ANY refcode_mappings at all
-- Verify the reconcile function has been running
-- ============================================================================
SELECT
  organization_id,
  COUNT(*) as mapping_count,
  COUNT(DISTINCT platform) as platforms,
  MIN(created_at) as oldest_mapping,
  MAX(created_at) as newest_mapping
FROM refcode_mappings
GROUP BY organization_id
ORDER BY mapping_count DESC;

-- ============================================================================
-- STEP 8: Check meta_creative_insights schema
-- Verify the extracted_refcode column exists
-- ============================================================================
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'meta_creative_insights'
  AND table_schema = 'public'
ORDER BY ordinal_position;

