# Scoring Algorithm Auditor

**Agent ID:** 25
**Role:** Data Science / Algorithm Analyst
**Focus:** Validate the trend scoring algorithm accuracy
**Priority:** MEDIUM
**Estimated Time:** 1-2 hours

---

## Overview

This agent audits the trend scoring algorithm to ensure:
1. High-quality trends get high scores
2. Low-quality trends get low scores
3. Scoring components are weighted correctly
4. No scoring bugs or edge cases

---

## Current Scoring Algorithm

**Location:** `supabase/functions/detect-trend-events/index.ts`

### Scoring Formula:

```
Raw Score = Velocity (0-50) + Corroboration (0-30) + Activity (0-20)

Final Score = Raw Score × Recency Decay × Evergreen Penalty × Label Quality × Context Penalty

Where:
- Velocity = min(50, max(0, z_score_velocity * 5)) × baseline_quality
- Corroboration = cross_source_bonus + tier_bonus
- Activity = log_scaled(current_mentions)
- Recency Decay = 0.3-1.0 (newer = higher)
- Evergreen Penalty = 0.15-1.0 (evergreen = lower)
- Label Quality = 0.35-1.0 (event_phrase = higher)
- Context Penalty = 0.5-1.0 (entity_only = lower)
```

---

## Audit Queries

### Query 1: Score Distribution Analysis

```sql
-- Analyze the distribution of confidence scores
SELECT
  CASE
    WHEN confidence_score >= 90 THEN 'A+: 90-100 (Exceptional)'
    WHEN confidence_score >= 80 THEN 'A: 80-89 (Excellent)'
    WHEN confidence_score >= 70 THEN 'B: 70-79 (Good)'
    WHEN confidence_score >= 60 THEN 'C: 60-69 (Fair)'
    WHEN confidence_score >= 50 THEN 'D: 50-59 (Marginal)'
    WHEN confidence_score >= 40 THEN 'E: 40-49 (Weak)'
    ELSE 'F: <40 (Poor)'
  END as score_tier,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as percentage,
  ROUND(AVG(z_score_velocity), 2) as avg_velocity,
  ROUND(AVG(source_count), 1) as avg_sources
FROM trend_events
WHERE is_trending = true
  AND last_seen_at > NOW() - INTERVAL '24 hours'
GROUP BY 1
ORDER BY 1;
```

**Expected Distribution:**
- A+ (90-100): <5% (only exceptional trends)
- A (80-89): 10-15%
- B (70-79): 20-30%
- C (60-69): 25-35%
- D-F (<60): 20-30%

---

### Query 2: Scoring Component Breakdown

```sql
-- Analyze individual scoring components
SELECT
  event_title,
  confidence_score,
  z_score_velocity,
  -- Estimate velocity component (0-50)
  LEAST(50, GREATEST(0, z_score_velocity * 5)) as velocity_component_est,
  source_count,
  news_source_count,
  social_source_count,
  -- Corroboration indicators
  CASE
    WHEN news_source_count > 0 AND social_source_count > 0 THEN 'NEWS+SOCIAL'
    WHEN news_source_count > 0 THEN 'NEWS ONLY'
    WHEN social_source_count > 0 THEN 'SOCIAL ONLY'
    ELSE 'UNKNOWN'
  END as source_mix,
  is_event_phrase,
  label_quality,
  -- Extract penalties from confidence_factors if available
  confidence_factors->>'evergreen_penalty' as evergreen_penalty,
  confidence_factors->>'label_quality_penalty' as label_penalty
FROM trend_events
WHERE is_trending = true
  AND last_seen_at > NOW() - INTERVAL '24 hours'
ORDER BY confidence_score DESC
LIMIT 30;
```

---

### Query 3: High Score, Low Quality Detection (False Positives)

```sql
-- Find trends with high scores but low quality indicators
SELECT
  event_title,
  confidence_score,
  z_score_velocity,
  source_count,
  is_event_phrase,
  label_quality,
  array_length(string_to_array(event_title, ' '), 1) as word_count,
  'INVESTIGATE: High score but potential quality issues' as flag
FROM trend_events
WHERE is_trending = true
  AND last_seen_at > NOW() - INTERVAL '24 hours'
  AND confidence_score >= 70
  AND (
    -- Quality issues
    label_quality = 'entity_only'
    OR array_length(string_to_array(event_title, ' '), 1) = 1
    OR source_count < 3
    OR z_score_velocity < 1.5
  )
ORDER BY confidence_score DESC;
```

