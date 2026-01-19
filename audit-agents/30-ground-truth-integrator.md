# Ground Truth Integrator

**Agent ID:** 30
**Role:** Data Engineer / Backend Developer
**Focus:** Implement automated ground truth comparison for accuracy tracking
**Priority:** MEDIUM
**Estimated Time:** 3-4 hours
**Dependencies:** Agent 23 methodology, audit results

---

## Overview

This agent implements automated comparison against external trend sources to continuously measure accuracy:

1. **Google Trends** - Daily trending searches via RSS
2. **Reddit** - Political subreddit hot posts via JSON API
3. **Twitter/X** - Trending topics (via Twikit or Nitter)

Track metrics over time:
- Precision@K: What % of our trends match ground truth?
- Recall@K: What % of ground truth do we capture?
- Latency: How far behind are we?

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GROUND TRUTH COMPARISON SYSTEM                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SCHEDULED: Every 15 minutes                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │  1. FETCH EXTERNAL SOURCES                                           │   │
│  │     ├── Google Trends RSS (free, no auth)                           │   │
│  │     ├── Reddit /r/politics JSON (free, no auth)                     │   │
│  │     └── (Optional) Twitter via Twikit                               │   │
│  │                                                                       │   │
│  │  2. FETCH OUR TRENDS                                                 │   │
│  │     └── Top 20 by confidence_score                                  │   │
│  │                                                                       │   │
│  │  3. FUZZY MATCH                                                      │   │
│  │     └── Word overlap + entity matching                              │   │
│  │                                                                       │   │
│  │  4. CALCULATE METRICS                                                │   │
│  │     ├── Precision@10, Recall@10, F1@10                              │   │
│  │     └── Latency (our first_seen vs source published)                │   │
│  │                                                                       │   │
│  │  5. STORE RESULTS                                                    │   │
│  │     └── trend_accuracy_checks table                                 │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  DASHBOARD: Accuracy over time                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Precision@10: 65% (↑ 5%)                                           │   │
│  │  Recall@10: 55% (↓ 2%)                                              │   │
│  │  F1@10: 60%                                                          │   │
│  │  Avg Latency: 12 minutes                                             │   │
│  │                                                                       │   │
│  │  [Chart: Accuracy over 7 days]                                      │   │
│  │  [Table: Recent missed trends]                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Step 1: Create Database Schema

```sql
-- Table to store accuracy check results
CREATE TABLE IF NOT EXISTS trend_accuracy_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL, -- 'google_trends', 'reddit', 'combined'

  -- Ground truth data
  ground_truth_topics TEXT[] NOT NULL,
  ground_truth_count INT,

  -- Our data
  our_topics TEXT[] NOT NULL,
  our_count INT,

  -- Matches
  matched_topics TEXT[],
  matched_count INT,

  -- Metrics
  precision_at_10 NUMERIC(5,4),
  recall_at_10 NUMERIC(5,4),
  f1_at_10 NUMERIC(5,4),
  precision_at_20 NUMERIC(5,4),
  recall_at_20 NUMERIC(5,4),

  -- Latency (if measurable)
  avg_latency_minutes NUMERIC,

  -- Missed trends (for analysis)
  missed_from_ground_truth TEXT[],
  unique_to_us TEXT[],

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for time-series queries
CREATE INDEX IF NOT EXISTS idx_accuracy_checks_time
ON trend_accuracy_checks (check_time DESC);

CREATE INDEX IF NOT EXISTS idx_accuracy_checks_source
ON trend_accuracy_checks (source, check_time DESC);

-- View for recent accuracy
CREATE OR REPLACE VIEW trend_accuracy_summary AS
SELECT
  source,
  COUNT(*) as check_count,
  ROUND(AVG(precision_at_10) * 100, 1) as avg_precision_pct,
  ROUND(AVG(recall_at_10) * 100, 1) as avg_recall_pct,
  ROUND(AVG(f1_at_10) * 100, 1) as avg_f1_pct,
  ROUND(AVG(avg_latency_minutes), 1) as avg_latency_min,
  MAX(check_time) as last_check
FROM trend_accuracy_checks
WHERE check_time > NOW() - INTERVAL '24 hours'
GROUP BY source;
```

---

## Step 2: Create Edge Function

