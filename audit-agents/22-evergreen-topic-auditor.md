# Evergreen Topic Auditor

**Agent ID:** 22
**Role:** Data Quality Analyst
**Focus:** Audit handling of evergreen/always-on topics
**Priority:** HIGH
**Estimated Time:** 1-2 hours

---

## Overview

Evergreen topics like "Donald Trump", "Joe Biden", "Gaza" are constantly in the news. They should only trend when there's a **real spike** (new event), not just because they're always mentioned.

**Problem:** If these topics trend without a spike, the feed is filled with noise and users see the same names repeatedly without learning what's new.

**Solution:** Only show evergreen topics when:
1. There's a significant velocity spike (z_score > 3)
2. The label is an event phrase describing what happened
3. There's corroboration across multiple sources

---

## Current Evergreen List

From `detect-trend-events/index.ts`:

```typescript
const EVERGREEN_ENTITIES: Set<string> = new Set([
  // Political figures
  'trump', 'biden', 'harris', 'obama', 'pelosi', 'mcconnell', 'schumer',
  'musk', 'putin', 'netanyahu', 'zelensky', 'xi jinping', 'vance', 'walz',
  // Government bodies
  'white house', 'pentagon', 'state department', 'justice department',
  'congress', 'senate', 'house', 'supreme court', 'capitol',
  // Geopolitical hotspots
  'gaza', 'israel', 'ukraine', 'russia', 'china', 'taiwan', 'iran',
  'greenland', 'nato', 'eu', 'european union', 'middle east', 'west bank',
  // Recurring topics
  'immigration', 'border', 'economy', 'inflation', 'healthcare', 'climate',
  'taxes', 'election', 'campaign', 'poll', 'polls', 'voter', 'voting',
  'tariffs', 'trade', 'democracy', 'freedom', 'abortion', 'gun', 'guns',
]);
```

---

## Audit Queries

### Query 1: Evergreen Topics Currently Trending

```sql
-- Check which evergreen entities are trending and their spike status
WITH evergreen_list AS (
  SELECT unnest(ARRAY[
    'trump', 'biden', 'harris', 'obama', 'pelosi', 'mcconnell', 'schumer',
    'musk', 'putin', 'netanyahu', 'zelensky', 'vance', 'walz',
    'white house', 'pentagon', 'congress', 'senate', 'house', 'supreme court',
    'gaza', 'israel', 'ukraine', 'russia', 'china', 'taiwan', 'iran', 'greenland',
    'immigration', 'border', 'economy', 'inflation', 'tariffs', 'abortion'
  ]) as entity
)
SELECT
  te.event_title,
  te.z_score_velocity,
  te.baseline_7d,
  te.baseline_30d,
  te.current_24h,
  te.confidence_score,
  te.source_count,
  te.is_event_phrase,
  CASE
    WHEN te.z_score_velocity >= 5 THEN '✅ EXTREME SPIKE - OK to trend'
    WHEN te.z_score_velocity >= 3 THEN '✅ HIGH SPIKE - OK to trend'
    WHEN te.z_score_velocity >= 2 THEN '⚠️ MODERATE - Marginal'
    WHEN te.z_score_velocity >= 1 THEN '❌ LOW SPIKE - Should NOT trend'
    ELSE '❌ NO SPIKE - Should NOT trend'
  END as verdict,
  el.entity as matched_evergreen
FROM trend_events te
JOIN evergreen_list el ON LOWER(te.event_title) LIKE '%' || el.entity || '%'
WHERE te.is_trending = true
  AND te.last_seen_at > NOW() - INTERVAL '24 hours'
ORDER BY te.z_score_velocity ASC;
```

**Expected:** All evergreen topics should have z_score >= 2, preferably >= 3

---

### Query 2: Evergreen Entity-Only Labels (Very Bad)

```sql
-- Single-word evergreen entities that are trending
SELECT
  event_title,
  z_score_velocity,
  confidence_score,
  source_count,
  baseline_7d,
  current_24h,
  CASE
    WHEN z_score_velocity < 3 THEN '❌ SHOULD NOT TREND - No significant spike'
    WHEN z_score_velocity >= 5 THEN '⚠️ OK - Extreme spike justifies'
    ELSE '⚠️ REVIEW - Moderate spike'
  END as verdict
FROM trend_events
WHERE is_trending = true
  AND last_seen_at > NOW() - INTERVAL '24 hours'
  AND array_length(string_to_array(event_title, ' '), 1) = 1
  AND LOWER(event_title) IN (
    'trump', 'biden', 'harris', 'gaza', 'israel', 'musk', 'ukraine',
    'russia', 'china', 'iran', 'greenland', 'taiwan', 'netanyahu'
  )
ORDER BY z_score_velocity ASC;
```