**Expected:** 0 results. High-scoring trends should have high quality.

---

### Query 4: Low Score, High Quality Detection (False Negatives)

```sql
-- Find trends with low scores but high quality indicators
SELECT
  event_title,
  confidence_score,
  z_score_velocity,
  source_count,
  is_event_phrase,
  label_quality,
  'INVESTIGATE: Low score but high quality indicators' as flag
FROM trend_events
WHERE is_trending = true
  AND last_seen_at > NOW() - INTERVAL '24 hours'
  AND confidence_score < 50
  AND (
    -- Quality indicators
    z_score_velocity >= 3
    OR source_count >= 5
    OR (is_event_phrase = true AND source_count >= 3)
  )
ORDER BY z_score_velocity DESC;
```

**Expected:** Few results. High-quality trends should score well.

---

### Query 5: Velocity vs Score Correlation

```sql
-- Check correlation between velocity and final score
SELECT
  CASE
    WHEN z_score_velocity >= 5 THEN 'Extreme (5+)'
    WHEN z_score_velocity >= 3 THEN 'High (3-5)'
    WHEN z_score_velocity >= 2 THEN 'Moderate (2-3)'
    WHEN z_score_velocity >= 1 THEN 'Low (1-2)'
    ELSE 'Minimal (<1)'
  END as velocity_tier,
  COUNT(*) as count,
  ROUND(AVG(confidence_score), 1) as avg_score,
  ROUND(MIN(confidence_score), 1) as min_score,
  ROUND(MAX(confidence_score), 1) as max_score,
  ROUND(STDDEV(confidence_score), 1) as score_stddev
FROM trend_events
WHERE is_trending = true
  AND last_seen_at > NOW() - INTERVAL '24 hours'
GROUP BY 1
ORDER BY
  CASE
    WHEN z_score_velocity >= 5 THEN 1
    WHEN z_score_velocity >= 3 THEN 2
    WHEN z_score_velocity >= 2 THEN 3
    WHEN z_score_velocity >= 1 THEN 4
    ELSE 5
  END;
```

**Expected:**
- Extreme velocity (5+) → Avg score 70-90
- High velocity (3-5) → Avg score 60-80
- Moderate velocity (2-3) → Avg score 50-70
- Low velocity (1-2) → Avg score 40-60

---

### Query 6: Source Count vs Score Correlation

```sql
-- Check correlation between source count and score
SELECT
  CASE
    WHEN source_count >= 10 THEN '10+ sources'
    WHEN source_count >= 5 THEN '5-9 sources'
    WHEN source_count >= 3 THEN '3-4 sources'
    WHEN source_count = 2 THEN '2 sources'
    ELSE '1 source'
  END as source_tier,
  COUNT(*) as count,
  ROUND(AVG(confidence_score), 1) as avg_score,
  ROUND(AVG(z_score_velocity), 2) as avg_velocity
FROM trend_events
WHERE is_trending = true
  AND last_seen_at > NOW() - INTERVAL '24 hours'
GROUP BY 1
ORDER BY
  CASE
    WHEN source_count >= 10 THEN 1
    WHEN source_count >= 5 THEN 2
    WHEN source_count >= 3 THEN 3
    WHEN source_count = 2 THEN 4
    ELSE 5
  END;
```

---

### Query 7: Label Quality Impact on Score

```sql
-- Check how label quality affects final score
SELECT
  COALESCE(label_quality, 'unknown') as label_quality,
  is_event_phrase,
  COUNT(*) as count,
  ROUND(AVG(confidence_score), 1) as avg_score,
  ROUND(AVG(z_score_velocity), 2) as avg_velocity,
  ROUND(AVG(source_count), 1) as avg_sources
FROM trend_events
WHERE is_trending = true
  AND last_seen_at > NOW() - INTERVAL '24 hours'
GROUP BY 1, 2
ORDER BY avg_score DESC;
```

**Expected:** Event phrases should score ~20-30% higher than entity-only

---

### Query 8: Penalty Application Verification