**File:** `supabase/functions/compare-ground-truth/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateCronOrAdmin } from "../_shared/security.ts";

const corsHeaders = getCorsHeaders();

// ============================================================================
// GROUND TRUTH FETCHERS
// ============================================================================

// Fetch Google Trends from daily RSS feed (free, no auth)
async function fetchGoogleTrends(): Promise<string[]> {
  try {
    const response = await fetch(
      'https://trends.google.com/trending/rss?geo=US',
      { headers: { 'User-Agent': 'TrendAudit/1.0' } }
    );

    if (!response.ok) {
      console.log('Google Trends RSS not available, trying alternative...');
      return [];
    }

    const xml = await response.text();

    // Parse RSS titles
    const titleMatches = xml.match(/<title>([^<]+)<\/title>/g) || [];
    const trends = titleMatches
      .map(t => t.replace(/<\/?title>/g, '').trim())
      .filter(t => t && t !== 'Daily Search Trends' && t !== 'Trending Searches');

    // Filter for political topics
    return filterPoliticalTopics(trends);
  } catch (error) {
    console.error('Error fetching Google Trends:', error);
    return [];
  }
}

// Fetch Reddit political subreddit hot posts (free JSON API)
async function fetchRedditTrends(): Promise<string[]> {
  const subreddits = ['politics', 'news', 'Conservative'];
  const allTopics: string[] = [];

  for (const sub of subreddits) {
    try {
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
      const posts = data?.data?.children || [];

      for (const post of posts) {
        const title = post?.data?.title || '';
        const topic = extractTopicFromTitle(title);
        if (topic) allTopics.push(topic);
      }
    } catch (error) {
      console.error(`Error fetching r/${sub}:`, error);
    }
  }

  return deduplicateTopics(allTopics);
}

// ============================================================================
// TOPIC PROCESSING UTILITIES
// ============================================================================

// Political keywords for filtering
const POLITICAL_KEYWORDS = [
  'trump', 'biden', 'harris', 'congress', 'senate', 'house', 'republican',
  'democrat', 'election', 'vote', 'bill', 'law', 'court', 'governor',
  'president', 'policy', 'immigration', 'border', 'abortion', 'gun',
  'healthcare', 'economy', 'tax', 'ukraine', 'russia', 'gaza', 'israel',
  'china', 'iran', 'fbi', 'doj', 'supreme', 'impeach', 'indictment'
];

function filterPoliticalTopics(topics: string[]): string[] {
  return topics.filter(topic => {
    const lower = topic.toLowerCase();
    return POLITICAL_KEYWORDS.some(kw => lower.includes(kw));
  });
}

function extractTopicFromTitle(title: string): string | null {
  if (!title || title.length < 10) return null;

  // Extract named entities (capitalized phrases)
  const matches = title.match(/[A-Z][a-z]+(?: [A-Z][a-z]+){0,3}/g) || [];

  // Filter out common non-topics
  const filtered = matches.filter(m => {
    const lower = m.toLowerCase();
    return !['the', 'this', 'that', 'what', 'how', 'why', 'when'].includes(lower) &&
           m.length > 3;
  });

  // Return first meaningful match or null
  return filtered.length > 0 ? filtered[0] : null;
}

function deduplicateTopics(topics: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const topic of topics) {
    const normalized = topic.toLowerCase().trim();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(topic);
    }
  }

  return result;
}

// ============================================================================
// MATCHING & METRICS
// ============================================================================

function topicsSimilar(a: string, b: string): boolean {
  const normA = a.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  const normB = b.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();

  // Exact match
  if (normA === normB) return true;

  // Word overlap (Jaccard similarity)
  const wordsA = new Set(normA.split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(normB.split(/\s+/).filter(w => w.length > 2));

  if (wordsA.size === 0 || wordsB.size === 0) return false;

  const intersection = [...wordsA].filter(w => wordsB.has(w));
  const union = new Set([...wordsA, ...wordsB]);

  const jaccard = intersection.length / union.size;
  return jaccard >= 0.5; // 50% word overlap = match
}

interface AccuracyMetrics {
  precision: number;
  recall: number;
  f1: number;
  matched: string[];
  missed: string[];
  unique: string[];
}

function calculateMetrics(
  ourTrends: string[],
  groundTruth: string[],
  k: number = 10
): AccuracyMetrics {
  const ourTopK = ourTrends.slice(0, k);
  const gtTopK = groundTruth.slice(0, k);

  // Find matches using fuzzy matching
  const matched: string[] = [];
  const gtMatched = new Set<number>();

  for (const ourTopic of ourTopK) {
    for (let i = 0; i < gtTopK.length; i++) {
      if (!gtMatched.has(i) && topicsSimilar(ourTopic, gtTopK[i])) {
        matched.push(ourTopic);
        gtMatched.add(i);
        break;
      }
    }
  }

  const precision = ourTopK.length > 0 ? matched.length / ourTopK.length : 0;
  const recall = gtTopK.length > 0 ? matched.length / gtTopK.length : 0;
  const f1 = precision + recall > 0
    ? 2 * (precision * recall) / (precision + recall)
    : 0;

  // Find missed from ground truth
  const missed = gtTopK.filter((_, i) => !gtMatched.has(i));

  // Find unique to us (not in ground truth)
  const unique = ourTopK.filter(t =>
    !gtTopK.some(gt => topicsSimilar(t, gt))
  );

  return { precision, recall, f1, matched, missed, unique };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authResult = await validateCronOrAdmin(req, supabase);
    if (!authResult.valid) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const checkTime = new Date().toISOString();
    const results: any[] = [];

    // 1. Fetch our current trends
    const { data: ourTrendsData } = await supabase
      .from('trend_events')
      .select('event_title, confidence_score, first_seen_at')
      .eq('is_trending', true)
      .gte('last_seen_at', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString())
      .order('confidence_score', { ascending: false })
      .limit(20);

    const ourTrends = (ourTrendsData || []).map(t => t.event_title);

    // 2. Fetch Google Trends
    const googleTrends = await fetchGoogleTrends();
    if (googleTrends.length > 0) {
      const googleMetrics = calculateMetrics(ourTrends, googleTrends, 10);

      await supabase.from('trend_accuracy_checks').insert({
        check_time: checkTime,
        source: 'google_trends',
        ground_truth_topics: googleTrends,
        ground_truth_count: googleTrends.length,
        our_topics: ourTrends,
        our_count: ourTrends.length,
        matched_topics: googleMetrics.matched,
        matched_count: googleMetrics.matched.length,
        precision_at_10: googleMetrics.precision,
        recall_at_10: googleMetrics.recall,
        f1_at_10: googleMetrics.f1,
        missed_from_ground_truth: googleMetrics.missed,
        unique_to_us: googleMetrics.unique
      });

      results.push({
        source: 'google_trends',
        ground_truth_count: googleTrends.length,
        metrics: {
          precision: Math.round(googleMetrics.precision * 100),
          recall: Math.round(googleMetrics.recall * 100),
          f1: Math.round(googleMetrics.f1 * 100)
        },
        matched: googleMetrics.matched,
        missed: googleMetrics.missed.slice(0, 5)
      });
    }

    // 3. Fetch Reddit
    const redditTrends = await fetchRedditTrends();
    if (redditTrends.length > 0) {
      const redditMetrics = calculateMetrics(ourTrends, redditTrends, 10);

      await supabase.from('trend_accuracy_checks').insert({
        check_time: checkTime,
        source: 'reddit',
        ground_truth_topics: redditTrends,
        ground_truth_count: redditTrends.length,
        our_topics: ourTrends,
        our_count: ourTrends.length,
        matched_topics: redditMetrics.matched,
        matched_count: redditMetrics.matched.length,
        precision_at_10: redditMetrics.precision,
        recall_at_10: redditMetrics.recall,
        f1_at_10: redditMetrics.f1,
        missed_from_ground_truth: redditMetrics.missed,
        unique_to_us: redditMetrics.unique
      });

      results.push({
        source: 'reddit',
        ground_truth_count: redditTrends.length,
        metrics: {
          precision: Math.round(redditMetrics.precision * 100),
          recall: Math.round(redditMetrics.recall * 100),
          f1: Math.round(redditMetrics.f1 * 100)
        },
        matched: redditMetrics.matched,
        missed: redditMetrics.missed.slice(0, 5)
      });
    }

    // 4. Combined metrics
    const combinedGroundTruth = deduplicateTopics([...googleTrends, ...redditTrends]);
    if (combinedGroundTruth.length > 0) {
      const combinedMetrics = calculateMetrics(ourTrends, combinedGroundTruth, 10);

      await supabase.from('trend_accuracy_checks').insert({
        check_time: checkTime,
        source: 'combined',
        ground_truth_topics: combinedGroundTruth,
        ground_truth_count: combinedGroundTruth.length,
        our_topics: ourTrends,
        our_count: ourTrends.length,
        matched_topics: combinedMetrics.matched,
        matched_count: combinedMetrics.matched.length,
        precision_at_10: combinedMetrics.precision,
        recall_at_10: combinedMetrics.recall,
        f1_at_10: combinedMetrics.f1,
        missed_from_ground_truth: combinedMetrics.missed,
        unique_to_us: combinedMetrics.unique
      });

      results.push({
        source: 'combined',
        ground_truth_count: combinedGroundTruth.length,
        metrics: {
          precision: Math.round(combinedMetrics.precision * 100),
          recall: Math.round(combinedMetrics.recall * 100),
          f1: Math.round(combinedMetrics.f1 * 100)
        }
      });
    }

    return new Response(
      JSON.stringify({
        check_time: checkTime,
        our_trends: ourTrends.slice(0, 10),
        results
      }, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Ground truth comparison error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

---

## Step 3: Schedule the Job

```sql
INSERT INTO scheduled_jobs (job_name, job_type, schedule, endpoint, is_active, description)
VALUES
  ('compare_ground_truth', 'audit', '*/15 * * * *',
   '/functions/v1/compare-ground-truth', true,
   'Compare trends against Google Trends and Reddit for accuracy tracking')
