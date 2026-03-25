# Ground Truth Comparator

**Agent ID:** 23
**Role:** Data Accuracy Analyst
**Focus:** Compare our trends against external ground truth sources
**Priority:** HIGH
**Estimated Time:** 2-3 hours

---

## Overview

This agent validates our trend accuracy by comparing against external sources:
1. **Google Trends** - Real-time trending searches
2. **Reddit** - Political subreddit hot posts
3. **Twitter/X** - Trending topics (via scraping)

The goal is to measure:
- **Precision@K**: What % of our trends match ground truth?
- **Recall@K**: What % of ground truth do we capture?
- **Latency**: How far behind are we?

---

## Ground Truth Sources (Free)

### 1. Google Trends Daily RSS (Free, No Auth)

```bash
# Free RSS feed for US trending searches
curl "https://trends.google.com/trends/trendingsearches/daily/rss?geo=US"
```

**Edge Function Implementation:**

```typescript
async function getGoogleTrendingSearches(): Promise<string[]> {
  const response = await fetch(
    'https://trends.google.com/trends/trendingsearches/daily/rss?geo=US'
  );
  const xml = await response.text();

  // Parse RSS XML
  const titles = xml.match(/<title>([^<]+)<\/title>/g) || [];
  const trends = titles
    .map(t => t.replace(/<\/?title>/g, ''))
    .filter(t => t !== 'Daily Search Trends');

  // Filter for political topics
  const politicalKeywords = [
    'trump', 'biden', 'congress', 'senate', 'house', 'republican', 'democrat',
    'election', 'vote', 'bill', 'law', 'court', 'governor', 'president',
    'policy', 'immigration', 'border', 'abortion', 'gun', 'healthcare'
  ];

  return trends.filter(trend =>
    politicalKeywords.some(kw => trend.toLowerCase().includes(kw))
  );
}
```

### 2. Reddit Political Subreddits (Free JSON API)

```typescript
async function getRedditPoliticsTrends(): Promise<string[]> {
  const subreddits = ['politics', 'news', 'Conservative', 'democrats'];
  const allTrends: string[] = [];

  for (const sub of subreddits) {
    const response = await fetch(
      `https://www.reddit.com/r/${sub}/hot.json?limit=15`,
      {
        headers: {
          'User-Agent': 'TrendAudit/1.0 (Political Intelligence Platform)'
        }
      }
    );

    if (!response.ok) continue;

    const data = await response.json();
    const posts = data.data.children || [];

    for (const post of posts) {
      const title = post.data.title;
      // Extract key topic from title
      const topic = extractTopicFromTitle(title);
      if (topic) allTrends.push(topic);
    }
  }

  return deduplicateTopics(allTrends);
}

function extractTopicFromTitle(title: string): string | null {
  // Extract named entities or key phrases
  // Simple version: extract capitalized phrases
  const matches = title.match(/[A-Z][a-z]+(?: [A-Z][a-z]+)*/g) || [];
  return matches.length > 0 ? matches[0] : null;
}
```

### 3. Twitter/X via Twikit (Free Scraping)

```typescript
// Note: Requires Python or use their REST endpoint if available
// Alternative: Use nitter.net RSS feeds

async function getTwitterTrends(): Promise<string[]> {
  // Nitter (Twitter mirror) provides RSS
  const response = await fetch('https://nitter.net/search/rss?f=tweets&q=politics');
  // Parse and extract trending topics
  // ...
}
```

---

## Comparison Methodology

### Step 1: Collect Data (Every 15 minutes)

```sql
-- Create comparison tracking table
CREATE TABLE IF NOT EXISTS trend_accuracy_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL, -- 'google_trends', 'reddit', 'twitter'
  ground_truth_topics TEXT[] NOT NULL,
  our_topics TEXT[] NOT NULL,
  matched_topics TEXT[],
  precision_at_10 NUMERIC,
  recall_at_10 NUMERIC,
  f1_at_10 NUMERIC,
  avg_latency_minutes NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Step 2: Calculate Metrics