**Expected:** 0 results. Single-word evergreen entities should NOT trend.

---

### Query 3: Evergreen Penalty Effectiveness

```sql
-- Check if evergreen penalties are being applied
SELECT
  event_title,
  z_score_velocity,
  confidence_score,
  confidence_factors->>'evergreen_penalty' as evergreen_penalty_applied,
  confidence_factors->>'label_quality_penalty' as label_penalty,
  is_event_phrase,
  CASE
    WHEN confidence_factors->>'evergreen_penalty' IS NOT NULL
      AND (confidence_factors->>'evergreen_penalty')::float < 1.0
    THEN '✅ Penalty Applied'
    ELSE '❌ No Penalty'
  END as penalty_status
FROM trend_events
WHERE is_trending = true
  AND last_seen_at > NOW() - INTERVAL '24 hours'
  AND (
    LOWER(event_title) LIKE '%trump%' OR
    LOWER(event_title) LIKE '%biden%' OR
    LOWER(event_title) LIKE '%gaza%' OR
    LOWER(event_title) LIKE '%israel%' OR
    LOWER(event_title) LIKE '%ukraine%'
  )
ORDER BY confidence_score DESC;
```

---

### Query 4: Event Phrases vs Entity-Only for Evergreen

```sql
-- Compare event phrases vs entity-only for the same evergreen topic
WITH evergreen_trends AS (
  SELECT
    event_title,
    CASE
      WHEN LOWER(event_title) LIKE '%trump%' THEN 'Trump'
      WHEN LOWER(event_title) LIKE '%biden%' THEN 'Biden'
      WHEN LOWER(event_title) LIKE '%gaza%' THEN 'Gaza'
      WHEN LOWER(event_title) LIKE '%israel%' THEN 'Israel'
      WHEN LOWER(event_title) LIKE '%ukraine%' THEN 'Ukraine'
      WHEN LOWER(event_title) LIKE '%musk%' THEN 'Musk'
      ELSE 'Other'
    END as entity_group,
    is_event_phrase,
    confidence_score,
    z_score_velocity,
    source_count
  FROM trend_events
  WHERE is_trending = true
    AND last_seen_at > NOW() - INTERVAL '24 hours'
    AND (
      LOWER(event_title) LIKE '%trump%' OR
      LOWER(event_title) LIKE '%biden%' OR
      LOWER(event_title) LIKE '%gaza%' OR
      LOWER(event_title) LIKE '%israel%' OR
      LOWER(event_title) LIKE '%ukraine%' OR
      LOWER(event_title) LIKE '%musk%'
    )
)
SELECT
  entity_group,
  COUNT(*) as total_trends,
  COUNT(*) FILTER (WHERE is_event_phrase = true) as event_phrases,
  COUNT(*) FILTER (WHERE is_event_phrase = false) as entity_only,
  ROUND(AVG(confidence_score), 1) as avg_confidence,
  ROUND(AVG(z_score_velocity), 2) as avg_velocity
FROM evergreen_trends
GROUP BY entity_group
ORDER BY total_trends DESC;
```

**Expected:** Entity-only count should be 0 or near 0 for each group.

---

### Query 5: Baseline Stability Check (Evergreen Detection)

```sql
-- Topics with high, stable baselines are evergreen
SELECT
  event_title,
  baseline_7d,
  baseline_30d,
  ROUND(ABS(baseline_7d - baseline_30d) / NULLIF(baseline_30d, 0), 3) as stability_ratio,
  z_score_velocity,
  is_trending,
  CASE
    WHEN baseline_30d >= 2 AND ABS(baseline_7d - baseline_30d) / NULLIF(baseline_30d, 0) < 0.3
    THEN '✅ Detected as Evergreen (high stable baseline)'
    WHEN baseline_30d >= 1 AND ABS(baseline_7d - baseline_30d) / NULLIF(baseline_30d, 0) < 0.5
    THEN '⚠️ Possibly Evergreen'
    ELSE '❌ Not Evergreen'
  END as evergreen_detection
FROM trend_events
WHERE last_seen_at > NOW() - INTERVAL '24 hours'
  AND baseline_30d > 0
ORDER BY baseline_30d DESC
LIMIT 50;
```

