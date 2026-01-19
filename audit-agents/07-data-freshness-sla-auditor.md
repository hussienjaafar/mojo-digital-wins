# Data Freshness & SLA Compliance Auditor

**Role:** SRE / Data Operations Engineer
**Focus:** Real-time data freshness and SLA compliance
**SLA Target:** <5 minutes end-to-end
**Priority:** CRITICAL

---

## Overview

This auditor verifies that the platform meets real-time SLA requirements for a political intelligence platform. With a <5 minute freshness target, any data older than this threshold represents an SLA breach.

---

## Audit Checklist

### 1. Pipeline Stage Freshness

**Check each stage of the data pipeline:**

```sql
-- Stage 1: Raw evidence freshness by source
SELECT
  source_type,
  COUNT(*) as total_24h,
  MAX(discovered_at) as latest,
  NOW() - MAX(discovered_at) as staleness,
  CASE
    WHEN NOW() - MAX(discovered_at) < INTERVAL '5 minutes' THEN 'SLA_MET'
    WHEN NOW() - MAX(discovered_at) < INTERVAL '30 minutes' THEN 'WARNING'
    WHEN NOW() - MAX(discovered_at) < INTERVAL '1 hour' THEN 'STALE'
    ELSE 'CRITICAL'
  END as sla_status
FROM trend_evidence
WHERE discovered_at > NOW() - INTERVAL '24 hours'
GROUP BY source_type
ORDER BY staleness DESC;
```

**Expected Results:**
- [ ] All source types have data <5 minutes old
- [ ] No source type is CRITICAL (>1 hour)
- [ ] News sources (google_news, rss) are freshest

### 2. Trend Events Freshness

```sql
-- Stage 2: Trend events freshness
SELECT
  COUNT(*) as total_trends,
  COUNT(*) FILTER (WHERE is_trending = true) as trending_count,
  MAX(last_seen_at) as latest_trend,
  NOW() - MAX(last_seen_at) as trend_staleness,
  MAX(created_at) as newest_trend_created,
  NOW() - MAX(created_at) as newest_age
FROM trend_events
WHERE last_seen_at > NOW() - INTERVAL '24 hours';
```

**Expected Results:**
- [ ] Trending events exist (>0)
- [ ] Latest trend is <5 minutes old
- [ ] New trends are being created regularly

### 3. Organization Scores Freshness

```sql
-- Stage 3: Org trend scores freshness
SELECT
  COUNT(*) as total_scores,
  COUNT(DISTINCT organization_id) as orgs_with_scores,
  MAX(computed_at) as latest_computation,
  NOW() - MAX(computed_at) as score_staleness,
  COUNT(*) FILTER (WHERE expires_at < NOW()) as expired_scores
FROM org_trend_scores;
```

**Expected Results:**
- [ ] Scores exist for organizations
- [ ] Latest computation is <15 minutes old
- [ ] No expired scores are being served

### 4. End-to-End Latency Analysis

```sql
-- Calculate processing latency
WITH evidence_timestamps AS (
  SELECT
    e.id as evidence_id,
    e.event_id,
    e.discovered_at as evidence_time,
    te.created_at as trend_created,
    te.last_seen_at as trend_updated
  FROM trend_evidence e
  JOIN trend_events te ON e.event_id = te.id
  WHERE e.discovered_at > NOW() - INTERVAL '1 hour'
)
SELECT
  AVG(EXTRACT(EPOCH FROM (trend_created - evidence_time))) as avg_processing_seconds,
  MAX(EXTRACT(EPOCH FROM (trend_created - evidence_time))) as max_processing_seconds,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (trend_created - evidence_time))) as p95_processing_seconds
FROM evidence_timestamps
WHERE trend_created > evidence_time;
```

**Expected Results:**
- [ ] Average processing time <60 seconds
- [ ] P95 processing time <120 seconds
- [ ] Max processing time <300 seconds

### 5. Data Volume Analysis

```sql
-- Hourly data volume (should be consistent)
SELECT
  date_trunc('hour', discovered_at) as hour,
  COUNT(*) as evidence_count,
  COUNT(DISTINCT source_type) as source_types
FROM trend_evidence
WHERE discovered_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC
LIMIT 24;
```