```typescript
function calculateAccuracyMetrics(
  ourTrends: string[],
  groundTruth: string[],
  k: number = 10
): AccuracyMetrics {
  const ourTopK = ourTrends.slice(0, k);
  const gtTopK = groundTruth.slice(0, k);

  // Fuzzy matching (topics may be phrased differently)
  const matches = ourTopK.filter(ourTopic =>
    gtTopK.some(gtTopic => topicsSimilar(ourTopic, gtTopic))
  );

  const precision = matches.length / ourTopK.length;
  const recall = matches.length / gtTopK.length;
  const f1 = 2 * (precision * recall) / (precision + recall) || 0;

  return {
    precision_at_k: precision,
    recall_at_k: recall,
    f1_at_k: f1,
    matched_topics: matches,
    our_unique: ourTopK.filter(t => !matches.includes(t)),
    gt_missed: gtTopK.filter(gt => !matches.some(m => topicsSimilar(m, gt)))
  };
}

function topicsSimilar(a: string, b: string): boolean {
  // Normalize
  const normA = a.toLowerCase().replace(/[^a-z0-9 ]/g, '');
  const normB = b.toLowerCase().replace(/[^a-z0-9 ]/g, '');

  // Check word overlap
  const wordsA = new Set(normA.split(' '));
  const wordsB = new Set(normB.split(' '));
  const intersection = [...wordsA].filter(w => wordsB.has(w));
  const union = new Set([...wordsA, ...wordsB]);

  const jaccard = intersection.length / union.size;
  return jaccard > 0.5; // 50% word overlap = match
}
```

---

## Audit Queries

### Query 1: Manual Ground Truth Comparison (One-time)

Run this to compare current trends against a manual ground truth snapshot:

```sql
-- Step 1: Get our current top trends
WITH our_trends AS (
  SELECT
    event_title,
    confidence_score,
    z_score_velocity,
    ROW_NUMBER() OVER (ORDER BY confidence_score DESC) as rank
  FROM trend_events
  WHERE is_trending = true
    AND last_seen_at > NOW() - INTERVAL '4 hours'
  ORDER BY confidence_score DESC
  LIMIT 20
)
SELECT
  rank,
  event_title,
  confidence_score,
  z_score_velocity
FROM our_trends;

-- Step 2: Manually check against Google Trends / Reddit
-- Record matches in a spreadsheet or temp table
```

### Query 2: Topic Coverage Check

```sql
-- Check if we're covering major political topics
WITH expected_topics AS (
  SELECT unnest(ARRAY[
    -- Add current real-world trending topics here
    'Trump', 'Biden', 'Congress', 'Supreme Court',
    -- Add specific current events
    'Government Shutdown', 'Border Bill', 'TikTok Ban'
  ]) as expected_topic
)
SELECT
  et.expected_topic,
  EXISTS (
    SELECT 1 FROM trend_events te
    WHERE te.is_trending = true
      AND te.last_seen_at > NOW() - INTERVAL '24 hours'
      AND LOWER(te.event_title) LIKE '%' || LOWER(et.expected_topic) || '%'
  ) as we_have_it,
  (
    SELECT te.event_title
    FROM trend_events te
    WHERE te.is_trending = true
      AND te.last_seen_at > NOW() - INTERVAL '24 hours'
      AND LOWER(te.event_title) LIKE '%' || LOWER(et.expected_topic) || '%'
    ORDER BY te.confidence_score DESC
    LIMIT 1
  ) as our_version
FROM expected_topics et;
```

### Query 3: Latency Analysis

```sql
-- How quickly do we detect trends vs when they appear in evidence?
SELECT
  event_title,
  first_seen_at,
  (
    SELECT MIN(tev.published_at)
    FROM trend_evidence tev
    WHERE tev.trend_event_id = te.id
  ) as earliest_evidence,
  first_seen_at - (
    SELECT MIN(tev.published_at)
    FROM trend_evidence tev
    WHERE tev.trend_event_id = te.id
  ) as detection_latency
FROM trend_events te
WHERE is_trending = true
  AND last_seen_at > NOW() - INTERVAL '24 hours'
ORDER BY first_seen_at DESC
LIMIT 20;
```

---

## Accuracy Targets