ON CONFLICT (job_name) DO UPDATE SET
  is_active = true,
  schedule = EXCLUDED.schedule;
```

---

## Step 4: Add to Config

```toml
# In supabase/config.toml
[functions.compare-ground-truth]
verify_jwt = true
```

---

## Step 5: Create Accuracy Dashboard Query

```sql
-- Daily accuracy report
SELECT
  DATE_TRUNC('day', check_time) as day,
  source,
  ROUND(AVG(precision_at_10) * 100, 1) as avg_precision,
  ROUND(AVG(recall_at_10) * 100, 1) as avg_recall,
  ROUND(AVG(f1_at_10) * 100, 1) as avg_f1,
  COUNT(*) as check_count
FROM trend_accuracy_checks
WHERE check_time > NOW() - INTERVAL '7 days'
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

-- Most commonly missed topics (what should we be covering?)
SELECT
  topic,
  COUNT(*) as miss_count
FROM trend_accuracy_checks,
     LATERAL unnest(missed_from_ground_truth) as topic
WHERE check_time > NOW() - INTERVAL '24 hours'
  AND source = 'combined'
GROUP BY topic
ORDER BY miss_count DESC
LIMIT 20;

-- Topics we have that ground truth doesn't (are we ahead or wrong?)
SELECT
  topic,
  COUNT(*) as unique_count
