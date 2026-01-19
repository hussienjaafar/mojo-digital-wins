# Full Platform Audit Plan - World-Class Intelligence Standard

**Created:** 2026-01-19
**Standard:** World-Class Political Intelligence Platform
**SLA Target:** Real-time (<5 minutes)
**Scope:** Full Platform Audit

---

## Executive Summary

This audit plan is designed to evaluate the platform against **world-class political intelligence standards** used by leading platforms like POLITICO Pro, Plural Policy, and enterprise geopolitical intelligence solutions.

### Key Requirements
- **Real-time data freshness** (<5 minutes from source to display)
- **Multi-source intelligence** (News, Social, Government data)
- **Actionable signals** for political campaigns, advocacy orgs, and consultants
- **Zero data gaps** in the user experience

---

## Audit Framework

### Current Agents (Existing)
| # | Agent | Focus | Status |
|---|-------|-------|--------|
| 01 | Data Pipeline Quality | Schema, ingestion, deduplication | EXISTS |
| 02 | Filter Bubble & Diversity | Anti-echo-chamber, 70/30 split | EXISTS |
| 03 | Algorithm Fairness | Bias detection, demographic parity | EXISTS |
| 04 | Domain Coverage | Keywords, entities, geo tagging | EXISTS |
| 05 | Security & Compliance | RLS, auth, data protection | EXISTS |
| 06 | Learning System | Affinity learning, decay, feedback | EXISTS |

### New Agents (To Create)
| # | Agent | Focus | Priority |
|---|-------|-------|----------|
| 07 | **Data Freshness & SLA** | Real-time SLA compliance, latency | CRITICAL |
| 08 | **Pipeline Operations** | Cron jobs, connectivity, health | CRITICAL |
| 09 | **Source Integration** | API health, source diversity | HIGH |
| 10 | **End-to-End UX** | Empty states, data display, features | HIGH |
| 11 | **Signal Quality** | Actionability, relevance, false positives | HIGH |

---

## Phase 1: Critical Infrastructure Audit

**Purpose:** Identify why data isn't flowing to the UI

### 1A. Data Freshness & SLA Audit (NEW - Agent 07)
**Objective:** Verify <5 minute SLA compliance

**Checks:**
- [ ] Data freshness at each pipeline stage
- [ ] End-to-end latency: source → ingestion → processing → UI
- [ ] Timestamp validation across tables
- [ ] Freshness SLA breach detection
- [ ] Data age distribution analysis

**Key Metrics:**
| Metric | Target | Measure |
|--------|--------|---------|
| Source to trend_evidence | <2 min | timestamp diff |
| trend_evidence to trend_events | <2 min | processing lag |
| trend_events to org_trend_scores | <1 min | scoring delay |
| Total end-to-end | <5 min | first seen to displayed |

**SQL Diagnostics:**
```sql
-- Data freshness by source type
SELECT
  source_type,
  COUNT(*) as total,
  MAX(discovered_at) as latest,
  NOW() - MAX(discovered_at) as age,
  CASE
    WHEN NOW() - MAX(discovered_at) < INTERVAL '5 minutes' THEN 'OK'
    WHEN NOW() - MAX(discovered_at) < INTERVAL '1 hour' THEN 'STALE'
    ELSE 'CRITICAL'
  END as status
FROM trend_evidence
GROUP BY source_type;

-- Pipeline stage freshness
SELECT
  'trend_evidence' as stage,
  MAX(discovered_at) as latest_data,
  NOW() - MAX(discovered_at) as age
FROM trend_evidence
UNION ALL
SELECT
  'trend_events' as stage,
  MAX(last_seen_at) as latest_data,
  NOW() - MAX(last_seen_at) as age
FROM trend_events
UNION ALL
SELECT
  'org_trend_scores' as stage,
  MAX(computed_at) as latest_data,
  NOW() - MAX(computed_at) as age
FROM org_trend_scores;
```

### 1B. Pipeline Operations Audit (NEW - Agent 08)
**Objective:** Verify all cron jobs and data pipelines are running

**Checks:**
- [ ] Cron job scheduling verification
- [ ] Last execution time for each job
- [ ] Job success/failure rates
- [ ] Error log analysis
- [ ] Pipeline connectivity status

