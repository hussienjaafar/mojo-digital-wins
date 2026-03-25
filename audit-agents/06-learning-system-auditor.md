# Learning System Auditor

**Role:** ML Engineer / System Analyst / Feedback Systems Specialist
**Audit Type:** Machine Learning System Quality
**Reference:** [Google ML Best Practices](https://developers.google.com/machine-learning/guides/rules-of-ml), [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework), [ACM Recommender Systems](https://dl.acm.org/doi/10.1145/3568392)

## Audit Objectives

1. Verify affinity learning algorithm correctness
2. Validate decay mechanism effectiveness
3. Detect feedback loop instability or runaway conditions
4. Ensure cold-start handling works properly
5. Check learning system convergence and stability
6. Verify the 70/30 profile-first architecture is maintained

## Learning System Architecture Overview

```
Campaign Outcome → Correlation Detection → Affinity Update → Relevance Scoring
                                              ↓
                                         Decay Function (weekly)
                                              ↓
                                    Trend Recommendations
                                              ↓
                                    User Engagement → Campaign Outcome (loop)
```

**Key Parameters:**
- EMA Alpha: 0.3 (30% new data, 70% existing)
- Affinity min: 0.2, max: 0.95
- Decay rate: 5% per week
- Stale threshold: 30 days
- Profile weight: 70%, Learning weight: 30%

## Audit Checklist

### 1. Affinity Learning Algorithm Audit

**Files to Examine:**
- `supabase/functions/update-org-affinities/index.ts`
- `supabase/functions/correlate-trends-campaigns/index.ts`

**Checks:**
- [ ] EMA formula is correctly implemented
- [ ] Alpha value (0.3) provides smooth learning
- [ ] Affinity scores are bounded (0.2 - 0.95)
- [ ] Learning only happens from valid correlations
- [ ] Performance baseline calculation is fair

**EMA Formula Verification:**
```typescript
// Expected implementation:
const newAffinity = alpha * newValue + (1 - alpha) * oldValue;
// where alpha = 0.3

// Verify in code:
// supabase/functions/update-org-affinities/index.ts
// Look for the affinity update logic
```

**Affinity Update Test Cases:**
```
Test Case 1: First campaign on topic
- Input: No existing affinity, campaign performance = 1.2
- Expected: new affinity = 0.3 * 0.6 + 0.7 * 0.5 = 0.53 (approx)

Test Case 2: Strong existing affinity
- Input: existing = 0.8, campaign performance = 0.5
- Expected: new affinity = 0.3 * 0.25 + 0.7 * 0.8 = 0.635

Test Case 3: Boundary conditions
- Input: existing = 0.95, campaign performance = 1.5
- Expected: capped at 0.95

Test Case 4: Low performance
- Input: existing = 0.5, campaign performance = 0.2
- Expected: min(max(calculated, 0.2), 0.95)
```

**Validation Queries:**
```sql
-- Check affinity score distribution
SELECT
  CASE
    WHEN affinity_score >= 0.9 THEN '0.90-0.95'
    WHEN affinity_score >= 0.8 THEN '0.80-0.89'
    WHEN affinity_score >= 0.6 THEN '0.60-0.79'
    WHEN affinity_score >= 0.4 THEN '0.40-0.59'
    WHEN affinity_score >= 0.2 THEN '0.20-0.39'
    ELSE 'below_min'
  END as bucket,
  COUNT(*) as count
FROM org_topic_affinities
WHERE source = 'learned_outcome'
GROUP BY bucket
ORDER BY bucket;

-- Check for out-of-bounds values (should be 0)
SELECT COUNT(*) as out_of_bounds
FROM org_topic_affinities
WHERE affinity_score < 0.2 OR affinity_score > 0.95;
```

### 2. Decay Mechanism Audit

**Files to Examine:**
- `supabase/functions/decay-stale-affinities/index.ts`

**Checks:**
- [ ] Decay runs on schedule (weekly)
- [ ] Decay rate (5%) is applied correctly
- [ ] Minimum score (0.3) is enforced after decay
- [ ] Stale threshold (30 days) is correct
- [ ] Decay only affects learned affinities, not self-declared
- [ ] Decay creates audit trail

**Decay Formula Verification:**
```typescript
// Expected implementation:
const newScore = Math.max(currentScore * (1 - DECAY_RATE), MIN_SCORE);
// where DECAY_RATE = 0.05 (5%), MIN_SCORE = 0.3

// Example:
// Week 0: 0.8
// Week 1: 0.8 * 0.95 = 0.76
// Week 2: 0.76 * 0.95 = 0.722
// ...
// Week N: converges to 0.3 (minimum)
```

**Decay Effectiveness Test:**
```sql
-- Find affinities that should have decayed but didn't
SELECT
  id,
  organization_id,
  topic,
  affinity_score,
  last_used_at,
  NOW() - last_used_at as days_stale
FROM org_topic_affinities
WHERE source = 'learned_outcome'
  AND last_used_at < NOW() - INTERVAL '30 days'
  AND affinity_score > 0.3
ORDER BY days_stale DESC
LIMIT 20;
-- Expected: Empty or recent entries only

-- Check decay job execution
SELECT
  job_name,
  last_run,
  next_run,
  is_enabled
FROM scheduled_jobs
WHERE function_name = 'decay-stale-affinities';
```

### 3. Feedback Loop Stability Analysis

**Critical:** Learning systems can have runaway feedback loops

**Potential Issues:**
1. **Rich-get-richer:** High-affinity topics get more recommendations → more campaigns → higher affinity
2. **Lock-out:** Low-performing topics never get chances → stay low forever
3. **Oscillation:** Scores swing wildly between high and low
4. **Convergence to extremes:** All scores drift to min or max

**Checks:**
- [ ] Profile-based scoring (70%) prevents learned dominance
- [ ] NEW_OPPORTUNITY flag breaks filter bubbles
- [ ] Decay prevents permanent lock-in
- [ ] Affinity caps (0.95) prevent runaway growth
- [ ] Minimum scores (0.2) prevent total exclusion

**Feedback Loop Metrics:**
```sql
-- Check for "rich-get-richer" effect
-- Organizations with many campaigns should not dominate affinities
WITH org_activity AS (
  SELECT
    organization_id,
    COUNT(DISTINCT id) as campaign_count
  FROM campaign_topic_extractions
  GROUP BY organization_id
)
SELECT
  CASE
    WHEN campaign_count >= 20 THEN 'high_activity'
    WHEN campaign_count >= 5 THEN 'medium_activity'
    ELSE 'low_activity'
  END as activity_level,
  COUNT(DISTINCT o.organization_id) as org_count,
  AVG(a.affinity_score) as avg_affinity,
  MAX(a.affinity_score) as max_affinity
FROM org_activity o
LEFT JOIN org_topic_affinities a ON a.organization_id = o.organization_id
WHERE a.source = 'learned_outcome'
GROUP BY activity_level;
-- Expected: avg_affinity should be similar across activity levels

-- Check for score oscillation (std dev over time)
-- This requires historical data; if not available, monitor going forward
SELECT
  organization_id,
  topic,
  STDDEV(affinity_score) as score_volatility,
  COUNT(*) as update_count
FROM affinity_history  -- (if audit table exists)
GROUP BY organization_id, topic
HAVING STDDEV(affinity_score) > 0.2
ORDER BY score_volatility DESC;
```

**Stability Test Simulation:**
```
Scenario: Organization only engages with Healthcare trends

Week 1: Healthcare affinity = 0.5 (baseline)
Week 2: High performer → affinity rises to 0.65
Week 3: High performer → affinity rises to 0.77
Week 4: High performer → affinity rises to 0.85
Week 5: High performer → affinity caps at 0.95

Impact Check:
- Healthcare gets +19 points from affinity (20 * 0.95)
- Other domains get 0 points from affinity
- BUT profile-based scoring (70 pts max) should still show other domains
- AND NEW_OPPORTUNITY bonus should surface unexplored topics
```

### 4. Cold Start Handling Audit

**Problem:** New organizations have no learned affinities

**Files to Examine:**
- `supabase/functions/_shared/orgRelevanceV3.ts`
- `supabase/functions/get-trends-for-org/index.ts`

**Checks:**
- [ ] New orgs can achieve high relevance scores (60+) without history
- [ ] Profile-based scoring (70%) dominates for new orgs
- [ ] NEW_OPPORTUNITY flag is applied to all topics for new orgs
- [ ] First campaign automatically creates affinities
- [ ] No minimum history requirement to use the system

**Cold Start Test:**
```sql
-- Find new organizations (no affinities yet)
WITH new_orgs AS (
  SELECT DISTINCT o.id
  FROM client_organizations o
  LEFT JOIN org_topic_affinities a ON a.organization_id = o.id
  WHERE a.id IS NULL
)
-- Check their relevance scores
SELECT
  no.id as org_id,
  AVG(r.relevance_score) as avg_score,
  MIN(r.relevance_score) as min_score,
  MAX(r.relevance_score) as max_score,
  COUNT(*) as trend_count,
  SUM(CASE WHEN r.is_new_opportunity THEN 1 ELSE 0 END) as new_opp_count
FROM new_orgs no
JOIN org_trend_relevance_cache r ON r.organization_id = no.id
GROUP BY no.id;

-- Expected:
-- avg_score >= 40 (profile-based scoring should work)
-- new_opp_count > 0 (should get exploration opportunities)
```

### 5. Correlation Quality Audit

**Files to Examine:**
- `supabase/functions/correlate-trends-campaigns/index.ts`

**Checks:**
- [ ] Correlation criteria are sensible (domain overlap, timing)
- [ ] Correlation scores are meaningful
- [ ] Spurious correlations are filtered out
- [ ] Performance baseline is calculated fairly
- [ ] Time window for correlation is appropriate

**Correlation Analysis:**
```sql
-- Check correlation score distribution
SELECT
  CASE
    WHEN correlation_score >= 0.8 THEN 'high (0.8+)'
    WHEN correlation_score >= 0.5 THEN 'medium (0.5-0.8)'
    ELSE 'low (<0.5)'
  END as quality,
  COUNT(*) as count,
  AVG(performance_vs_baseline) as avg_performance
FROM trend_campaign_correlations
GROUP BY quality;

-- Check for suspicious patterns
-- Very high correlation with very low performance = potential issue
SELECT
  trend_event_id,
  campaign_id,
  correlation_score,
  performance_vs_baseline,
  outcome_label
FROM trend_campaign_correlations
WHERE correlation_score > 0.8
  AND performance_vs_baseline < 0.5
LIMIT 20;

-- Time delta analysis
SELECT
  CASE
    WHEN time_delta_hours < 1 THEN '<1h'
    WHEN time_delta_hours < 6 THEN '1-6h'
    WHEN time_delta_hours < 24 THEN '6-24h'
    WHEN time_delta_hours < 72 THEN '1-3 days'
    ELSE '>3 days'
  END as time_bucket,
  COUNT(*) as count,
  AVG(correlation_score) as avg_correlation,
  AVG(performance_vs_baseline) as avg_performance
FROM trend_campaign_correlations
GROUP BY time_bucket
ORDER BY time_bucket;
```

### 6. Learning Rate Analysis

**Checks:**
- [ ] Learning is not too fast (overfitting to recent data)
- [ ] Learning is not too slow (not adapting to changes)
- [ ] EMA alpha (0.3) is appropriate for the use case

**Learning Rate Impact:**
```
Alpha = 0.3 analysis:
- Half-life: ~2 campaigns (50% of old value remains)
- 90% new: ~7 campaigns
- Very responsive to recent performance

Pros: Quick adaptation to changes
Cons: Can overreact to single bad/good campaigns

Alternative consideration:
- Alpha = 0.1: More stable, slower learning (half-life ~7 campaigns)
- Alpha = 0.5: Very responsive, potentially unstable (half-life ~1.4 campaigns)
```

**Learning Speed Test:**
```sql
-- Check how quickly affinities change
-- (requires historical tracking)
SELECT
  organization_id,
  topic,
  times_used,
  affinity_score,
  -- Calculate theoretical range based on times_used
  CASE
    WHEN times_used < 3 THEN 'early_learning'
    WHEN times_used < 10 THEN 'converging'
    ELSE 'stable'
  END as learning_stage
FROM org_topic_affinities
WHERE source = 'learned_outcome'
ORDER BY times_used DESC;
```

### 7. 70/30 Architecture Verification

**Critical:** Ensure learning doesn't dominate profile

**Checks:**
- [ ] Profile scoring caps at 70 points
- [ ] Learned affinity caps at 20 points
- [ ] Exploration bonus caps at 10 points
- [ ] Total relevance never exceeds 100
- [ ] Profile-based scoring is independent of history

**Score Component Analysis:**
```sql
-- Analyze score composition (requires scoring_breakdown to be stored)
-- If not stored, verify in code

-- Check that learned component doesn't exceed 20
SELECT
  organization_id,
  trend_event_id,
  relevance_score,
  -- Parse scoring_breakdown if stored as JSONB
  (scoring_breakdown->>'profile_score')::numeric as profile_component,
  (scoring_breakdown->>'affinity_score')::numeric as affinity_component,
  (scoring_breakdown->>'exploration_bonus')::numeric as exploration_component
FROM org_trend_relevance_cache
WHERE (scoring_breakdown->>'affinity_score')::numeric > 20
LIMIT 10;
-- Expected: Empty result (no violations)
```

## Findings Template

### Finding: [TITLE]
**Severity:** CRITICAL | HIGH | MEDIUM | LOW | INFO
**Category:** Learning Bug | Decay Failure | Feedback Loop | Cold Start | Correlation Issue
**File:** `path/to/file.ts:line`

**Evidence:**
- Query results or logs
- Metrics showing the issue

**Description:**
[What was found in the learning system]

**System Impact:**
[How this affects recommendations and user experience]

**Recommendation:**
[Specific parameter adjustment or code fix]

**Effort:** Low | Medium | High

---

## Red Flags to Watch For

1. **Affinity scores at extremes (0.2 or 0.95)** - Potential runaway or decay issue
2. **New orgs with 0 relevant trends** - Cold start failure
3. **Decay not running** - Filter bubble risk
4. **High activity orgs with much higher avg affinity** - Rich-get-richer effect
5. **Score components exceeding caps** - Architecture violation
6. **Spurious correlations (high correlation, low performance)** - Learning garbage
7. **Oscillating scores** - Feedback instability

## Monitoring Recommendations

Set up ongoing monitoring for:

1. **Daily:** Affinity score distribution (watch for clustering at extremes)
2. **Weekly:** Decay job execution verification
3. **Weekly:** Cold start success rate (new orgs getting recommendations)
4. **Monthly:** Feedback loop metrics (activity vs. affinity correlation)
5. **Monthly:** Learning rate effectiveness (score stability analysis)

## Audit Execution Instructions

1. Verify EMA formula implementation in code
2. Test decay function with manual calculations
3. Run feedback loop analysis queries
4. Create test new org and verify cold start
5. Analyze correlation quality distribution
6. Verify 70/30 architecture in relevance calculation
7. Check for any out-of-bounds affinity values
8. Document all findings with specific data evidence
9. Recommend parameter tuning if needed
10. Propose A/B tests for significant changes