FROM trend_accuracy_checks,
     LATERAL unnest(unique_to_us) as topic
WHERE check_time > NOW() - INTERVAL '24 hours'
  AND source = 'combined'
GROUP BY topic
ORDER BY unique_count DESC
LIMIT 20;
```

---

## Verification Checklist

- [ ] trend_accuracy_checks table created
- [ ] compare-ground-truth function deployed
- [ ] Google Trends RSS fetching works
- [ ] Reddit JSON API fetching works
- [ ] Fuzzy matching working correctly
- [ ] Metrics being stored
- [ ] Scheduled job running every 15 min
- [ ] Dashboard queries returning data

---

## Accuracy Targets

| Metric | Current | Target | Excellent |
|--------|---------|--------|-----------|
| Precision@10 | ? | >50% | >70% |
| Recall@10 | ? | >40% | >60% |
| F1@10 | ? | >45% | >65% |

---

## Alerting

```sql
-- Create alert if accuracy drops significantly
CREATE OR REPLACE FUNCTION check_accuracy_alert()
RETURNS void AS $$
DECLARE
  recent_f1 NUMERIC;
  previous_f1 NUMERIC;
BEGIN
  -- Get recent F1
  SELECT AVG(f1_at_10) INTO recent_f1
  FROM trend_accuracy_checks
  WHERE check_time > NOW() - INTERVAL '2 hours'
    AND source = 'combined';

  -- Get previous period F1
  SELECT AVG(f1_at_10) INTO previous_f1
  FROM trend_accuracy_checks
  WHERE check_time BETWEEN NOW() - INTERVAL '24 hours' AND NOW() - INTERVAL '2 hours'
    AND source = 'combined';

  -- Alert if dropped by >20%
  IF previous_f1 > 0 AND (previous_f1 - recent_f1) / previous_f1 > 0.2 THEN
    INSERT INTO system_alerts (alert_type, severity, message, context)
    VALUES (
      'trend_accuracy_drop',
      'warning',
      'Trend accuracy dropped by ' || ROUND((previous_f1 - recent_f1) / previous_f1 * 100) || '%',
      jsonb_build_object('recent_f1', recent_f1, 'previous_f1', previous_f1)
    );
  END IF;
END;
$$ LANGUAGE plpgsql;
```

---

## Next Steps

After implementing ground truth integration:

1. **Monitor accuracy** for 1-2 days
2. **Analyze missed trends** - what patterns are we missing?
3. **Tune detection** based on findings
4. **Add more sources** (Twitter via Twikit if needed)

---

## Summary

This completes the implementation agent series:
- **Agent 28:** Deduplication - eliminates duplicate trends
- **Agent 29:** Twitter-like UX - shows articles prominently
- **Agent 30:** Ground truth - tracks accuracy over time

Combined with the audit agents (20-27), this provides a comprehensive system for ensuring trend quality and accuracy.
