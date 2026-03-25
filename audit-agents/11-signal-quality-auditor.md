# Signal Quality & Intelligence Auditor

**Role:** Data Scientist / Intelligence Analyst
**Focus:** Signal accuracy, actionability, false positive rates
**Priority:** HIGH

---

## Overview

A political intelligence platform is only as valuable as the quality of its signals. This auditor evaluates whether the trends and alerts surfaced are genuinely actionable, accurate, and relevant for political campaigns and advocacy organizations.

---

## Intelligence Quality Dimensions

### 1. Accuracy
Are the trends real and correctly identified?

### 2. Relevance
Are the signals relevant to the user's mission?

### 3. Actionability
Can users take meaningful action based on the signal?

### 4. Timeliness
Are signals surfaced while still actionable?

### 5. Signal-to-Noise Ratio
How much valuable signal vs. noise?

---

## Audit Checklist

### 1. Trend Confidence Distribution

```sql
-- Confidence score distribution
SELECT
  CASE
    WHEN confidence_score >= 90 THEN '90-100 (Very High)'
    WHEN confidence_score >= 70 THEN '70-89 (High)'
    WHEN confidence_score >= 50 THEN '50-69 (Medium)'
    WHEN confidence_score >= 30 THEN '30-49 (Low)'
    ELSE '0-29 (Very Low)'
  END as confidence_tier,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as percentage
FROM trend_events
WHERE last_seen_at > NOW() - INTERVAL '24 hours'
GROUP BY confidence_tier
ORDER BY confidence_tier DESC;
```

**Expected Distribution:**
- Very High (90+): 5-15%
- High (70-89): 15-30%
- Medium (50-69): 30-40%
- Low (30-49): 20-30%
- Very Low (<30): <10%

**Red Flags:**
- [ ] All scores clustered at one level
- [ ] No high-confidence signals
- [ ] All scores suspiciously uniform

### 2. Breaking News Accuracy

```sql
-- Breaking news analysis
SELECT
  COUNT(*) as total_breaking,
  COUNT(DISTINCT DATE(first_seen_at)) as days_with_breaking,
  AVG(velocity) as avg_velocity,
  AVG(source_count) as avg_sources,
  AVG(EXTRACT(EPOCH FROM (last_seen_at - first_seen_at)) / 3600) as avg_duration_hours
FROM trend_events
WHERE is_breaking = true
AND last_seen_at > NOW() - INTERVAL '7 days';
```

**Quality Indicators:**
- [ ] Breaking news has high velocity (>100)
- [ ] Breaking news has multiple sources (>3)
- [ ] Breaking flags are not overused
- [ ] Duration is reasonable (not flagged breaking for days)

### 3. Velocity Calculation Quality

```sql
-- Velocity distribution and sanity check
SELECT
  CASE
    WHEN velocity >= 1000 THEN '1000+ (Viral)'
    WHEN velocity >= 500 THEN '500-999 (Very High)'
    WHEN velocity >= 200 THEN '200-499 (High)'
    WHEN velocity >= 100 THEN '100-199 (Elevated)'
    WHEN velocity >= 50 THEN '50-99 (Moderate)'
    ELSE '0-49 (Normal)'
  END as velocity_tier,
  COUNT(*) as count,
  AVG(source_count) as avg_sources
FROM trend_events
WHERE is_trending = true
AND last_seen_at > NOW() - INTERVAL '24 hours'
GROUP BY velocity_tier
ORDER BY velocity_tier DESC;

-- Check for velocity anomalies
SELECT
  event_title,
  velocity,
  source_count,
  current_1h,
  current_24h
FROM trend_events
WHERE velocity > 1000
AND last_seen_at > NOW() - INTERVAL '24 hours'
ORDER BY velocity DESC
LIMIT 10;
```

**Quality Checks:**
- [ ] High velocity correlates with high source count
- [ ] No single-source items with extreme velocity
- [ ] Velocity values are plausible

