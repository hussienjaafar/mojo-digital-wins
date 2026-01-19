# Comprehensive Trends System Deep Audit Plan

**Generated:** 2026-01-19
**Status:** READY FOR IMPLEMENTATION
**Estimated Time:** 8-12 hours across all agents

---

## Executive Summary

This audit plan addresses the user-reported issues:
1. **Low-quality/noise trends** showing up
2. **Entity-only labels** (e.g., "Donald Trump" without context)
3. **Duplicate trends** appearing in the feed
4. **Non-user-friendly drill-down** - should show news articles like Twitter/X
5. **Evergreen topics** (Trump, Biden, etc.) always trending

### Research Findings

Based on extensive research into how Twitter/X, Google Trends, and industry best practices handle trend detection:

**Twitter/X Trending Algorithm:**
- Uses **velocity-based detection** - measures spike in first 30 minutes
- Shows **context explanations** via pinned tweets and curated descriptions
- Has **curation team** + algorithms to explain "why trending"
- Sources: [RecurPost](https://recurpost.com/blog/twitter-algorithm/), [SocialBee](https://socialbee.com/blog/twitter-algorithm/), [Twitter Blog](https://blog.twitter.com/en_us/topics/product/2020/adding-more-context-to-trends)

**Ground Truth Sources (Free/Low-Cost):**
- **PyTrends** (Google Trends) - Free, but unstable. Use Selenium as fallback. [GitHub](https://github.com/GeneralMills/pytrends)
- **PRAW** (Reddit) - Free official API, 100 posts per subreddit call. [GitHub](https://github.com/praw-dev/praw)
- **Twikit** (Twitter/X) - Free scraping without API key. [GitHub](https://github.com/d60/twikit)

**Deduplication Best Practices:**
- **Semantic similarity** using embeddings (SBERT) + Levenshtein distance
- **Clustering algorithms** - DBSCAN, hierarchical clustering
- **Topic modeling** - BERTopic for grouping similar topics
- Sources: [ArXiv Paper](https://arxiv.org/html/2410.01141v3), [Medium](https://medium.com/@danielafrimi/text-clustering-using-nlp-techniques-c2e6b08b6e95)

---

## Audit Framework Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TRENDS DEEP AUDIT FRAMEWORK                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PHASE 1: DATA QUALITY AUDIT                                                │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │ 20-trend-quality │  │ 21-duplicate-    │  │ 22-evergreen-    │          │
│  │ -auditor         │  │ detector-auditor │  │ topic-auditor    │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
│                                                                              │
│  PHASE 2: ACCURACY VALIDATION                                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │ 23-ground-truth- │  │ 24-keyword-      │  │ 25-scoring-      │          │
│  │ comparator       │  │ extraction-audit │  │ algorithm-audit  │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
│                                                                              │
│  PHASE 3: UX AUDIT                                                          │
│  ┌──────────────────┐  ┌──────────────────┐                                │
│  │ 26-drilldown-ux  │  │ 27-article-      │                                │
│  │ -auditor         │  │ display-auditor  │                                │
│  └──────────────────┘  └──────────────────┘                                │
│                                                                              │
│  PHASE 4: IMPLEMENTATION REMEDIATION                                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │ 28-dedup-        │  │ 29-twitter-like- │  │ 30-ground-truth- │          │
│  │ implementer      │  │ ux-implementer   │  │ integrator       │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## PHASE 1: DATA QUALITY AUDIT

### Agent 20: Trend Quality Auditor

**Purpose:** Identify low-quality, noisy, or meaningless trends currently showing

**Audit Criteria:**
1. **Label Quality Distribution**
   - Event phrases (good): "House Passes Border Bill"
   - Entity-only (bad): "Donald Trump", "Biden", "Gaza"
   - Noise (very bad): "Video", "Thread", "Report"

2. **Signal-to-Noise Ratio**
   - Trends with <3 sources = noise risk
   - Single-source trends = high noise risk
   - Trends from tier3-only sources = lower quality

3. **Actionability Score**
   - Can a political org act on this trend?
   - Does it have policy relevance?
   - Is there a clear "what happened"?

**SQL Diagnostic Queries:**

```sql
-- Audit 1: Label quality distribution
SELECT
  CASE
    WHEN is_event_phrase = true THEN 'event_phrase'
    WHEN array_length(string_to_array(event_title, ' '), 1) = 1 THEN 'entity_only'
    WHEN event_title ~* '^\w+\s+\w+$' THEN 'two_word'
    ELSE 'multi_word'
  END as label_type,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as percentage,
  AVG(confidence_score) as avg_confidence
FROM trend_events
WHERE is_trending = true
  AND last_seen_at > NOW() - INTERVAL '24 hours'
GROUP BY 1
ORDER BY count DESC;

-- Audit 2: Single-word entity trends (bad)
SELECT
  event_title,
  confidence_score,
  source_count,
  z_score_velocity
FROM trend_events
WHERE is_trending = true
  AND last_seen_at > NOW() - INTERVAL '24 hours'
  AND array_length(string_to_array(event_title, ' '), 1) = 1
ORDER BY confidence_score DESC
LIMIT 20;

-- Audit 3: Noise detection (blocklist terms)
SELECT
  event_title,
  confidence_score,
  source_count
FROM trend_events
WHERE is_trending = true
  AND last_seen_at > NOW() - INTERVAL '24 hours'
  AND (
    event_title ~* '^(video|thread|report|update|news|says|breaking)$'
    OR event_title ~* '\b(thread|video|live|watch)\b'
  )
ORDER BY confidence_score DESC;
```

**Expected Findings:**
- % of entity-only trends should be <20%
- % of event_phrase trends should be >50%
- Noise terms should be 0%

---

### Agent 21: Duplicate Detector Auditor

**Purpose:** Find and quantify duplicate/near-duplicate trends

**Detection Methods:**

1. **Exact Duplicates** - Same event_key or event_title
2. **Near-Duplicates** - Levenshtein distance < 3
3. **Semantic Duplicates** - Same topic, different phrasing
   - "Trump Fires Wray" vs "Wray Fired by Trump"
   - "House Passes Bill" vs "Bill Passed by House"

**SQL Diagnostic Queries:**

```sql
-- Audit 1: Exact title duplicates
SELECT
  LOWER(event_title) as normalized_title,
  COUNT(*) as duplicate_count,
  array_agg(id) as trend_ids
FROM trend_events
WHERE is_trending = true
  AND last_seen_at > NOW() - INTERVAL '24 hours'
GROUP BY LOWER(event_title)
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Audit 2: Near-duplicate detection using trigram similarity
-- Requires pg_trgm extension
SELECT
  a.event_title as title_a,
  b.event_title as title_b,
  similarity(a.event_title, b.event_title) as sim_score,
  a.confidence_score as score_a,
  b.confidence_score as score_b
FROM trend_events a
JOIN trend_events b ON a.id < b.id
WHERE a.is_trending = true AND b.is_trending = true
  AND a.last_seen_at > NOW() - INTERVAL '24 hours'
  AND b.last_seen_at > NOW() - INTERVAL '24 hours'
  AND similarity(a.event_title, b.event_title) > 0.6
ORDER BY sim_score DESC
LIMIT 50;

-- Audit 3: Same entities, different labels
SELECT
  COALESCE(politicians_mentioned[1], organizations_mentioned[1]) as primary_entity,
  COUNT(*) as trend_count,
  array_agg(event_title) as titles
FROM trend_events
WHERE is_trending = true
  AND last_seen_at > NOW() - INTERVAL '24 hours'
  AND (
    array_length(politicians_mentioned, 1) > 0 OR
    array_length(organizations_mentioned, 1) > 0
  )
GROUP BY 1
HAVING COUNT(*) > 1
ORDER BY trend_count DESC;
```

**Expected Findings:**
- Exact duplicates should be 0
- Near-duplicates (>0.7 similarity) should be <5%
- Entity-grouped duplicates need clustering

---

### Agent 22: Evergreen Topic Auditor

**Purpose:** Audit how evergreen topics are currently handled

**Key Questions:**
1. Are evergreen entities (Trump, Biden, Gaza) always trending?
2. Are they only trending when there's a real spike?
3. Is the penalty system working correctly?

**SQL Diagnostic Queries:**

```sql
-- Audit 1: Evergreen entity trending frequency
WITH evergreen_list AS (
  SELECT unnest(ARRAY[
    'trump', 'biden', 'harris', 'obama', 'pelosi', 'mcconnell', 'schumer',
    'musk', 'putin', 'netanyahu', 'zelensky',
    'gaza', 'israel', 'ukraine', 'russia', 'china', 'taiwan', 'iran'
  ]) as entity
)
SELECT
  te.event_title,
  te.z_score_velocity,
  te.baseline_7d,
  te.current_24h,
  te.confidence_score,
  CASE
    WHEN te.z_score_velocity > 3 THEN 'REAL SPIKE'
    WHEN te.z_score_velocity > 2 THEN 'MODERATE SPIKE'
    ELSE 'NO SPIKE (should not trend)'
  END as spike_status
FROM trend_events te
JOIN evergreen_list el ON LOWER(te.event_title) LIKE '%' || el.entity || '%'
WHERE te.is_trending = true
  AND te.last_seen_at > NOW() - INTERVAL '24 hours'
ORDER BY te.z_score_velocity ASC;

-- Audit 2: Evergreen penalty effectiveness
SELECT
  event_title,
  z_score_velocity,
  baseline_7d,
  baseline_30d,
  confidence_score,
  confidence_factors->>'evergreen_penalty' as evergreen_penalty
FROM trend_events
WHERE is_trending = true
  AND last_seen_at > NOW() - INTERVAL '24 hours'
  AND (
    LOWER(event_title) LIKE '%trump%' OR
    LOWER(event_title) LIKE '%biden%' OR
    LOWER(event_title) LIKE '%gaza%'
  )
ORDER BY z_score_velocity DESC;

-- Audit 3: Single-word entity trends (should be suppressed)
SELECT
  event_title,
  array_length(string_to_array(event_title, ' '), 1) as word_count,
  z_score_velocity,
  confidence_score,
  is_trending
FROM trend_events
WHERE last_seen_at > NOW() - INTERVAL '24 hours'
  AND array_length(string_to_array(event_title, ' '), 1) = 1
  AND LOWER(event_title) IN (
    'trump', 'biden', 'gaza', 'israel', 'musk', 'ukraine', 'russia'
  )
ORDER BY confidence_score DESC;
```

**Expected Findings:**
- Evergreen entities trending without spike = BUG
- Single-word entity labels should have <30 confidence
- Event phrases about evergreen topics = OK if spiking

---

## PHASE 2: ACCURACY VALIDATION

### Agent 23: Ground Truth Comparator

**Purpose:** Compare our trends against external sources to measure accuracy

**Ground Truth Sources:**

1. **Google Trends (PyTrends)**
   - Real-time trending searches
   - US Politics category
   - Compare top 10 topics

2. **Reddit Political Subreddits (PRAW)**
   - r/politics hot posts
   - r/news rising posts
   - r/conservative, r/democrats for balance

3. **Twitter/X Trends (Twikit)**
   - US trending topics
   - Politics-filtered trends

**Comparison Methodology:**

```
                    Our System                Ground Truth
                    ──────────                ────────────
                    Topic A                   Topic X
                    Topic B        ←──────→   Topic B  ✓ MATCH
                    Topic C                   Topic Y
                    Topic D        ←──────→   Topic D  ✓ MATCH
                    Topic E                   Topic Z

                    Precision@10 = Matches / Our Topics = 2/5 = 40%
                    Recall@10 = Matches / Ground Truth = 2/3 = 67%
                    F1@10 = 2 * (0.4 * 0.67) / (0.4 + 0.67) = 50%
```

**Integration Approach (Free):**

```typescript
// PyTrends integration (Python edge function or scheduled job)
import pytrends from 'pytrends-api';

async function getGoogleTrends(): Promise<string[]> {
  const pytrends = new TrendReq();
  const trending = await pytrends.trending_searches(pn='united_states');
  return trending.filter(t => isPolitical(t)).slice(0, 20);
}

// PRAW integration (can run from Supabase Edge Function)
async function getRedditTrends(): Promise<string[]> {
  const response = await fetch(
    'https://www.reddit.com/r/politics/hot.json?limit=25',
    { headers: { 'User-Agent': 'TrendAudit/1.0' } }
  );
  const data = await response.json();
  return data.data.children.map(post => extractTopic(post.data.title));
}
```

**Metrics to Track:**
- **Precision@K**: What % of our trends match ground truth?
- **Recall@K**: What % of ground truth do we capture?
- **Latency**: How many minutes behind are we?
- **False Positive Rate**: Trends we show that aren't real

---

### Agent 24: Keyword Extraction Auditor

**Purpose:** Audit the topic/keyword extraction quality

**Current System Analysis:**
- Located in `extract-trending-topics/index.ts`
- Uses AI extraction with event phrase prioritization
- Validates multi-word requirement (2-6 words)
- Requires action verb OR event noun

**Audit Queries:**

```sql
-- Audit 1: Topics by extraction method
SELECT
  COALESCE(label_source, 'unknown') as extraction_method,
  COUNT(*) as count,
  AVG(confidence_score) as avg_confidence
FROM trend_events
WHERE last_seen_at > NOW() - INTERVAL '24 hours'
GROUP BY 1
ORDER BY count DESC;

-- Audit 2: Label quality vs confidence
SELECT
  label_quality,
  COUNT(*) as count,
  AVG(confidence_score) as avg_confidence,
  AVG(z_score_velocity) as avg_velocity
FROM trend_events
WHERE is_trending = true
  AND last_seen_at > NOW() - INTERVAL '24 hours'
GROUP BY 1;

-- Audit 3: Sample of each label quality
SELECT
  label_quality,
  event_title,
  confidence_score,
  z_score_velocity
FROM trend_events
WHERE is_trending = true
  AND last_seen_at > NOW() - INTERVAL '24 hours'
ORDER BY label_quality, confidence_score DESC
LIMIT 30;
```

---

### Agent 25: Scoring Algorithm Auditor

**Purpose:** Validate the trend scoring algorithm accuracy

**Current Scoring Components:**
1. Velocity (0-50 pts): `zScoreVelocity * 5`
2. Corroboration (0-30 pts): Cross-source verification
3. Activity (0-20 pts): Log-scaled mentions
4. Modifiers: Recency decay, evergreen penalty, label quality

**Audit Methodology:**

```sql
-- Audit 1: Score distribution
SELECT
  CASE
    WHEN confidence_score >= 80 THEN 'A: 80-100'
    WHEN confidence_score >= 60 THEN 'B: 60-79'
    WHEN confidence_score >= 40 THEN 'C: 40-59'
    WHEN confidence_score >= 20 THEN 'D: 20-39'
    ELSE 'F: 0-19'
  END as score_tier,
  COUNT(*) as count,
  AVG(z_score_velocity) as avg_velocity,
  AVG(source_count) as avg_sources
FROM trend_events
WHERE is_trending = true
  AND last_seen_at > NOW() - INTERVAL '24 hours'
GROUP BY 1
ORDER BY 1;

-- Audit 2: High score, low velocity (potential false positives)
SELECT
  event_title,
  confidence_score,
  z_score_velocity,
  source_count,
  current_24h
FROM trend_events
WHERE is_trending = true
  AND confidence_score >= 70
  AND z_score_velocity < 2
  AND last_seen_at > NOW() - INTERVAL '24 hours'
ORDER BY confidence_score DESC;

-- Audit 3: Low score, high velocity (potential missed trends)
SELECT
  event_title,
  confidence_score,
  z_score_velocity,
  source_count,
  is_trending
FROM trend_events
WHERE z_score_velocity >= 3
  AND confidence_score < 50
  AND last_seen_at > NOW() - INTERVAL '24 hours'
ORDER BY z_score_velocity DESC;
```

---

## PHASE 3: UX AUDIT

### Agent 26: Drill-Down UX Auditor

**Purpose:** Audit the current "Why Trending" drill-down experience

**Current State:**
- Shows statistical metrics (z-score, baseline delta)
- Shows evidence timeline with sources
- Shows confidence breakdown
- **Missing:** Direct news article links like Twitter/X

**Twitter/X "Why Trending" Features:**
1. Pinned representative tweet
2. Short curated description
3. Number of tweets
4. Direct link to full conversation

**Audit Checklist:**

| Feature | Twitter/X | Our System | Gap |
|---------|-----------|------------|-----|
| Representative content | ✓ Pinned tweet | Partial (top headline) | Need featured article |
| Why explanation | ✓ Curated text | ✓ Auto-generated | OK |
| Article list | ✓ Direct links | ❌ Missing | **CRITICAL** |
| Engagement metrics | ✓ Tweet count | ✓ Mention count | OK |
| Time context | ✓ "Started trending 2h ago" | ✓ first_seen_at | OK |
| Source diversity | ❌ | ✓ Cross-source | Ahead |

---

### Agent 27: Article Display Auditor

**Purpose:** Audit the news article display capability

**Requirements for Twitter-like UX:**
1. Show 5-10 most relevant articles for each trend
2. Article card: Title, source, published time, thumbnail
3. Click → opens article in new tab
4. Source tier badge (Tier 1/2/3)
5. Sentiment indicator

**Current Data Available:**

```sql
-- Check if we have article links in evidence
SELECT
  te.event_title,
  COUNT(tev.id) as evidence_count,
  COUNT(DISTINCT tev.source_url) as unique_urls,
  array_agg(DISTINCT tev.source_domain) as domains
FROM trend_events te
LEFT JOIN trend_evidence tev ON tev.trend_event_id = te.id
WHERE te.is_trending = true
  AND te.last_seen_at > NOW() - INTERVAL '24 hours'
GROUP BY te.id, te.event_title
ORDER BY evidence_count DESC
LIMIT 20;

-- Check article metadata quality
SELECT
  source_type,
  COUNT(*) as count,
  COUNT(DISTINCT source_url) FILTER (WHERE source_url IS NOT NULL) as with_url,
  COUNT(DISTINCT source_domain) as unique_domains
FROM trend_evidence
WHERE discovered_at > NOW() - INTERVAL '24 hours'
GROUP BY source_type;
```

---

## PHASE 4: IMPLEMENTATION REMEDIATION

### Agent 28: Deduplication Implementer

**Purpose:** Implement semantic deduplication for trends

**Implementation Approach:**

1. **Embedding-based clustering**
   - Generate embeddings for trend titles
   - Use cosine similarity threshold (0.85)
   - Cluster similar trends, keep highest confidence

2. **Entity-based merging**
   - Same primary entity + overlapping time = candidate merge
   - Keep event phrase over entity-only label

3. **Real-time dedup during detection**
   - Before inserting new trend, check similarity to existing
   - Merge into existing if >0.85 similarity

**Code Changes Required:**
- `detect-trend-events/index.ts`: Add embedding lookup + merge logic
- New function: `merge-similar-trends` for batch cleanup
- Database: Add `cluster_id` column for grouping

---

### Agent 29: Twitter-Like UX Implementer

**Purpose:** Implement article-based drill-down like Twitter/X

**UI Changes:**

```typescript
// New TrendDrilldownPanel sections:

// 1. Featured Article (Twitter's "pinned tweet" equivalent)
<FeaturedArticle
  headline={trend.top_headline}
  source={primaryEvidence.source_domain}
  url={primaryEvidence.source_url}
  publishedAt={primaryEvidence.published_at}
  tier={primaryEvidence.source_tier}
/>

// 2. Why Trending Summary (keep existing, make more prominent)
<WhyTrendingSummary trend={trend} />

// 3. Article List (NEW - the main change)
<ArticleList
  articles={evidence.filter(e => e.source_type !== 'bluesky')}
  limit={10}
/>

// 4. Social Mentions (secondary section)
<SocialMentions
  posts={evidence.filter(e => e.source_type === 'bluesky')}
  limit={5}
/>
```

**Component: ArticleList**
```typescript
function ArticleList({ articles, limit }) {
  return (
    <div className="space-y-3">
      <h3 className="font-semibold flex items-center gap-2">
        <Newspaper className="w-4 h-4" />
        News Coverage ({articles.length} articles)
      </h3>
      {articles.slice(0, limit).map(article => (
        <ArticleCard
          key={article.id}
          title={article.headline}
          source={article.source_domain}
          url={article.source_url}
          publishedAt={article.published_at}
          tier={article.source_tier}
          sentiment={article.sentiment_label}
        />
      ))}
    </div>
  );
}
```

---

### Agent 30: Ground Truth Integrator

**Purpose:** Implement automated ground truth comparison

**Implementation:**

1. **Scheduled Edge Function: `compare-ground-truth`**
   - Runs every 15 minutes
   - Fetches Google Trends, Reddit hot posts
   - Compares to our trending topics
   - Stores accuracy metrics

2. **Accuracy Dashboard**
   - Show Precision@10, Recall@10, F1@10
   - Show latency (how far behind are we?)
   - Show missed trends from ground truth

3. **Alerting**
   - If Precision drops below 40%, alert
   - If we miss a major ground truth trend for >30 min, alert

**Free API Integration:**

```typescript
// Reddit (no API key needed for read-only)
async function getRedditPoliticsTrends(): Promise<string[]> {
  const subreddits = ['politics', 'news', 'Conservative'];
  const trends: string[] = [];

  for (const sub of subreddits) {
    const response = await fetch(
      `https://www.reddit.com/r/${sub}/hot.json?limit=10`,
      { headers: { 'User-Agent': 'TrendAudit/1.0' } }
    );
    const data = await response.json();
    const titles = data.data.children.map(p => p.data.title);
    trends.push(...extractTopics(titles));
  }

  return deduplicateTopics(trends);
}

// Google Trends (via unofficial endpoint)
async function getGoogleTrendingSearches(): Promise<string[]> {
  // Use daily trends RSS feed (free, no auth)
  const response = await fetch(
    'https://trends.google.com/trends/trendingsearches/daily/rss?geo=US'
  );
  const xml = await response.text();
  return parseRssToTopics(xml).filter(isPolitical);
}
```

---

## Audit Execution Order

```
DAY 1 (4-5 hours):
├── Agent 20: Trend Quality Auditor
├── Agent 21: Duplicate Detector Auditor
├── Agent 22: Evergreen Topic Auditor
└── Document findings

DAY 2 (3-4 hours):
├── Agent 23: Ground Truth Comparator (research only)
├── Agent 24: Keyword Extraction Auditor
├── Agent 25: Scoring Algorithm Auditor
└── Document findings

DAY 3 (2-3 hours):
├── Agent 26: Drill-Down UX Auditor
├── Agent 27: Article Display Auditor
└── Compile final audit report

IMPLEMENTATION (After Audit):
├── Agent 28: Deduplication Implementer
├── Agent 29: Twitter-Like UX Implementer
└── Agent 30: Ground Truth Integrator
```

---

## Success Criteria

After implementing fixes:

| Metric | Current (Est.) | Target |
|--------|----------------|--------|
| Entity-only trends | ~40% | <15% |
| Duplicate trends | ~10% | <2% |
| Evergreen without spike | ~20% | <5% |
| Precision@10 vs Ground Truth | Unknown | >50% |
| Drill-down shows articles | No | Yes |
| User satisfaction | Low | High |

---

## Next Steps

1. **Create the 8 new audit agents** (20-27)
2. **Run Phase 1 audits** to quantify current issues
3. **Create remediation agents** (28-30) based on findings
4. **Implement fixes** in priority order
5. **Re-run audits** to measure improvement

---

## Sources

- [Twitter Algorithm 2026 - RecurPost](https://recurpost.com/blog/twitter-algorithm/)
- [Twitter Context for Trends](https://blog.twitter.com/en_us/topics/product/2020/adding-more-context-to-trends)
- [PyTrends GitHub](https://github.com/GeneralMills/pytrends)
- [Twikit - Free Twitter Scraping](https://github.com/d60/twikit)
- [Reddit API Guide](https://latenode.com/blog/integration-api-management/api-integration-best-practices/how-to-use-reddit-api-from-access-tokens-to-automated-data-collection)
- [Text Deduplication with NLP](https://arxiv.org/html/2410.01141v3)
- [Precision and Recall - Google ML](https://developers.google.com/machine-learning/crash-course/classification/accuracy-precision-recall)