**Required Cron Jobs:**
| Job | Expected Frequency | Purpose |
|-----|-------------------|---------|
| fetch-google-news | Every 5 min | News ingestion |
| fetch-rss-feeds | Every 15 min | RSS ingestion |
| detect-trend-events | Every 5 min | Trend detection |
| extract-trend-entities | Every 15 min | Entity extraction |
| tag-trend-policy-domains | Every 15 min | Domain tagging |
| tag-trend-geographies | Every 15 min | Geo tagging |
| compute-org-relevance | Every 15 min | Org scoring |
| update-org-affinities | Every hour | Affinity learning |
| decay-stale-affinities | Daily | Affinity decay |
| correlate-trends-campaigns | Hourly | Performance learning |

**Diagnostic Queries:**
```sql
-- Check scheduled jobs status
SELECT
  function_name,
  schedule,
  last_run_at,
  next_run_at,
  status,
  CASE
    WHEN last_run_at IS NULL THEN 'NEVER_RUN'
    WHEN NOW() - last_run_at > INTERVAL '1 hour' THEN 'STALE'
    ELSE 'OK'
  END as health
FROM scheduled_jobs
WHERE function_name IN (
  'fetch-google-news', 'fetch-rss-feeds', 'detect-trend-events',
  'compute-org-relevance', 'update-org-affinities'
);

-- Check job_failures for recent errors
SELECT
  job_type,
  COUNT(*) as failure_count,
  MAX(created_at) as last_failure,
  array_agg(DISTINCT error_message) as errors
FROM job_failures
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY job_type
ORDER BY failure_count DESC;
```

---

## Phase 2: Source Integration Audit

### 2A. Source Integration Audit (NEW - Agent 09)
**Objective:** Verify all data sources are connected and healthy

**Data Sources to Verify:**
1. **Google News API**
   - [ ] API key configured
   - [ ] Rate limits not exceeded
   - [ ] Response data quality

2. **RSS Feeds**
   - [ ] Feed URLs accessible
   - [ ] Feed parsing working
   - [ ] Feed freshness

3. **Social Media**
   - [ ] Bluesky connection status
   - [ ] Reddit connection status (if applicable)
   - [ ] Rate limit compliance

4. **Government Sources**
   - [ ] Congress.gov API status
   - [ ] Executive orders feed
   - [ ] Polling data sources

**Diagnostic Queries:**
```sql
-- Source diversity check
SELECT
  source_type,
  COUNT(*) as total_items,
  COUNT(DISTINCT source_domain) as unique_domains,
  MIN(discovered_at) as oldest,
  MAX(discovered_at) as newest
FROM trend_evidence
WHERE discovered_at > NOW() - INTERVAL '24 hours'
GROUP BY source_type
ORDER BY total_items DESC;

-- Source health over time
SELECT
  date_trunc('hour', discovered_at) as hour,
  source_type,
  COUNT(*) as items
FROM trend_evidence
WHERE discovered_at > NOW() - INTERVAL '24 hours'
GROUP BY hour, source_type
ORDER BY hour DESC;
```

---

## Phase 3: Data Quality Audit

### 3A. Data Pipeline Quality (Existing - Agent 01)
**Enhanced checks for this audit:**
- [ ] Record counts by table
- [ ] Null value analysis
- [ ] Duplicate detection
- [ ] Schema validation
- [ ] Foreign key integrity

### 3B. Domain Coverage (Existing - Agent 04)
**Standard checks**

### 3C. Security & Compliance (Existing - Agent 05)
**Standard checks**

---

## Phase 4: Intelligence Quality Audit

### 4A. Signal Quality Audit (NEW - Agent 11)
**Objective:** Verify signals are actionable and high-quality

**Checks:**
- [ ] Trend confidence score distribution
- [ ] Breaking news detection accuracy
- [ ] Velocity calculation correctness
- [ ] False positive rate analysis
- [ ] Actionability criteria evaluation

**Key Questions:**
1. Are there trends with `is_trending = true`?
2. Are confidence scores realistic (not all 0 or 100)?
3. Is velocity being calculated correctly?
4. Are breaking news flags being set appropriately?