### 4. Entity Extraction Quality

```sql
-- Entity extraction coverage
SELECT
  COUNT(*) as total_trends,
  COUNT(*) FILTER (WHERE politicians_mentioned IS NOT NULL AND array_length(politicians_mentioned, 1) > 0) as has_politicians,
  COUNT(*) FILTER (WHERE organizations_mentioned IS NOT NULL AND array_length(organizations_mentioned, 1) > 0) as has_organizations,
  COUNT(*) FILTER (WHERE legislation_mentioned IS NOT NULL AND array_length(legislation_mentioned, 1) > 0) as has_legislation,
  ROUND(100.0 * COUNT(*) FILTER (WHERE politicians_mentioned IS NOT NULL AND array_length(politicians_mentioned, 1) > 0) / COUNT(*), 1) as politician_rate
FROM trend_events
WHERE last_seen_at > NOW() - INTERVAL '24 hours';

-- Most mentioned entities
SELECT
  unnest(politicians_mentioned) as politician,
  COUNT(*) as mention_count
FROM trend_events
WHERE last_seen_at > NOW() - INTERVAL '7 days'
AND politicians_mentioned IS NOT NULL
GROUP BY politician
ORDER BY mention_count DESC
LIMIT 20;
```

**Quality Targets:**
- [ ] >30% of trends have politician mentions
- [ ] >20% have organization mentions
- [ ] Entity names are accurate (not false positives)

### 5. Policy Domain Tagging Quality

```sql
-- Domain tagging coverage and distribution
SELECT
  unnest(policy_domains) as domain,
  COUNT(*) as trend_count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as percentage
FROM trend_events
WHERE last_seen_at > NOW() - INTERVAL '24 hours'
AND policy_domains IS NOT NULL
GROUP BY domain
ORDER BY trend_count DESC;

-- Untagged trends
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE policy_domains IS NULL OR array_length(policy_domains, 1) = 0) as untagged,
  ROUND(100.0 * COUNT(*) FILTER (WHERE policy_domains IS NULL OR array_length(policy_domains, 1) = 0) / COUNT(*), 1) as untagged_rate
FROM trend_events
WHERE last_seen_at > NOW() - INTERVAL '24 hours';
```

**Quality Targets:**
- [ ] >80% of trends have domain tags
- [ ] All 12 policy domains represented
- [ ] No single domain >40% of tags

### 6. Geographic Tagging Quality

```sql
-- Geographic tagging coverage
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE geographic_focus IS NOT NULL AND array_length(geographic_focus, 1) > 0) as has_geo,
  ROUND(100.0 * COUNT(*) FILTER (WHERE geographic_focus IS NOT NULL AND array_length(geographic_focus, 1) > 0) / COUNT(*), 1) as geo_rate
FROM trend_events
WHERE last_seen_at > NOW() - INTERVAL '24 hours';

-- Geographic distribution
SELECT
  unnest(geographic_focus) as geography,
  COUNT(*) as count
FROM trend_events
WHERE last_seen_at > NOW() - INTERVAL '7 days'
AND geographic_focus IS NOT NULL
GROUP BY geography
ORDER BY count DESC
LIMIT 20;
```

**Quality Targets:**
- [ ] >50% of trends have geographic tags
- [ ] State-level coverage for US politics
- [ ] National trends properly identified

### 7. False Positive Analysis

```sql
-- Sample trends for manual review
SELECT
  id,
  event_title,
  confidence_score,
  velocity,
  source_count,
  policy_domains,
  politicians_mentioned,
  is_breaking
FROM trend_events
WHERE is_trending = true
AND last_seen_at > NOW() - INTERVAL '24 hours'
ORDER BY confidence_score DESC
LIMIT 20;
```

