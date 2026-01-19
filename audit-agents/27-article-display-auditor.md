# Article Display Auditor

**Agent ID:** 27
**Role:** UX / Data Analyst
**Focus:** Audit the article display capability for trends
**Priority:** HIGH
**Estimated Time:** 1 hour

---

## Overview

The user wants trends to show news articles when clicked, similar to Twitter/X. This agent audits:

1. Do we have article URLs for trending topics?
2. Is article metadata complete (title, source, date)?
3. Can we display 5-10 relevant articles per trend?
4. Is source tier information available for badges?

---

## Twitter/X Article Display Reference

When you click a trending topic on Twitter/X, you see:
1. **Representative content** at top (pinned tweet)
2. **Related tweets** sorted by engagement
3. **News articles** from verified sources
4. Each item is **clickable** to expand/read

Our equivalent should show:
1. **Featured article** at top (highest tier source)
2. **Article list** sorted by tier and recency
3. **Social mentions** as secondary section
4. Each article **clickable** to open in new tab

---

## Audit Queries

### Query 1: Article URL Coverage

```sql
-- Check what % of evidence has clickable URLs
SELECT
  source_type,
  COUNT(*) as total_evidence,
  COUNT(source_url) FILTER (WHERE source_url IS NOT NULL) as with_url,
  COUNT(source_url) FILTER (WHERE source_url IS NOT NULL AND source_url != '') as with_valid_url,
  ROUND(100.0 * COUNT(source_url) FILTER (WHERE source_url IS NOT NULL) / NULLIF(COUNT(*), 0), 1) as url_coverage_pct
FROM trend_evidence
WHERE discovered_at > NOW() - INTERVAL '24 hours'
GROUP BY source_type
ORDER BY total_evidence DESC;
```

**Expected:**
- RSS: >95% URL coverage
- Google News: >95% URL coverage
- Bluesky: >80% URL coverage (some may be unavailable)

---

### Query 2: Per-Trend Article Availability

```sql
-- Check if each trending topic has enough articles
SELECT
  te.event_title,
  te.confidence_score,
  COUNT(tev.id) as total_evidence,
  COUNT(tev.source_url) FILTER (WHERE tev.source_url IS NOT NULL) as articles_with_url,
  COUNT(DISTINCT tev.source_domain) as unique_sources,
  CASE
    WHEN COUNT(tev.source_url) FILTER (WHERE tev.source_url IS NOT NULL) >= 5 THEN '✅ GOOD (5+ articles)'
    WHEN COUNT(tev.source_url) FILTER (WHERE tev.source_url IS NOT NULL) >= 3 THEN '⚠️ OK (3-4 articles)'
    WHEN COUNT(tev.source_url) FILTER (WHERE tev.source_url IS NOT NULL) >= 1 THEN '⚠️ LOW (1-2 articles)'
    ELSE '❌ NONE'
  END as article_status
FROM trend_events te
LEFT JOIN trend_evidence tev ON tev.trend_event_id = te.id
WHERE te.is_trending = true
  AND te.last_seen_at > NOW() - INTERVAL '24 hours'
GROUP BY te.id, te.event_title, te.confidence_score
ORDER BY te.confidence_score DESC
LIMIT 30;
```

**Expected:** Most high-confidence trends should have 5+ articles

---

### Query 3: Article Metadata Completeness

```sql
-- Check if article metadata is complete
SELECT
  COUNT(*) as total,
  COUNT(headline) FILTER (WHERE headline IS NOT NULL AND headline != '') as has_headline,
  COUNT(source_domain) FILTER (WHERE source_domain IS NOT NULL) as has_domain,
  COUNT(source_url) FILTER (WHERE source_url IS NOT NULL) as has_url,
  COUNT(published_at) FILTER (WHERE published_at IS NOT NULL) as has_date,
  COUNT(source_tier) FILTER (WHERE source_tier IS NOT NULL) as has_tier,
  COUNT(sentiment_label) FILTER (WHERE sentiment_label IS NOT NULL) as has_sentiment,
  -- Completeness score
  ROUND(100.0 * (
    COUNT(headline) FILTER (WHERE headline IS NOT NULL) +
    COUNT(source_url) FILTER (WHERE source_url IS NOT NULL) +
    COUNT(published_at) FILTER (WHERE published_at IS NOT NULL)
  ) / (COUNT(*) * 3.0), 1) as completeness_pct
FROM trend_evidence
WHERE discovered_at > NOW() - INTERVAL '24 hours'
  AND source_type IN ('rss', 'google_news');
```

