# Trend Quality Auditor

**Agent ID:** 20
**Role:** Data Quality Analyst
**Focus:** Identify low-quality, noisy, or meaningless trends
**Priority:** CRITICAL
**Estimated Time:** 1-2 hours

---

## Overview

This agent audits the quality of trends currently showing in the system. It identifies:
1. Entity-only labels (e.g., "Donald Trump" without context)
2. Noise trends (generic terms that shouldn't trend)
3. Low-source-count trends (potentially unreliable)
4. Single-word entities (vague, non-actionable)

---

## Audit Queries

### Query 1: Label Quality Distribution

```sql
-- Analyze the distribution of label quality types
SELECT
  CASE
    WHEN is_event_phrase = true THEN 'event_phrase'
    WHEN array_length(string_to_array(event_title, ' '), 1) = 1 THEN 'single_word_entity'
    WHEN array_length(string_to_array(event_title, ' '), 1) = 2 THEN 'two_word_phrase'
    WHEN event_title ~* '\b(passes|blocks|signs|announces|launches|faces|wins|loses|approves|rejects|fires|nominates)\b' THEN 'action_phrase'
    ELSE 'multi_word_generic'
  END as label_type,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as percentage,
  ROUND(AVG(confidence_score), 1) as avg_confidence,
  ROUND(AVG(z_score_velocity), 2) as avg_velocity
FROM trend_events
WHERE is_trending = true
  AND last_seen_at > NOW() - INTERVAL '24 hours'
GROUP BY 1
ORDER BY count DESC;
```

**Expected Results:**
| label_type | target_percentage |
|------------|-------------------|
| event_phrase / action_phrase | >50% |
| single_word_entity | <15% |
| two_word_phrase | <20% |
| multi_word_generic | <15% |

---

### Query 2: Single-Word Entity Trends (Bad)

```sql
-- These should NOT be trending unless with very high velocity
SELECT
  event_title,
  confidence_score,
  z_score_velocity,
  source_count,
  baseline_7d,
  current_24h,
  CASE
    WHEN z_score_velocity >= 5 THEN 'EXTREME SPIKE - OK'
    WHEN z_score_velocity >= 3 THEN 'HIGH SPIKE - OK'
    WHEN z_score_velocity >= 2 THEN 'MODERATE - MARGINAL'
    ELSE 'NO SPIKE - SHOULD NOT TREND'
  END as verdict
FROM trend_events
WHERE is_trending = true
  AND last_seen_at > NOW() - INTERVAL '24 hours'
  AND array_length(string_to_array(event_title, ' '), 1) = 1
ORDER BY z_score_velocity ASC
LIMIT 30;
```

**Action Items:**
- Single-word entities with z_score < 2 → Increase evergreen penalty
- Single-word entities with z_score >= 3 → OK to trend

---

### Query 3: Noise/Generic Term Detection

```sql
-- Find trends that are generic/noise terms
WITH noise_patterns AS (
  SELECT unnest(ARRAY[
    -- Generic news terms
    'video', 'thread', 'report', 'update', 'news', 'breaking', 'live',
    'watch', 'opinion', 'editorial', 'analysis', 'commentary',
    -- Generic political terms
    'politics', 'political', 'government', 'democracy', 'freedom',
    'america', 'american', 'congress', 'senate', 'house',
    -- Generic actions
    'says', 'said', 'claims', 'calls', 'asks', 'announces',
    -- Social media noise
    'tweet', 'retweet', 'post', 'share', 'like', 'comment'
  ]) as noise_term
)
SELECT
  te.event_title,
  te.confidence_score,
  te.source_count,
  np.noise_term as matched_noise
FROM trend_events te
JOIN noise_patterns np ON LOWER(te.event_title) = np.noise_term
                       OR LOWER(te.event_title) LIKE '%' || np.noise_term || '%'
WHERE te.is_trending = true
  AND te.last_seen_at > NOW() - INTERVAL '24 hours'
ORDER BY te.confidence_score DESC;
```

**Expected:** 0 results. Any matches = blocklist failure.

---

### Query 4: Low-Source Trends (Unreliable)

```sql
-- Trends with very few sources may be unreliable
SELECT
  event_title,
  source_count,
  news_source_count,
  social_source_count,
  confidence_score,
  z_score_velocity,
  CASE
    WHEN source_count = 1 THEN 'SINGLE SOURCE - HIGH RISK'
    WHEN source_count = 2 THEN 'TWO SOURCES - MODERATE RISK'
    WHEN news_source_count = 0 THEN 'SOCIAL ONLY - VERIFY'
    ELSE 'MULTI-SOURCE - OK'
  END as reliability
FROM trend_events
WHERE is_trending = true
  AND last_seen_at > NOW() - INTERVAL '24 hours'
  AND source_count <= 2
ORDER BY source_count ASC, confidence_score DESC;
```

**Action Items:**
- Single-source trends should have lower confidence
- News-only or social-only trends are less reliable

---

### Query 5: Actionability Score

```sql
-- Can political orgs act on these trends?
SELECT
  event_title,
  confidence_score,
  CASE
    -- High actionability: specific events with entities
    WHEN is_event_phrase = true
         AND (array_length(politicians_mentioned, 1) > 0
              OR array_length(legislation_mentioned, 1) > 0) THEN 'HIGH - Specific Event'
    -- Medium: has policy domain
    WHEN array_length(policy_domains, 1) > 0 THEN 'MEDIUM - Policy Related'
    -- Low: entity only, no event
    WHEN array_length(string_to_array(event_title, ' '), 1) = 1 THEN 'LOW - Entity Only'
    -- Minimal: generic
    ELSE 'MINIMAL - Generic'
  END as actionability,
  COALESCE(policy_domains[1], 'none') as primary_domain,
  COALESCE(politicians_mentioned[1], 'none') as primary_politician
FROM trend_events
WHERE is_trending = true
  AND last_seen_at > NOW() - INTERVAL '24 hours'
ORDER BY
  CASE
    WHEN is_event_phrase = true AND array_length(politicians_mentioned, 1) > 0 THEN 1
    WHEN array_length(policy_domains, 1) > 0 THEN 2
    ELSE 3
  END,
  confidence_score DESC
LIMIT 50;
```

---

### Query 6: Quality Score Summary

```sql
-- Overall quality metrics
SELECT
  'Total Trending' as metric,
  COUNT(*)::text as value
FROM trend_events
WHERE is_trending = true AND last_seen_at > NOW() - INTERVAL '24 hours'

UNION ALL

SELECT
  'Event Phrases (%)',
  ROUND(100.0 * COUNT(*) FILTER (WHERE is_event_phrase = true) / NULLIF(COUNT(*), 0), 1)::text
FROM trend_events
WHERE is_trending = true AND last_seen_at > NOW() - INTERVAL '24 hours'

UNION ALL

SELECT
  'Single-Word Entities (%)',
  ROUND(100.0 * COUNT(*) FILTER (WHERE array_length(string_to_array(event_title, ' '), 1) = 1) / NULLIF(COUNT(*), 0), 1)::text
FROM trend_events
WHERE is_trending = true AND last_seen_at > NOW() - INTERVAL '24 hours'

UNION ALL

SELECT
  'Multi-Source Trends (%)',
  ROUND(100.0 * COUNT(*) FILTER (WHERE source_count >= 3) / NULLIF(COUNT(*), 0), 1)::text
FROM trend_events
WHERE is_trending = true AND last_seen_at > NOW() - INTERVAL '24 hours'

UNION ALL

SELECT
  'Avg Confidence Score',
  ROUND(AVG(confidence_score), 1)::text
FROM trend_events
WHERE is_trending = true AND last_seen_at > NOW() - INTERVAL '24 hours'

UNION ALL

SELECT
  'High Confidence (>=70) Count',
  COUNT(*)::text
FROM trend_events
WHERE is_trending = true
  AND last_seen_at > NOW() - INTERVAL '24 hours'
  AND confidence_score >= 70;
```

---

## Quality Thresholds

| Metric | Poor | Acceptable | Good |
|--------|------|------------|------|
| Event phrases % | <30% | 30-50% | >50% |
| Single-word entities % | >25% | 15-25% | <15% |
| Noise terms | >0 | 0 | 0 |
| Multi-source trends % | <50% | 50-70% | >70% |
| Avg confidence | <40 | 40-60 | >60 |

---

## Remediation Actions

### If Single-Word Entities Too High:
1. Increase `EVERGREEN_ENTITIES` list
2. Strengthen single-word entity penalty in scoring
3. Require z_score > 3 for single-word trends

### If Noise Terms Appearing:
1. Add to `TOPIC_BLOCKLIST`
2. Enhance extraction validation
3. Add post-processing filter

### If Low-Source Trends High:
1. Increase minimum source threshold
2. Add corroboration requirement
3. Lower confidence for single-source

---

## Verification Checklist

- [ ] Event phrases > 50% of trending
- [ ] Single-word entities < 15%
- [ ] Zero noise terms trending
- [ ] Multi-source trends > 70%
- [ ] Average confidence > 50

---

## Next Agent

After completing this audit, proceed to:
→ `21-duplicate-detector-auditor.md` (Find duplicate/similar trends)
