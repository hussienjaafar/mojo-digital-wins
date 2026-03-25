# Source Integration Auditor

**Role:** Data Engineer / Integration Specialist
**Focus:** Data source health, API connectivity, source diversity
**Priority:** HIGH

---

## Overview

A world-class political intelligence platform requires diverse, reliable data sources. This auditor verifies that all configured data sources are connected, healthy, and providing quality data.

---

## Required Data Sources

### Tier 1: Critical (Must Have)
| Source | Type | Expected Volume | Freshness |
|--------|------|-----------------|-----------|
| Google News | API | 100+ articles/day | <5 min |
| RSS Feeds (Political) | RSS | 50+ articles/day | <15 min |

### Tier 2: Important (Should Have)
| Source | Type | Expected Volume | Freshness |
|--------|------|-----------------|-----------|
| Bluesky | API | 500+ posts/day | <10 min |
| Reddit (r/politics etc) | API | 200+ posts/day | <30 min |

### Tier 3: Supplementary (Nice to Have)
| Source | Type | Expected Volume | Freshness |
|--------|------|-----------------|-----------|
| Congress.gov | API | Varies | <6 hours |
| Executive Orders | RSS/API | Varies | <1 hour |
| Polling Data | API | Weekly | <24 hours |

---

## Audit Checklist

### 1. Source Inventory

```sql
-- What sources are currently active?
SELECT
  source_type,
  COUNT(*) as total_items,
  COUNT(DISTINCT source_domain) as unique_domains,
  MIN(discovered_at) as first_seen,
  MAX(discovered_at) as last_seen,
  NOW() - MAX(discovered_at) as staleness
FROM trend_evidence
GROUP BY source_type
ORDER BY total_items DESC;
```

**Expected Results:**
- [ ] At least 2 Tier 1 sources active
- [ ] All active sources have recent data
- [ ] Source diversity maintained

### 2. Source Health by Domain

```sql
-- Health of individual domains/feeds
SELECT
  source_type,
  source_domain,
  COUNT(*) as items_24h,
  MAX(discovered_at) as latest,
  NOW() - MAX(discovered_at) as staleness
FROM trend_evidence
WHERE discovered_at > NOW() - INTERVAL '24 hours'
GROUP BY source_type, source_domain
ORDER BY items_24h DESC
LIMIT 30;
```

**Expected Results:**
- [ ] Multiple domains per source type
- [ ] No single domain dominates (>50%)
- [ ] All domains have recent data

### 3. Google News API Health

```sql
-- Google News specific analysis
SELECT
  date_trunc('hour', discovered_at) as hour,
  COUNT(*) as articles,
  COUNT(DISTINCT source_domain) as domains
FROM trend_evidence
WHERE source_type = 'google_news'
AND discovered_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
```

**Check:**
- [ ] Consistent hourly volume
- [ ] No gaps >1 hour
- [ ] Domain diversity maintained

**API Health Indicators:**
- [ ] API key is valid
- [ ] Rate limits not exceeded
- [ ] Response quality good (titles, content present)

### 4. RSS Feed Health

```sql
-- RSS feed analysis
SELECT
  source_domain as feed_domain,
  COUNT(*) as items_24h,
  MAX(discovered_at) as latest,
  NOW() - MAX(discovered_at) as feed_staleness
FROM trend_evidence
WHERE source_type = 'rss'
AND discovered_at > NOW() - INTERVAL '24 hours'
GROUP BY source_domain
ORDER BY items_24h DESC;
```

**Check:**
- [ ] All configured feeds are active
- [ ] Feed URLs are accessible
- [ ] Feed parsing is working

### 5. Social Media Source Health

```sql
-- Bluesky analysis
SELECT
  date_trunc('hour', discovered_at) as hour,
  COUNT(*) as posts,
  COUNT(DISTINCT content_hash) as unique_posts
FROM trend_evidence
WHERE source_type = 'bluesky'
AND discovered_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;

-- Reddit analysis (if applicable)
SELECT
  source_domain as subreddit,
  COUNT(*) as posts_24h,
  MAX(discovered_at) as latest
FROM trend_evidence
WHERE source_type = 'reddit'
AND discovered_at > NOW() - INTERVAL '24 hours'
GROUP BY source_domain
ORDER BY posts_24h DESC;
```

**Check:**
- [ ] Social sources are connected
- [ ] Volume is reasonable
- [ ] No authentication issues

### 6. Government Data Sources

```sql
-- Congress.gov and executive orders
SELECT
  source_type,
  COUNT(*) as items_7d,
  MAX(discovered_at) as latest
FROM trend_evidence
WHERE source_type IN ('congress_gov', 'executive_orders', 'federal_register')
AND discovered_at > NOW() - INTERVAL '7 days'
GROUP BY source_type;
```