**Expected:** Completeness > 90%

---

### Query 4: Source Tier Distribution

```sql
-- Check tier distribution for article quality indicators
SELECT
  COALESCE(source_tier, 'unclassified') as tier,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as percentage,
  array_agg(DISTINCT source_domain ORDER BY source_domain) FILTER (WHERE source_domain IS NOT NULL) as example_sources
FROM trend_evidence
WHERE discovered_at > NOW() - INTERVAL '24 hours'
  AND source_type IN ('rss', 'google_news')
GROUP BY 1
ORDER BY count DESC;
```

**Expected Distribution:**
- Tier 1: 20-40% (high authority)
- Tier 2: 30-50% (national news)
- Tier 3: 20-30% (issue specialists)
- Unclassified: <10%

---

### Query 5: Featured Article Selection

```sql
-- For each trend, what would be the "featured" article?
SELECT
  te.event_title,
  te.confidence_score,
  -- Best article (tier1 first, then recency)
  (
    SELECT jsonb_build_object(
      'headline', tev.headline,
      'source', tev.source_domain,
      'url', tev.source_url,
      'tier', tev.source_tier,
      'published', tev.published_at
    )
    FROM trend_evidence tev
    WHERE tev.trend_event_id = te.id
      AND tev.source_url IS NOT NULL
      AND tev.headline IS NOT NULL
    ORDER BY
      CASE tev.source_tier
        WHEN 'tier1' THEN 1
        WHEN 'tier2' THEN 2
        WHEN 'tier3' THEN 3
        ELSE 4
      END,
      tev.published_at DESC
    LIMIT 1
  ) as featured_article
FROM trend_events te
WHERE te.is_trending = true
  AND te.last_seen_at > NOW() - INTERVAL '24 hours'
ORDER BY te.confidence_score DESC
LIMIT 15;
```

---

### Query 6: Article List for Drill-Down

```sql
-- Sample the articles that would show in drill-down for top trends
WITH top_trends AS (
  SELECT id, event_title, confidence_score
  FROM trend_events
  WHERE is_trending = true
    AND last_seen_at > NOW() - INTERVAL '24 hours'
  ORDER BY confidence_score DESC
  LIMIT 5
)
SELECT
  tt.event_title,
  jsonb_agg(
    jsonb_build_object(
      'headline', tev.headline,
      'source', tev.source_domain,
      'url', tev.source_url,
      'tier', tev.source_tier,
      'published', tev.published_at,
      'sentiment', tev.sentiment_label
    )
    ORDER BY
      CASE tev.source_tier WHEN 'tier1' THEN 1 WHEN 'tier2' THEN 2 ELSE 3 END,
      tev.published_at DESC
  ) FILTER (WHERE tev.source_url IS NOT NULL) as articles
FROM top_trends tt
LEFT JOIN trend_evidence tev ON tev.trend_event_id = tt.id
GROUP BY tt.id, tt.event_title, tt.confidence_score
ORDER BY tt.confidence_score DESC;
```

---

### Query 7: URL Validity Check

```sql
-- Check for malformed or invalid URLs
SELECT
  source_url,
  source_domain,
  CASE
    WHEN source_url IS NULL THEN 'NULL'
    WHEN source_url = '' THEN 'EMPTY'
    WHEN source_url NOT LIKE 'http%' THEN 'INVALID PROTOCOL'
    WHEN source_url LIKE '%localhost%' THEN 'LOCALHOST'
    WHEN LENGTH(source_url) < 20 THEN 'TOO SHORT'
    ELSE 'VALID'
  END as url_status
FROM trend_evidence
WHERE discovered_at > NOW() - INTERVAL '24 hours'
  AND source_type IN ('rss', 'google_news')
  AND (
    source_url IS NULL
    OR source_url = ''
    OR source_url NOT LIKE 'http%'
    OR LENGTH(source_url) < 20
  )
LIMIT 50;
```

