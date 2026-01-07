-- Phase B: Backfill source_tier for existing trend_evidence records
-- This populates source_tier based on source_domain matching against source_tiers table

-- First, update evidence from source_tiers canonical table
UPDATE public.trend_evidence te
SET source_tier = st.tier
FROM public.source_tiers st
WHERE te.source_tier IS NULL
  AND te.source_domain = st.domain
  AND te.created_at > NOW() - INTERVAL '30 days';

-- For Bluesky sources (post_uri format), set to tier3
UPDATE public.trend_evidence
SET source_tier = 'tier3'
WHERE source_tier IS NULL
  AND (source_type = 'bluesky' OR source_url LIKE 'at://%')
  AND created_at > NOW() - INTERVAL '30 days';

-- For remaining RSS/article sources, try to match via rss_sources
-- Extract domain and match to rss_sources tier, normalizing tier values
WITH rss_tiers AS (
  SELECT 
    CASE 
      WHEN url LIKE 'https://%' THEN SPLIT_PART(SPLIT_PART(url, '://', 2), '/', 1)
      WHEN url LIKE 'http://%' THEN SPLIT_PART(SPLIT_PART(url, '://', 2), '/', 1)
      ELSE url
    END AS domain,
    CASE 
      WHEN tier = 'tier1' THEN 'tier1'
      WHEN tier IN ('tier2', 'national', 'specialized') THEN 'tier2'
      ELSE 'tier3'
    END AS normalized_tier
  FROM public.rss_sources
  WHERE tier IS NOT NULL
)
UPDATE public.trend_evidence te
SET source_tier = rt.normalized_tier
FROM rss_tiers rt
WHERE te.source_tier IS NULL
  AND te.source_domain = rt.domain
  AND te.created_at > NOW() - INTERVAL '30 days';

-- Default remaining NULL to tier3 for recent evidence
UPDATE public.trend_evidence
SET source_tier = 'tier3'
WHERE source_tier IS NULL
  AND created_at > NOW() - INTERVAL '30 days';

-- Log the results
DO $$
DECLARE
  tier1_count INTEGER;
  tier2_count INTEGER;
  tier3_count INTEGER;
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO tier1_count FROM trend_evidence WHERE source_tier = 'tier1' AND created_at > NOW() - INTERVAL '30 days';
  SELECT COUNT(*) INTO tier2_count FROM trend_evidence WHERE source_tier = 'tier2' AND created_at > NOW() - INTERVAL '30 days';
  SELECT COUNT(*) INTO tier3_count FROM trend_evidence WHERE source_tier = 'tier3' AND created_at > NOW() - INTERVAL '30 days';
  SELECT COUNT(*) INTO null_count FROM trend_evidence WHERE source_tier IS NULL AND created_at > NOW() - INTERVAL '30 days';
  
  RAISE NOTICE 'Backfill complete: tier1=%, tier2=%, tier3=%, null=%', tier1_count, tier2_count, tier3_count, null_count;
END $$;