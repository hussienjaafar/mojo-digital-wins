# Filter Bubble & Diversity Auditor

**Role:** Algorithm Auditor / Fairness Researcher
**Audit Type:** Recommendation System Fairness
**Reference:** [ACM FAccT 2025 - Political Exposure Bias](https://dl.acm.org/doi/10.1145/3715275.3732159), [ACM YouTube Misinformation Audits](https://dl.acm.org/doi/10.1145/3568392), [PNAS - Diversity-Accuracy Dilemma](https://www.pnas.org/doi/10.1073/pnas.1000488107)

## Audit Objectives

1. Verify anti-filter-bubble mechanisms work as designed
2. Measure recommendation diversity across policy domains
3. Detect potential echo chamber formation
4. Validate exploration vs. exploitation balance (NEW_OPPORTUNITY vs PROVEN_TOPIC)
5. Check for calibration issues in personalization

## Key Metrics (Based on Research)

### Diversity Metrics
- **KL Divergence:** Measures how recommended distribution differs from ideal/declared distribution
- **Jensen-Shannon Divergence:** Symmetric version of KL divergence
- **Coverage (Cov):** Percentage of available policy domains appearing in recommendations
- **Gini Index:** Measures inequality in domain representation
- **Inter-User Diversity:** How different recommendations are between users

### Calibration Metrics
- **Calibration Score:** Does the ratio of domains in recommendations match declared interests?
- **Over-representation:** Are some domains over-represented vs. user declaration?
- **Under-representation:** Are declared domains being ignored?

## Audit Checklist

### 1. Anti-Filter-Bubble Mechanism Validation

**Files to Examine:**
- `supabase/functions/_shared/trendDiversity.ts`
- `supabase/functions/_shared/orgRelevanceV3.ts`
- `supabase/functions/get-trends-for-org/index.ts`

**Checks:**
- [ ] `ensureDomainDiversity()` guarantees minimum domain coverage
- [ ] NEW_OPPORTUNITY flag correctly identifies unexplored topics
- [ ] Domain diversity is enforced BEFORE truncation to limit
- [ ] Configuration allows tuning diversity requirements
- [ ] Diversity metrics are calculated and logged

**Code Review Questions:**
1. What happens when a user only engages with 1-2 domains? Do they still see others?
2. Is there a minimum diversity threshold that cannot be bypassed?
3. Can the learning system "learn away" a declared interest?

### 2. 70/30 Scoring Split Verification

**Files to Examine:**
- `supabase/functions/_shared/orgRelevanceV3.ts`

**Checks:**
- [ ] Profile-based scoring cannot exceed 70 points
- [ ] Learned affinity scoring cannot exceed 20 points
- [ ] Exploration bonus is capped at 10 points
- [ ] Total score is capped at 100
- [ ] Scoring breakdown is explainable

**Test Scenarios:**
```
Scenario 1: New user with declared domains, no history
- Expected: Profile-based score only, NEW_OPPORTUNITY flags
- Actual: [Run test]

Scenario 2: User with strong affinity in one domain
- Expected: Affinity capped at 20, still see other declared domains
- Actual: [Run test]

Scenario 3: User ignores a declared domain for 30 days
- Expected: Decay kicks in, exploration bonus helps resurface
- Actual: [Run test]
```

### 3. Domain Coverage Analysis

**Validation Queries:**
```sql
-- Calculate domain distribution for a sample org
WITH org_trends AS (
  SELECT
    t.id,
    t.policy_domains,
    r.relevance_score,
    r.is_new_opportunity
  FROM org_trend_relevance_cache r
  JOIN trend_events t ON t.id = r.trend_event_id
  WHERE r.organization_id = '[SAMPLE_ORG_ID]'
  ORDER BY r.relevance_score DESC
  LIMIT 20
)
SELECT
  unnest(policy_domains) as domain,
  COUNT(*) as count,
  AVG(relevance_score) as avg_score,
  SUM(CASE WHEN is_new_opportunity THEN 1 ELSE 0 END) as new_opps
FROM org_trends
GROUP BY domain
ORDER BY count DESC;

-- Compare to org's declared domains
SELECT policy_domains
FROM org_profiles
WHERE organization_id = '[SAMPLE_ORG_ID]';
```

**Expected Outcomes:**
- All declared domains should appear in top 20 recommendations
- No single domain should exceed 40% of recommendations
- NEW_OPPORTUNITY should be 15-30% of recommendations

### 4. Decay Mechanism Effectiveness

**Files to Examine:**
- `supabase/functions/decay-stale-affinities/index.ts`

**Checks:**
- [ ] Decay rate (5% per week) prevents permanent lock-in
- [ ] Minimum score (0.3) prevents complete erasure of learned topics
- [ ] Stale threshold (30 days) is reasonable
- [ ] Decay only affects learned affinities, not declared interests
- [ ] Decay runs on schedule

**Validation Query:**
```sql
-- Check affinity score distribution
SELECT
  CASE
    WHEN affinity_score >= 0.8 THEN 'high (0.8+)'
    WHEN affinity_score >= 0.5 THEN 'medium (0.5-0.8)'
    ELSE 'low (<0.5)'
  END as bucket,
  COUNT(*) as count,
  AVG(times_used) as avg_uses,
  AVG(EXTRACT(EPOCH FROM (NOW() - last_used_at)) / 86400) as avg_days_stale
FROM org_topic_affinities
WHERE source = 'learned_outcome'
GROUP BY bucket
ORDER BY bucket;
```

### 5. Filter Log Analysis

**Files to Examine:**
- `supabase/functions/get-trends-for-org/index.ts` (logFilteredTrends function)
- Database table: `trend_filter_log`

**Checks:**
- [ ] Filtered trends are logged for transparency
- [ ] Filter reasons are meaningful
- [ ] Log retention is appropriate (30 days)
- [ ] No legitimate trends are systematically filtered

**Validation Query:**
```sql
-- Analyze what's being filtered out
SELECT
  filter_reason,
  COUNT(*) as filtered_count,
  AVG(relevance_score) as avg_score,
  COUNT(DISTINCT organization_id) as orgs_affected
FROM trend_filter_log
WHERE logged_at > NOW() - INTERVAL '7 days'
GROUP BY filter_reason
ORDER BY filtered_count DESC;

-- Check for systematic domain exclusion
SELECT
  unnest(matched_domains) as domain,
  COUNT(*) as times_filtered,
  AVG(relevance_score) as avg_score
FROM trend_filter_log
WHERE logged_at > NOW() - INTERVAL '7 days'
GROUP BY domain
ORDER BY times_filtered DESC;
```

### 6. Echo Chamber Detection Tests

**Methodology:** Simulate user behavior patterns and check for echo chamber formation

**Test Cases:**

**Test 1: Single-Domain User**
```
Setup: User declares 5 domains but only engages with "Healthcare"
After 4 weeks: Check if they still see the other 4 domains
Expected: Yes, due to anti-filter-bubble mechanisms
```

**Test 2: Extreme Affinity**
```
Setup: User has 0.95 affinity to "Immigration"
Expected: Immigration trends get +19 points max (capped at 20)
Expected: Other declared domains still appear in top 15
```

**Test 3: Cold Start Diversity**
```
Setup: New user with no history
Expected: Recommendations span all declared domains
Expected: NEW_OPPORTUNITY flags encourage exploration
```

## Findings Template

### Finding: [TITLE]
**Severity:** CRITICAL | HIGH | MEDIUM | LOW | INFO
**Category:** Filter Bubble Risk | Diversity Gap | Calibration Issue
**File:** `path/to/file.ts:line`

**Metric Impact:**
- KL Divergence: [expected vs actual]
- Coverage: [expected vs actual]

**Description:**
[What was found]

**User Impact:**
[How this affects end users' information diet]

**Recommendation:**
[Specific fix with diversity metrics to target]

---

## Red Flags to Watch For

1. **Single domain exceeding 50% of recommendations** - Echo chamber risk
2. **Declared domains with 0 representation** - Anti-filter-bubble failure
3. **NEW_OPPORTUNITY < 10%** - Exploration suppressed
4. **Affinity scores clustering at 0.95** - Learning system not decaying
5. **Same trends appearing for all orgs** - Personalization failure
6. **Filter log showing systematic domain exclusion** - Algorithmic bias

## Audit Execution Instructions

1. Select 5-10 diverse organizations for testing
2. Calculate diversity metrics for each
3. Run simulation tests for echo chamber detection
4. Analyze filter logs for systematic issues
5. Compare actual vs. declared domain distributions
6. Document all findings with metric evidence
7. Recommend specific thresholds/parameters to adjust