**Diagnostic Queries:**
```sql
-- Trend quality distribution
SELECT
  CASE
    WHEN confidence_score >= 70 THEN 'HIGH'
    WHEN confidence_score >= 40 THEN 'MEDIUM'
    ELSE 'LOW'
  END as confidence_tier,
  is_trending,
  is_breaking,
  COUNT(*) as count
FROM trend_events
WHERE last_seen_at > NOW() - INTERVAL '24 hours'
GROUP BY confidence_tier, is_trending, is_breaking
ORDER BY count DESC;

-- Actionability analysis
SELECT
  COUNT(*) as total_trends,
  COUNT(*) FILTER (WHERE is_breaking = true) as breaking,
  COUNT(*) FILTER (WHERE confidence_score >= 70) as high_confidence,
  COUNT(*) FILTER (WHERE z_score_velocity >= 2) as high_velocity,
  COUNT(*) FILTER (
    WHERE is_breaking = true
    OR confidence_score >= 70
    OR z_score_velocity >= 2
  ) as actionable
FROM trend_events
WHERE is_trending = true
AND last_seen_at > NOW() - INTERVAL '24 hours';
```

### 4B. Filter Bubble Audit (Existing - Agent 02)
**Standard checks**

### 4C. Algorithm Fairness (Existing - Agent 03)
**Standard checks**

### 4D. Learning System Audit (Existing - Agent 06)
**Standard checks**

---

## Phase 5: End-to-End UX Audit

### 5A. End-to-End UX Audit (NEW - Agent 10)
**Objective:** Verify data flows correctly to the UI

**Checks:**
- [ ] Admin dashboard shows data
- [ ] Client dashboard shows data
- [ ] Empty states are properly explained
- [ ] Filters work correctly
- [ ] Real-time updates work
- [ ] All features are functional

**Critical Paths to Test:**
1. Political Intelligence → Key Developments
2. Political Intelligence → For You tab
3. Political Intelligence → Explore tab
4. News & Trends (client) → Priority Feed
5. News & Trends (client) → Explore Trends
6. Intelligence Center → Critical Alerts
7. Intelligence Center → Trending Topics
8. Opportunities → Magic Moments

**UI Data Requirements:**
| Page | Required Data | Source |
|------|--------------|--------|
| Admin News & Trends | trend_events + org_trend_scores | get-trends-for-org |
| Client News & Trends | trend_events + org_trend_scores | get-trends-for-org |
| Intelligence Center | client_entity_alerts + trend_events | direct queries |
| Opportunities | fundraising_opportunities | detect-fundraising-opportunities |

---

## Audit Execution Order

```
Phase 1 (CRITICAL - Run First)
├── 1A: Data Freshness & SLA Audit (NEW Agent 07)
└── 1B: Pipeline Operations Audit (NEW Agent 08)

Phase 2 (HIGH - Run Second)
└── 2A: Source Integration Audit (NEW Agent 09)

Phase 3 (MEDIUM - Run in Parallel)
├── 3A: Data Pipeline Quality (Agent 01)
├── 3B: Domain Coverage (Agent 04)
└── 3C: Security & Compliance (Agent 05)

Phase 4 (MEDIUM - Run After Phase 3)
├── 4A: Signal Quality Audit (NEW Agent 11)
├── 4B: Filter Bubble Audit (Agent 02)
├── 4C: Algorithm Fairness (Agent 03)
└── 4D: Learning System Audit (Agent 06)

Phase 5 (HIGH - Run Last)
└── 5A: End-to-End UX Audit (NEW Agent 10)
```

---

## Success Criteria

### Platform Health Score

| Grade | Criteria |
|-------|----------|
| A | 0 Critical, 0 High, <5 Medium findings |
| B | 0 Critical, <3 High, <10 Medium findings |
| C | 0 Critical, <5 High, any Medium findings |
| D | Any Critical findings that are fixable |
| F | Critical findings blocking core functionality |

### Real-Time SLA Compliance

| Metric | Target | Acceptable | Critical |
|--------|--------|------------|----------|
| Data freshness | <5 min | <15 min | >1 hour |
| Pipeline uptime | 99.9% | 99% | <95% |
| Source coverage | 100% | 80% | <50% |
| UI data display | 100% | 90% | <70% |

---

## Deliverables

1. **Audit Report** - Comprehensive findings document
2. **Remediation Plan** - Prioritized fix list
3. **Monitoring Setup** - Ongoing health checks
4. **SLA Dashboard** - Real-time compliance tracking

---

## References

- [Atlan - SLAs for Data Pipelines](https://atlan.com/sla-for-data-pipelines/)
- [Monte Carlo - Data Freshness Explained](https://www.montecarlodata.com/blog-data-freshness-explained/)
- [dbt Labs - Data SLA Best Practices](https://www.getdbt.com/blog/data-slas-best-practices)
- [Acceldata - SLAs for Data Pipeline Success](https://www.acceldata.io/blog/master-data-pipelines-why-slas-are-your-key-to-success)