**Expected:** 0 invalid URLs

---

### Query 8: Social Mentions Availability

```sql
-- Check Bluesky post availability for secondary section
SELECT
  te.event_title,
  COUNT(tev.id) FILTER (WHERE tev.source_type = 'bluesky') as bluesky_count,
  COUNT(tev.source_url) FILTER (WHERE tev.source_type = 'bluesky' AND tev.source_url IS NOT NULL) as bluesky_with_url
FROM trend_events te
LEFT JOIN trend_evidence tev ON tev.trend_event_id = te.id
WHERE te.is_trending = true
  AND te.last_seen_at > NOW() - INTERVAL '24 hours'
GROUP BY te.id, te.event_title
HAVING COUNT(tev.id) FILTER (WHERE tev.source_type = 'bluesky') > 0
ORDER BY bluesky_count DESC
LIMIT 20;
```

---

## Data Requirements for Article Display

### Required Fields:

| Field | Purpose | Status |
|-------|---------|--------|
| `headline` | Article title display | Check coverage |
| `source_url` | Click-through link | Check coverage |
| `source_domain` | Source name display | Check coverage |
| `published_at` | "2 hours ago" display | Check coverage |
| `source_tier` | Quality badge | Check coverage |
| `sentiment_label` | Sentiment indicator | Optional |

### UI Component Requirements:

```tsx
interface ArticleDisplayProps {
  headline: string;        // Required
  sourceUrl: string;       // Required - clickable link
  sourceDomain: string;    // Required - e.g., "New York Times"
  publishedAt: Date;       // Required - for relative time
  sourceTier?: 'tier1' | 'tier2' | 'tier3'; // Optional - for badge
  sentiment?: 'positive' | 'neutral' | 'negative'; // Optional
  thumbnail?: string;      // Nice to have
}
```

---

## Implementation Checklist

### Database Requirements:
- [ ] `trend_evidence.source_url` populated for >90% of news
- [ ] `trend_evidence.headline` populated for >90%
- [ ] `trend_evidence.source_domain` populated for >95%
- [ ] `trend_evidence.published_at` populated for >95%
- [ ] `trend_evidence.source_tier` populated for >80%

### UI Requirements:
- [ ] ArticleList component created
- [ ] FeaturedArticle component created
- [ ] Click opens URL in new tab
- [ ] Source tier badge displays
- [ ] Relative time displays ("2 hours ago")

### API Requirements:
- [ ] Evidence query returns articles sorted by tier
- [ ] Evidence query includes all required fields
- [ ] Pagination for large article lists

---

## Sample Article Card Design

```
┌─────────────────────────────────────────────────────────┐
│ 🏆 TIER 1                                    2 hours ago │
│                                                          │
│ Trump Fires FBI Director Christopher Wray                │
│ The New York Times                                       │
│                                                          │
│ [Click to read →]                                        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ TIER 2                                       4 hours ago │
│                                                          │
│ Wray Departure Signals Major Shift at FBI                │
│ Washington Post                                          │
│                                                          │
│ [Click to read →]                                        │
└─────────────────────────────────────────────────────────┘
```

---

## Verification Checklist

- [ ] >90% of news evidence has valid URLs
- [ ] Each trending topic has 3+ articles available
- [ ] Metadata completeness >90%
- [ ] Tier 1 sources available for most trends
- [ ] URLs are valid and clickable
- [ ] Featured article selection works
- [ ] Bluesky mentions available as secondary

---

## Next Steps

After completing this audit:
1. If data is sufficient → Implement ArticleList UI component
2. If data gaps exist → Fix evidence collection first
3. Create Agent 28-30 for implementation phase