| Metric | Current (Est.) | Target | Excellent |
|--------|----------------|--------|-----------|
| Precision@10 | Unknown | >50% | >70% |
| Recall@10 | Unknown | >40% | >60% |
| F1@10 | Unknown | >45% | >65% |
| Detection Latency | Unknown | <15 min | <5 min |

---

## Implementation: Automated Comparison Function

```typescript
// supabase/functions/compare-ground-truth/index.ts

serve(async (req) => {
  const supabase = createClient(/* ... */);

  // 1. Get our current trends
  const { data: ourTrends } = await supabase
    .from('trend_events')
    .select('event_title, confidence_score')
    .eq('is_trending', true)
    .gte('last_seen_at', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString())
    .order('confidence_score', { ascending: false })
    .limit(20);

  // 2. Get Google Trends
  const googleTrends = await getGoogleTrendingSearches();

  // 3. Get Reddit trends
  const redditTrends = await getRedditPoliticsTrends();

  // 4. Calculate metrics for each source
  const googleMetrics = calculateAccuracyMetrics(
    ourTrends.map(t => t.event_title),
    googleTrends,
    10
  );

  const redditMetrics = calculateAccuracyMetrics(
    ourTrends.map(t => t.event_title),
    redditTrends,
    10
  );

  // 5. Store results
  await supabase.from('trend_accuracy_checks').insert([
    {
      source: 'google_trends',
      ground_truth_topics: googleTrends,
      our_topics: ourTrends.map(t => t.event_title),
      matched_topics: googleMetrics.matched_topics,
      precision_at_10: googleMetrics.precision_at_k,
      recall_at_10: googleMetrics.recall_at_k,
      f1_at_10: googleMetrics.f1_at_k
    },
    {
      source: 'reddit',
      ground_truth_topics: redditTrends,
      our_topics: ourTrends.map(t => t.event_title),
      matched_topics: redditMetrics.matched_topics,
      precision_at_10: redditMetrics.precision_at_k,
      recall_at_10: redditMetrics.recall_at_k,
      f1_at_10: redditMetrics.f1_at_k
    }
  ]);

  return new Response(JSON.stringify({
    google: googleMetrics,
    reddit: redditMetrics,
    our_trends: ourTrends.slice(0, 10).map(t => t.event_title)
  }));
});
```

---

## Manual Audit Process

### Step 1: Capture Ground Truth Snapshot

1. Open Google Trends (https://trends.google.com/trending)
2. Open Reddit r/politics sorted by Hot
3. Open Twitter/X trending (if accessible)
4. Record top 10-15 political topics from each

### Step 2: Compare Against Our Trends

```sql
-- Get our top 15 trends
SELECT event_title, confidence_score
FROM trend_events
WHERE is_trending = true
  AND last_seen_at > NOW() - INTERVAL '4 hours'
ORDER BY confidence_score DESC
LIMIT 15;
```

### Step 3: Calculate Metrics

- Count matches (fuzzy matching allowed)
- Precision = Matches / Our Trends
- Recall = Matches / Ground Truth
- Note any significant misses

---

## Alerting Thresholds

```sql
-- Alert if accuracy drops
CREATE OR REPLACE FUNCTION check_trend_accuracy_alert()
RETURNS void AS $$
DECLARE
  recent_f1 NUMERIC;
BEGIN
  SELECT AVG(f1_at_10) INTO recent_f1
  FROM trend_accuracy_checks
  WHERE check_time > NOW() - INTERVAL '1 hour';

  IF recent_f1 < 0.4 THEN
    INSERT INTO system_alerts (alert_type, severity, message)
    VALUES ('trend_accuracy', 'warning',
      'Trend accuracy F1@10 dropped to ' || recent_f1::text);
  END IF;
END;
$$ LANGUAGE plpgsql;
```

---

## Verification Checklist

- [ ] Google Trends comparison implemented
- [ ] Reddit comparison implemented
- [ ] Accuracy metrics being tracked
- [ ] Precision@10 > 50%
- [ ] Recall@10 > 40%
- [ ] Detection latency < 15 minutes
- [ ] Alerting configured for drops

---

## Next Agent

After completing this audit, proceed to:
→ `24-keyword-extraction-auditor.md` (Audit keyword extraction quality)