```sql
-- Verify penalties are being applied correctly
SELECT
  event_title,
  confidence_score,
  z_score_velocity,
  -- Check if penalties exist in confidence_factors
  confidence_factors IS NOT NULL as has_factors,
  confidence_factors->>'evergreen_penalty' as evergreen_penalty,
  confidence_factors->>'recency_decay' as recency_decay,
  confidence_factors->>'label_quality_penalty' as label_penalty,
  confidence_factors->>'context_penalty' as context_penalty,
  -- Verify penalty application
  CASE
    WHEN LOWER(event_title) LIKE '%trump%'
      AND (confidence_factors->>'evergreen_penalty')::float >= 1.0
    THEN '❌ EVERGREEN PENALTY NOT APPLIED'
    WHEN label_quality = 'entity_only'
      AND (confidence_factors->>'label_quality_penalty')::float >= 1.0
    THEN '❌ LABEL PENALTY NOT APPLIED'
    ELSE '✅ OK'
  END as penalty_check
FROM trend_events
WHERE is_trending = true
  AND last_seen_at > NOW() - INTERVAL '24 hours'
  AND (
    LOWER(event_title) LIKE '%trump%'
    OR LOWER(event_title) LIKE '%biden%'
    OR label_quality = 'entity_only'
  )
ORDER BY confidence_score DESC;
```

---

### Query 9: Score Stability Over Time

```sql
-- Check if scores are stable or fluctuating wildly
SELECT
  event_title,
  confidence_score as current_score,
  LAG(confidence_score) OVER (PARTITION BY event_key ORDER BY last_seen_at) as previous_score,
  confidence_score - LAG(confidence_score) OVER (PARTITION BY event_key ORDER BY last_seen_at) as score_change,
  last_seen_at
FROM trend_events
WHERE last_seen_at > NOW() - INTERVAL '48 hours'
  AND is_trending = true
ORDER BY ABS(confidence_score - LAG(confidence_score) OVER (PARTITION BY event_key ORDER BY last_seen_at)) DESC NULLS LAST
LIMIT 20;
```

---

## Scoring Anomaly Detection

### Anomaly 1: High Score with Single Source

```sql
SELECT event_title, confidence_score, source_count
FROM trend_events
WHERE is_trending = true
  AND confidence_score >= 60
  AND source_count = 1
  AND last_seen_at > NOW() - INTERVAL '24 hours';
```
**Expected:** 0 results

### Anomaly 2: Low Velocity, High Score

```sql
SELECT event_title, confidence_score, z_score_velocity
FROM trend_events
WHERE is_trending = true
  AND confidence_score >= 70
  AND z_score_velocity < 1
  AND last_seen_at > NOW() - INTERVAL '24 hours';
```
**Expected:** 0 results

### Anomaly 3: Entity-Only with High Score

```sql
SELECT event_title, confidence_score, label_quality
FROM trend_events
WHERE is_trending = true
  AND confidence_score >= 60
  AND label_quality = 'entity_only'
  AND last_seen_at > NOW() - INTERVAL '24 hours';
```
**Expected:** 0 results (entity-only should be penalized)

---

## Scoring Algorithm Recommendations

### Current Weights Assessment:

| Component | Current Weight | Recommended | Notes |
|-----------|---------------|-------------|-------|
| Velocity | 0-50 (50%) | Keep | Primary signal |
| Corroboration | 0-30 (30%) | Keep | Important validation |
| Activity | 0-20 (20%) | Keep | Volume indicator |
| Recency Decay | 0.3-1.0 | 0.5-1.0 | Less aggressive decay |
| Evergreen Penalty | 0.15-1.0 | 0.10-0.85 | Stronger for entity-only |
| Label Quality | 0.35-1.0 | 0.30-1.0 | Stronger differentiation |

### Recommended Changes:

1. **Increase entity-only penalty** from 0.35 to 0.25
2. **Require corroboration** for scores >60
3. **Add source diversity bonus** for 3+ unique domains
4. **Cap single-source trends** at 50 max score

---

## Verification Checklist

- [ ] Score distribution follows expected pattern
- [ ] Velocity correlates positively with score
- [ ] Source count correlates positively with score
- [ ] Label quality affects score appropriately
- [ ] Penalties are being applied
- [ ] No high-score anomalies with low quality
- [ ] No low-score anomalies with high quality

---

## Next Agent

After completing this audit, proceed to:
→ `26-drilldown-ux-auditor.md` (Already created - Audit drill-down UX)
