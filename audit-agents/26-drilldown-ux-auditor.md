# Drill-Down UX Auditor

**Agent ID:** 26
**Role:** UX Analyst / Frontend Developer
**Focus:** Audit the "Why Trending" drill-down experience
**Priority:** HIGH
**Estimated Time:** 1-2 hours

---

## Overview

The user reported: "the drill down feature that shows why the topic is trending is not very user friendly"

This agent audits the current drill-down UX and compares it to Twitter/X's implementation.

---

## Twitter/X "Why Trending" Reference

Based on research, Twitter/X's trending context includes:

1. **Pinned Representative Tweet** - A single tweet that best represents the trend
2. **Curated Description** - Short text explaining why it's trending
3. **Tweet Count** - "125K posts"
4. **Time Context** - "Trending for 2 hours"
5. **Category Tag** - "Politics", "Entertainment", etc.
6. **Direct Links** - Click to see all tweets about the topic

Source: [Twitter Blog - Adding Context to Trends](https://blog.twitter.com/en_us/topics/product/2020/adding-more-context-to-trends)

---

## Current System Analysis

### What We Currently Show (TrendDrilldownPanel.tsx):

| Element | Current State | Quality |
|---------|--------------|---------|
| Why Trending Summary | Auto-generated text | ✅ Good |
| Confidence Score | Numeric with breakdown | ⚠️ Too technical |
| Z-Score Velocity | "3.2σ above normal" | ❌ Non-user-friendly |
| Baseline Delta | "+250% vs 7-day avg" | ⚠️ Somewhat technical |
| Evidence Count | "24 mentions" | ✅ Good |
| Label Quality Badge | "Event phrase" / "Entity" | ⚠️ Technical |
| Evidence Timeline | List of sources | ⚠️ Needs improvement |
| Article Links | Partial | ❌ Not prominent |

---

## Audit Checklist

### 1. Primary Content Display

**Current:**
```tsx
// TrendDrilldownPanel shows:
<WhyTrendingSummary /> // Good - explains the trend
<ConfidenceBreakdown /> // Technical - z-scores, baselines
<EvidenceTimeline /> // Needs improvement
```

**Expected (Twitter-like):**
```tsx
// Should show:
<FeaturedArticle /> // Primary article about the trend
<WhyTrendingSimple /> // Simple, non-technical explanation
<ArticleList /> // Direct links to read more
```

### 2. Evidence Display Quality

**Query: Check Evidence Availability**

```sql
-- Check if trends have linkable evidence
SELECT
  te.event_title,
  te.confidence_score,
  COUNT(tev.id) as evidence_count,
  COUNT(tev.source_url) FILTER (WHERE tev.source_url IS NOT NULL) as with_urls,
  COUNT(DISTINCT tev.source_domain) as unique_domains,
  ROUND(100.0 * COUNT(tev.source_url) FILTER (WHERE tev.source_url IS NOT NULL) / NULLIF(COUNT(tev.id), 0), 0) as url_coverage_pct
FROM trend_events te
LEFT JOIN trend_evidence tev ON tev.trend_event_id = te.id
WHERE te.is_trending = true
  AND te.last_seen_at > NOW() - INTERVAL '24 hours'
GROUP BY te.id, te.event_title, te.confidence_score
HAVING COUNT(tev.id) > 0
ORDER BY evidence_count DESC
LIMIT 30;
```

**Expected:** url_coverage_pct should be >80%

### 3. Source Tier Distribution

```sql
-- Check source quality in evidence
SELECT
  te.event_title,
  COUNT(*) FILTER (WHERE tev.source_tier = 'tier1') as tier1_count,
  COUNT(*) FILTER (WHERE tev.source_tier = 'tier2') as tier2_count,
  COUNT(*) FILTER (WHERE tev.source_tier = 'tier3') as tier3_count,
  COUNT(*) FILTER (WHERE tev.source_tier IS NULL) as unclassified
FROM trend_events te
LEFT JOIN trend_evidence tev ON tev.trend_event_id = te.id
WHERE te.is_trending = true
  AND te.last_seen_at > NOW() - INTERVAL '24 hours'
GROUP BY te.id, te.event_title
ORDER BY tier1_count DESC
LIMIT 20;
```

---

## UX Comparison Matrix

| Feature | Twitter/X | Current | Gap | Priority |
|---------|-----------|---------|-----|----------|
| Featured content | Pinned tweet | top_headline | Need prominent article card | HIGH |
| Why explanation | Curated text | Auto-generated | OK | LOW |
| Volume indicator | "125K posts" | evidence_count | Need better formatting | MED |
| Time context | "Trending for 2h" | first_seen_at | Need relative time | MED |
| Article list | Click to expand | Buried in timeline | Need prominent section | HIGH |
| Source badges | Verified badges | Tier badges | OK | LOW |
| Click-through | Direct to tweets | Opens source URL | Need cleaner UX | HIGH |

---

## Recommended UI Changes

### 1. Replace Technical Metrics with User-Friendly Language

**Current:**
- "Z-Score: 3.2σ" → **"Surging: 3x more mentions than normal"**
- "Baseline Delta: +250%" → **"Up 250% from last week"**
- "Confidence: 78" → **"Strong signal"** / **"Verified across 5 sources"**

### 2. Add Featured Article Section

```tsx
// New component at top of drill-down
<FeaturedArticle>
  <ArticleCard
    headline="Trump Fires FBI Director Christopher Wray"
    source="New York Times"
    tier="tier1"
    publishedAt="2 hours ago"
    url="https://nytimes.com/..."
    thumbnail={articleImage}
  />
  <Badge>Featured Story</Badge>
</FeaturedArticle>
```

### 3. Article List (Primary Section)

```tsx
// Replace evidence timeline with article-focused list
<ArticleList>
  <SectionHeader>
    <Newspaper /> News Coverage (24 articles)
  </SectionHeader>

  {articles.map(article => (
    <ArticleRow
      headline={article.headline}
      source={article.source_domain}
      tier={article.source_tier}
      publishedAt={formatRelativeTime(article.published_at)}
      onClick={() => window.open(article.source_url)}
    />
  ))}
</ArticleList>
```

### 4. Simplified "Why Trending" Card

```tsx
// Make the explanation more prominent and simpler
<WhyTrendingCard>
  <Heading>Why this is trending</Heading>
  <Description>
    {generateSimpleExplanation(trend)}
    {/* e.g., "Breaking news with rapidly growing coverage across 5 major sources" */}
  </Description>

  <QuickStats>
    <Stat icon={<TrendingUp />} label="24 articles" />
    <Stat icon={<Clock />} label="Trending for 3 hours" />
    <Stat icon={<Globe />} label="5 sources" />
  </QuickStats>
</WhyTrendingCard>
```

---

## User Flow Comparison

### Current Flow:
```
Click trend → See statistical metrics → Scroll to find articles → Click article
```

### Expected Flow (Twitter-like):
```
Click trend → See featured article + why it's trending → Browse article list → Click article
```

---

## Audit SQL Queries

### Query: Featured Article Quality

```sql
-- Can we feature a quality article for each trend?
SELECT
  te.event_title,
  te.top_headline,
  (
    SELECT tev.source_url
    FROM trend_evidence tev
    WHERE tev.trend_event_id = te.id
      AND tev.source_type IN ('rss', 'google_news')
      AND tev.source_url IS NOT NULL
    ORDER BY
      CASE tev.source_tier WHEN 'tier1' THEN 1 WHEN 'tier2' THEN 2 ELSE 3 END,
      tev.published_at DESC
    LIMIT 1
  ) as best_article_url,
  (
    SELECT tev.source_domain
    FROM trend_evidence tev
    WHERE tev.trend_event_id = te.id
      AND tev.source_type IN ('rss', 'google_news')
    ORDER BY
      CASE tev.source_tier WHEN 'tier1' THEN 1 WHEN 'tier2' THEN 2 ELSE 3 END
    LIMIT 1
  ) as best_source
FROM trend_events te
WHERE te.is_trending = true
  AND te.last_seen_at > NOW() - INTERVAL '24 hours'
ORDER BY te.confidence_score DESC
LIMIT 20;
```

### Query: Evidence Link Coverage

```sql
-- What % of evidence has clickable links?
SELECT
  source_type,
  COUNT(*) as total,
  COUNT(source_url) FILTER (WHERE source_url IS NOT NULL) as with_url,
  ROUND(100.0 * COUNT(source_url) FILTER (WHERE source_url IS NOT NULL) / NULLIF(COUNT(*), 0), 1) as url_pct
FROM trend_evidence
WHERE discovered_at > NOW() - INTERVAL '24 hours'
GROUP BY source_type;
```

---

## Verification Checklist

- [ ] Featured article displays prominently at top
- [ ] Why trending explanation is non-technical
- [ ] Article list is the primary content section
- [ ] All articles have clickable links
- [ ] Source tier badges are visible
- [ ] Time context shows relative time ("2 hours ago")
- [ ] Mobile responsive layout works

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/client/TrendDrilldownPanel.tsx` | Restructure layout, add ArticleList |
| `src/hooks/useTrendEvents.tsx` | Ensure evidence includes URLs |
| New: `src/components/client/FeaturedArticle.tsx` | Create featured article component |
| New: `src/components/client/ArticleList.tsx` | Create article list component |

---

## Next Agent

After completing this audit, proceed to:
→ `27-article-display-auditor.md` (Audit article display capability)