**Manual Review Questions:**
- [ ] Are trend titles meaningful (not gibberish)?
- [ ] Are high-confidence trends genuinely significant?
- [ ] Are breaking flags appropriate?
- [ ] Are entity extractions accurate?
- [ ] Would a political professional find this actionable?

### 8. Relevance Score Quality

```sql
-- Org relevance score distribution
SELECT
  CASE
    WHEN relevance_score >= 80 THEN '80-100 (Very High)'
    WHEN relevance_score >= 60 THEN '60-79 (High)'
    WHEN relevance_score >= 40 THEN '40-59 (Medium)'
    WHEN relevance_score >= 20 THEN '20-39 (Low)'
    ELSE '0-19 (Very Low)'
  END as relevance_tier,
  priority_bucket,
  COUNT(*) as count
FROM org_trend_scores
WHERE computed_at > NOW() - INTERVAL '24 hours'
GROUP BY relevance_tier, priority_bucket
ORDER BY relevance_tier DESC, priority_bucket;

-- Check relevance score reasoning
SELECT
  trend_key,
  relevance_score,
  priority_bucket,
  matched_topics,
  matched_entities,
  explanation
FROM org_trend_scores
WHERE computed_at > NOW() - INTERVAL '24 hours'
ORDER BY relevance_score DESC
LIMIT 10;
```

**Quality Checks:**
- [ ] High relevance scores have clear reasons
- [ ] Matched topics/entities make sense
- [ ] Priority buckets align with scores

### 9. Alert Quality

```sql
-- Alert quality analysis
SELECT
  alert_type,
  severity,
  is_actionable,
  COUNT(*) as count,
  AVG(actionable_score) as avg_score
FROM client_entity_alerts
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY alert_type, severity, is_actionable
ORDER BY count DESC;

-- Sample alerts for review
SELECT
  entity_name,
  alert_type,
  severity,
  actionable_score,
  suggested_action,
  triggered_at
FROM client_entity_alerts
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY actionable_score DESC
LIMIT 10;
```

**Quality Checks:**
- [ ] Alerts have meaningful suggested actions
- [ ] Severity levels are appropriate
- [ ] No spam alerts (too many low-value)

---

## Competitive Benchmarking

### Industry Standards (POLITICO Pro, Plural Policy, etc.)

| Metric | Industry Standard | Our Target |
|--------|-------------------|------------|
| Breaking news latency | <5 minutes | <5 minutes |
| Entity extraction accuracy | >90% | >85% |
| Domain tagging rate | >80% | >80% |
| False positive rate | <10% | <15% |
| Signal relevance | >70% useful | >65% useful |

---

## Finding Severity Levels

| Severity | Condition |
|----------|-----------|
| CRITICAL | Signal quality fundamentally broken |
| HIGH | Major accuracy or relevance issues |
| MEDIUM | Coverage gaps or minor accuracy issues |
| LOW | Optimization opportunities |
| INFO | Benchmarking observations |

---

## Output Template

```markdown
## Signal Quality Audit Results

**Audit Date:** [DATE]

### Confidence Distribution

| Tier | Count | % | Status |
|------|-------|---|--------|
| Very High (90+) | | | |
| High (70-89) | | | |
| Medium (50-69) | | | |
| Low (30-49) | | | |

### Coverage Metrics

| Metric | Rate | Target | Status |
|--------|------|--------|--------|
| Domain tagging | | 80% | |
| Entity extraction | | 30% | |
| Geo tagging | | 50% | |

### Quality Indicators

| Indicator | Value | Assessment |
|-----------|-------|------------|
| Breaking news accuracy | | |
| Velocity correlation | | |
| Entity accuracy (sample) | | |
| Relevance reasoning | | |

### Manual Review Findings

[Summary of 20-sample manual review]

### Findings

#### [SEVERITY] Finding Title
- **Metric:** [affected metric]
- **Current:** [current value]
- **Target:** [target value]
- **Impact:** [user impact]
- **Remediation:** [fix steps]
```