---

### Query 6: Evergreen Trending Summary

```sql
-- Summary of evergreen topic handling
WITH evergreen_check AS (
  SELECT
    CASE
      WHEN LOWER(event_title) LIKE '%trump%' OR LOWER(event_title) LIKE '%biden%'
        OR LOWER(event_title) LIKE '%harris%' OR LOWER(event_title) LIKE '%musk%'
        OR LOWER(event_title) LIKE '%gaza%' OR LOWER(event_title) LIKE '%israel%'
        OR LOWER(event_title) LIKE '%ukraine%' OR LOWER(event_title) LIKE '%russia%'
      THEN true ELSE false
    END as is_evergreen,
    z_score_velocity,
    is_event_phrase,
    confidence_score
  FROM trend_events
  WHERE is_trending = true
    AND last_seen_at > NOW() - INTERVAL '24 hours'
)
SELECT
  'Total Trending' as metric,
  COUNT(*)::text as value
FROM evergreen_check

UNION ALL

SELECT
  'Evergreen Topics Trending',
  COUNT(*) FILTER (WHERE is_evergreen)::text
FROM evergreen_check

UNION ALL

SELECT
  'Evergreen Without Spike (z<2) ⚠️',
  COUNT(*) FILTER (WHERE is_evergreen AND z_score_velocity < 2)::text
FROM evergreen_check

UNION ALL

SELECT
  'Evergreen Entity-Only ⚠️',
  COUNT(*) FILTER (WHERE is_evergreen AND NOT is_event_phrase)::text
FROM evergreen_check

UNION ALL

SELECT
  'Evergreen Rate (%)',
  ROUND(100.0 * COUNT(*) FILTER (WHERE is_evergreen) / NULLIF(COUNT(*), 0), 1)::text
FROM evergreen_check

UNION ALL

SELECT
  'Evergreen Problem Rate (%)',
  ROUND(100.0 * COUNT(*) FILTER (WHERE is_evergreen AND (z_score_velocity < 2 OR NOT is_event_phrase)) / NULLIF(COUNT(*) FILTER (WHERE is_evergreen), 0), 1)::text
FROM evergreen_check;
```

---

## Evergreen Handling Rules

### Current System Rules:
1. **Explicit list check** - EVERGREEN_ENTITIES set
2. **Heuristic detection** - High stable baseline (30d >= 2, stability < 30%)
3. **Penalty system** - 0.15-0.85x multiplier based on z-score

### Recommended Rules:

| Scenario | Z-Score | Label Type | Should Trend? |
|----------|---------|------------|---------------|
| Trump | < 2 | Entity-only | ❌ No |
| Trump | < 2 | Event phrase | ❌ No (no spike) |
| Trump | 2-3 | Entity-only | ❌ No (vague) |
| Trump | 2-3 | Event phrase | ⚠️ Maybe |
| Trump | > 3 | Entity-only | ⚠️ Maybe (extreme) |
| Trump | > 3 | Event phrase | ✅ Yes |
| Trump Fires FBI Director | > 2 | Event phrase | ✅ Yes |

---

## Remediation Actions

### If Evergreen Entity-Only Trending:
1. Increase single-word evergreen penalty to 0.10
2. Require z_score > 5 for single-word evergreen
3. Auto-suppress in UI filter

### If Evergreen Without Spike:
1. Review z_score calculation
2. Check baseline calculation accuracy
3. Increase spike threshold for evergreen

### If Event Phrases About Evergreen Not Trending:
1. Reduce penalty for event phrases
2. Event phrase + z_score > 2 = OK to trend
3. Distinguish "Trump" from "Trump Fires Director"

---

## Verification Checklist

- [ ] Single-word evergreen entities trending = 0
- [ ] Evergreen without spike (z<2) = 0
- [ ] Evergreen entity-only rate < 10%
- [ ] Event phrases about evergreen topics are trending appropriately
- [ ] Penalty system is working (penalties visible in confidence_factors)

---

## Next Agent

After completing this audit, proceed to:
→ `23-ground-truth-comparator.md` (Compare against external trend sources)
