# Diagnose Multi-Source Rate Issue

**Problem:** Only 2.4% of trends have 3+ source_count (13 out of 552)

## Lovable Diagnostic Prompt

```
Run this diagnostic query to understand the multi-source rate issue:

1. Query trend_evidence and group by event_id to count unique domains per trend:

WITH event_domains AS (
  SELECT
    te.event_id,
    COUNT(DISTINCT te.source_domain) as domain_count,
    COUNT(*) as evidence_count,
    array_agg(DISTINCT te.source_type) as source_types,
    array_agg(DISTINCT te.source_domain) as domains
  FROM trend_evidence te
  JOIN trend_events evt ON evt.id = te.event_id
  WHERE evt.is_trending = true
  AND evt.last_seen_at > NOW() - INTERVAL '24 hours'
  GROUP BY te.event_id
)
SELECT
  domain_count,
  COUNT(*) as num_trends,
  ROUND(COUNT(*)::numeric / SUM(COUNT(*)) OVER () * 100, 1) as percentage
FROM event_domains
GROUP BY domain_count
ORDER BY domain_count;

2. Check what domains appear in the evidence:

SELECT
  source_domain,
  source_type,
  COUNT(*) as count
FROM trend_evidence te
JOIN trend_events evt ON evt.id = te.event_id
WHERE evt.is_trending = true
AND evt.last_seen_at > NOW() - INTERVAL '24 hours'
AND source_domain IS NOT NULL
GROUP BY source_domain, source_type
ORDER BY count DESC
LIMIT 30;

3. Check Google News articles for canonical_url vs url:

SELECT
  COUNT(*) as total,
  COUNT(canonical_url) as with_canonical,
  COUNT(*) FILTER (WHERE url LIKE '%news.google.com%') as google_urls
FROM google_news_articles
WHERE ai_processed = true
AND published_at > NOW() - INTERVAL '24 hours';

4. Sample Google News URLs to see if canonical_url is populated:

SELECT
  url,
  canonical_url,
  title
FROM google_news_articles
WHERE ai_processed = true
AND published_at > NOW() - INTERVAL '24 hours'
LIMIT 10;

Report findings including:
- Domain count distribution across trending events
- Top 20 domains by mention count
- Whether canonical_url is populated for Google News
- Any patterns that explain the low multi-source rate
```

## Root Causes Identified

1. **Bluesky mentions missing domain** (FIXED)
   - Bluesky posts were not setting `domain` field
   - Fix: Set `domain: 'bsky.app'` for all Bluesky mentions

2. **Google News using redirect URL** (FIXED)
   - Google News articles may have `news.google.com` as the URL
   - The actual source domain should come from `canonical_url`
   - Fix: Use `canonical_url || url` for domain extraction

3. **Data concentration** (Investigation needed)
   - If most articles come from the same few domains, source diversity will be low
   - This is a data diversity issue, not a code bug

## Fixes Applied (2026-01-19)

In `supabase/functions/detect-trend-events/index.ts`:

1. Line ~1358: Added `domain: 'bsky.app'` to Bluesky mentions
2. Line ~1297: Changed Google News domain extraction to use `canonical_url || url`
3. Line ~1380: Added debug logging for top domains after aggregation

## Verification

After deploying fixes, run the trend detection job again and check:
1. Run audit: `node --env-file=.env scripts/local-trend-audit.mjs`
2. Check logs for `[detect-trend-events] TOP DOMAINS:` to see domain distribution
3. Multi-source rate should improve from 2.4% toward 70% target

If multi-source rate is still low, the issue is data diversity - we need more articles from diverse sources covering the same topics.