**Expected Results:**
- [ ] Consistent hourly volume (no gaps)
- [ ] Multiple source types each hour
- [ ] No hours with 0 records

---

## SLA Breach Detection

### Immediate Alerts

These conditions indicate SLA breach:

| Condition | Severity | Action Required |
|-----------|----------|-----------------|
| No evidence in last 5 minutes | CRITICAL | Check ingestion jobs |
| No trend_events updated in 15 minutes | HIGH | Check detect-trend-events |
| No org_scores in 30 minutes | HIGH | Check compute-org-relevance |
| Source type missing for 1 hour | MEDIUM | Check specific source |

### Monitoring Query

```sql
-- SLA breach detection query
SELECT
  'trend_evidence' as table_name,
  CASE
    WHEN MAX(discovered_at) > NOW() - INTERVAL '5 minutes' THEN 'OK'
    WHEN MAX(discovered_at) > NOW() - INTERVAL '15 minutes' THEN 'WARNING'
    ELSE 'SLA_BREACH'
  END as status,
  NOW() - MAX(discovered_at) as staleness
FROM trend_evidence
UNION ALL
SELECT
  'trend_events' as table_name,
  CASE
    WHEN MAX(last_seen_at) > NOW() - INTERVAL '15 minutes' THEN 'OK'
    WHEN MAX(last_seen_at) > NOW() - INTERVAL '30 minutes' THEN 'WARNING'
    ELSE 'SLA_BREACH'
  END as status,
  NOW() - MAX(last_seen_at) as staleness
FROM trend_events
WHERE is_trending = true
UNION ALL
SELECT
  'org_trend_scores' as table_name,
  CASE
    WHEN MAX(computed_at) > NOW() - INTERVAL '30 minutes' THEN 'OK'
    WHEN MAX(computed_at) > NOW() - INTERVAL '1 hour' THEN 'WARNING'
    ELSE 'SLA_BREACH'
  END as status,
  NOW() - MAX(computed_at) as staleness
FROM org_trend_scores;
```

---

## Finding Severity Levels

| Severity | Condition |
|----------|-----------|
| CRITICAL | Any stage >1 hour stale, or no data flowing |
| HIGH | Any stage >30 minutes stale |
| MEDIUM | Any stage >15 minutes stale |
| LOW | Any stage >5 minutes stale (SLA warning) |
| INFO | Recommendations for optimization |

---

## Common Issues & Remediation

### Issue: No recent trend_evidence
**Symptoms:** trend_evidence.discovered_at is old
**Likely Causes:**
1. Ingestion cron jobs not running
2. API rate limits exceeded
3. API credentials expired
**Remediation:** Check cron job logs, verify API keys

### Issue: Evidence exists but no trend_events
**Symptoms:** trend_evidence fresh, trend_events stale
**Likely Causes:**
1. detect-trend-events cron not running
2. Processing errors in trend detection
**Remediation:** Run detect-trend-events manually, check logs

### Issue: Trends exist but no org_scores
**Symptoms:** trend_events fresh, org_trend_scores stale/empty
**Likely Causes:**
1. compute-org-relevance cron not running
2. No organization profiles configured
**Remediation:** Run compute-org-relevance, verify org profiles exist

---

## Output Template

```markdown
## Data Freshness & SLA Audit Results

**Audit Date:** [DATE]
**SLA Target:** <5 minutes

### Pipeline Health Summary

| Stage | Latest Data | Staleness | Status |
|-------|-------------|-----------|--------|
| trend_evidence | | | |
| trend_events | | | |
| org_trend_scores | | | |

### Source Freshness

| Source Type | Count (24h) | Latest | Status |
|-------------|-------------|--------|--------|
| google_news | | | |
| rss | | | |
| bluesky | | | |

### Findings

#### [SEVERITY] Finding Title
- **Stage:** [affected stage]
- **Current:** [current staleness]
- **Target:** [SLA target]
- **Impact:** [user impact]
- **Remediation:** [fix steps]

### SLA Compliance

- **Overall Status:** [MET/BREACH]
- **Breach Duration:** [if applicable]
- **Affected Users:** [scope]
```