**Check:**
- [ ] Government sources connected (if configured)
- [ ] Bill data flowing
- [ ] Executive orders captured

### 7. Source Content Quality

```sql
-- Content quality analysis
SELECT
  source_type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE source_title IS NOT NULL AND source_title != '') as has_title,
  COUNT(*) FILTER (WHERE source_url IS NOT NULL) as has_url,
  COUNT(*) FILTER (WHERE content_hash IS NOT NULL) as has_content_hash,
  ROUND(100.0 * COUNT(*) FILTER (WHERE source_title IS NOT NULL) / COUNT(*), 1) as title_rate
FROM trend_evidence
WHERE discovered_at > NOW() - INTERVAL '24 hours'
GROUP BY source_type;
```

**Expected Results:**
- [ ] Title rate >95% for all sources
- [ ] URL rate = 100%
- [ ] Content hash rate >90%

### 8. Source Diversity Score

```sql
-- Calculate source diversity (Shannon entropy proxy)
WITH source_counts AS (
  SELECT
    source_type,
    COUNT(*) as count,
    SUM(COUNT(*)) OVER () as total
  FROM trend_evidence
  WHERE discovered_at > NOW() - INTERVAL '24 hours'
  GROUP BY source_type
)
SELECT
  source_type,
  count,
  ROUND(100.0 * count / total, 1) as percentage,
  CASE
    WHEN 100.0 * count / total > 70 THEN 'DOMINANT'
    WHEN 100.0 * count / total > 40 THEN 'HIGH'
    WHEN 100.0 * count / total > 20 THEN 'MODERATE'
    ELSE 'LOW'
  END as concentration
FROM source_counts
ORDER BY count DESC;
```

**Target:**
- No single source >50% of volume
- At least 3 active source types
- Social + News + Government diversity

---

## Source Configuration Verification

### RSS Feed Configuration

```sql
-- Check configured RSS feeds
SELECT
  id,
  feed_url,
  feed_name,
  is_active,
  last_fetched_at,
  fetch_error_count
FROM rss_feed_sources
WHERE is_active = true
ORDER BY last_fetched_at DESC;
```

### API Credentials Check

**Required Environment Variables:**
- [ ] GOOGLE_NEWS_API_KEY - set and valid
- [ ] BLUESKY_USERNAME - set (if using Bluesky)
- [ ] BLUESKY_PASSWORD - set (if using Bluesky)
- [ ] REDDIT_CLIENT_ID - set (if using Reddit)
- [ ] REDDIT_CLIENT_SECRET - set (if using Reddit)

---

## Common Issues & Remediation

### Issue: Google News API key expired/invalid
**Symptoms:** No google_news data, 401/403 errors
**Remediation:** Renew API key, update secret

### Issue: RSS feeds not parsing
**Symptoms:** RSS source has 0 items
**Remediation:** Check feed URLs, verify XML format, check parser

### Issue: Social media rate limited
**Symptoms:** Decreasing volume, gaps in data
**Remediation:** Implement backoff, check rate limit headers

### Issue: Single source dominance
**Symptoms:** One source >70% of volume
**Remediation:** Add more sources, balance fetch frequencies

---

## Finding Severity Levels

| Severity | Condition |
|----------|-----------|
| CRITICAL | All Tier 1 sources down |
| HIGH | One Tier 1 source down, or no source diversity |
| MEDIUM | Tier 2 source down, or quality issues |
| LOW | Tier 3 source down, or minor issues |
| INFO | Source optimization opportunities |

---

## Output Template

```markdown
## Source Integration Audit Results

**Audit Date:** [DATE]

### Source Health Summary

| Source Type | Status | Volume (24h) | Latest | Staleness |
|-------------|--------|--------------|--------|-----------|
| google_news | | | | |
| rss | | | | |
| bluesky | | | | |
| reddit | | | | |

### Source Diversity

| Source | % of Total | Concentration |
|--------|------------|---------------|
| | | |

**Diversity Score:** [GOOD/MODERATE/POOR]

### API Health

| API | Credential | Rate Limit | Status |
|-----|------------|------------|--------|
| Google News | | | |
| Bluesky | | | |

### Content Quality

| Source | Title Rate | URL Rate | Hash Rate |
|--------|------------|----------|-----------|
| | | | |

### Findings

#### [SEVERITY] Finding Title
- **Source:** [affected source]
- **Issue:** [description]
- **Impact:** [user impact]
- **Remediation:** [fix steps]
```
