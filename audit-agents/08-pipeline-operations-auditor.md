# Pipeline Operations Auditor

**Role:** DevOps / Platform Engineer
**Focus:** Cron jobs, pipeline health, error handling
**Priority:** CRITICAL

---

## Overview

This auditor verifies that all data pipeline operations are running correctly. A political intelligence platform requires continuous data ingestion and processing to maintain real-time freshness.

---

## Required Cron Jobs

### Ingestion Layer
| Job | Schedule | Purpose | Critical |
|-----|----------|---------|----------|
| fetch-google-news | Every 5 min | News ingestion | YES |
| fetch-rss-feeds | Every 15 min | RSS ingestion | YES |
| fetch-reddit-posts | Every 30 min | Reddit monitoring | NO |
| fetch-executive-orders | Every 6 hours | Executive orders | NO |
| sync-congress-bills | Daily | Bill tracking | NO |

### Processing Layer
| Job | Schedule | Purpose | Critical |
|-----|----------|---------|----------|
| detect-trend-events | Every 5 min | Trend detection | YES |
| extract-trend-entities | Every 15 min | Entity extraction | YES |
| tag-trend-policy-domains | Every 15 min | Domain tagging | YES |
| tag-trend-geographies | Every 15 min | Geo tagging | YES |
| detect-duplicates | Every 30 min | Deduplication | NO |

### Scoring Layer
| Job | Schedule | Purpose | Critical |
|-----|----------|---------|----------|
| compute-org-relevance | Every 15 min | Org scoring | YES |
| match-entity-watchlist | Every 15 min | Watchlist alerts | YES |
| detect-fundraising-opportunities | Every 30 min | Opportunity detection | NO |

### Learning Layer
| Job | Schedule | Purpose | Critical |
|-----|----------|---------|----------|
| update-org-affinities | Hourly | Affinity learning | NO |
| decay-stale-affinities | Daily | Affinity decay | NO |
| correlate-trends-campaigns | Hourly | Performance learning | NO |

### Maintenance Layer
| Job | Schedule | Purpose | Critical |
|-----|----------|---------|----------|
| refresh-meta-tokens | Daily | Token refresh | NO |
| cleanup-old-cache | Weekly | Cache cleanup | NO |
| ttl-cleanup | Daily | TTL enforcement | NO |

---

## Audit Checklist

### 1. Cron Job Configuration Check

**Verify cron jobs are configured in Supabase:**

Check the dashboard or use:
```sql
-- Check if scheduled_jobs table exists and has entries
SELECT
  id,
  function_name,
  schedule,
  created_at,
  updated_at
FROM scheduled_jobs
ORDER BY function_name;
```

**Expected Results:**
- [ ] All critical jobs are configured
- [ ] Schedules match requirements
- [ ] No duplicate job entries

### 2. Job Execution History

```sql
-- Check recent job executions (if job_runs table exists)
SELECT
  job_name,
  started_at,
  completed_at,
  status,
  error_message,
  EXTRACT(EPOCH FROM (completed_at - started_at)) as duration_seconds
FROM job_runs
WHERE started_at > NOW() - INTERVAL '24 hours'
ORDER BY started_at DESC
LIMIT 50;
```

**Alternative: Check via Supabase logs or edge function logs**

### 3. Job Failure Analysis

```sql
-- Recent failures
SELECT
  job_type,
  job_name,
  error_message,
  error_context,
  created_at
FROM job_failures
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 20;

-- Failure frequency by job
SELECT
  job_type,
  COUNT(*) as failure_count,
  MAX(created_at) as last_failure,
  MIN(created_at) as first_failure
FROM job_failures
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY job_type
ORDER BY failure_count DESC;
```

**Expected Results:**
- [ ] No critical job failures in last 24 hours
- [ ] Failure rate <5% for any job
- [ ] No recurring error patterns

### 4. Edge Function Health

**Check edge function deployment status:**

```bash
# Via Supabase CLI
supabase functions list
```

**Functions to verify:**
- [ ] fetch-google-news - deployed and active
- [ ] fetch-rss-feeds - deployed and active
- [ ] detect-trend-events - deployed and active
- [ ] compute-org-relevance - deployed and active
- [ ] match-entity-watchlist - deployed and active
- [ ] get-trends-for-org - deployed and active

### 5. Environment Variables

**Required secrets for each function:**

| Function | Required Secrets |
|----------|------------------|
| fetch-google-news | GOOGLE_NEWS_API_KEY, CRON_SECRET |
| All cron jobs | CRON_SECRET |
| Supabase functions | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY |
| Meta functions | META_APP_ID, META_APP_SECRET |

**Check via Supabase dashboard or:**
```bash
supabase secrets list
```

### 6. Rate Limit Analysis

```sql
-- Check if we're hitting rate limits (look for patterns)
SELECT
  source_type,
  date_trunc('hour', discovered_at) as hour,
  COUNT(*) as items,
  COUNT(DISTINCT source_domain) as domains
FROM trend_evidence
WHERE discovered_at > NOW() - INTERVAL '24 hours'
GROUP BY source_type, hour
ORDER BY hour DESC, source_type;
```

**Red Flags:**
- Sudden drop in items per hour
- Missing hours for a source type
- Consistent low counts (may indicate rate limiting)

---

## Pipeline Connectivity Test

### Manual Trigger Test

For each critical function, verify it can be triggered:

```bash
# Test fetch-google-news
curl -X POST \
  https://[PROJECT_REF].supabase.co/functions/v1/fetch-google-news \
  -H "Authorization: Bearer [SERVICE_ROLE_KEY]" \
  -H "x-cron-secret: [CRON_SECRET]" \
  -H "Content-Type: application/json"

# Test detect-trend-events
curl -X POST \
  https://[PROJECT_REF].supabase.co/functions/v1/detect-trend-events \
  -H "Authorization: Bearer [SERVICE_ROLE_KEY]" \
  -H "x-cron-secret: [CRON_SECRET]" \
  -H "Content-Type: application/json"

# Test compute-org-relevance
curl -X POST \
  https://[PROJECT_REF].supabase.co/functions/v1/compute-org-relevance \
  -H "Authorization: Bearer [SERVICE_ROLE_KEY]" \
  -H "x-cron-secret: [CRON_SECRET]" \
  -H "Content-Type: application/json"
```

**Expected Results:**
- [ ] All functions return 200 OK
- [ ] Response includes success indicators
- [ ] No authorization errors

---

## Common Issues & Remediation

### Issue: Cron jobs not configured
**Symptoms:** No scheduled_jobs entries, no data flow
**Remediation:** Configure cron jobs in Supabase dashboard

### Issue: CRON_SECRET not set
**Symptoms:** Jobs return 401 Unauthorized
**Remediation:** Set CRON_SECRET in Supabase secrets

### Issue: API rate limits
**Symptoms:** Decreasing data volume, 429 errors in logs
**Remediation:** Adjust fetch frequency, implement backoff

### Issue: Edge function timeout
**Symptoms:** Jobs start but don't complete
**Remediation:** Optimize function, increase timeout, batch processing

---

## Finding Severity Levels

| Severity | Condition |
|----------|-----------|
| CRITICAL | Critical cron job not running for >1 hour |
| HIGH | Non-critical job failing repeatedly |
| MEDIUM | Job running but with errors |
| LOW | Job running slower than expected |
| INFO | Optimization recommendations |

---

## Output Template

```markdown
## Pipeline Operations Audit Results

**Audit Date:** [DATE]

### Cron Job Status

| Job | Configured | Last Run | Status |
|-----|------------|----------|--------|
| fetch-google-news | | | |
| fetch-rss-feeds | | | |
| detect-trend-events | | | |
| compute-org-relevance | | | |
| match-entity-watchlist | | | |

### Edge Function Health

| Function | Deployed | Last Invocation | Status |
|----------|----------|-----------------|--------|
| | | | |

### Failure Analysis

| Job | Failures (7d) | Last Failure | Error |
|-----|---------------|--------------|-------|
| | | | |

### Findings

#### [SEVERITY] Finding Title
- **Job:** [affected job]
- **Issue:** [description]
- **Impact:** [user impact]
- **Remediation:** [fix steps]

### Recommendations

1. [Recommendation]
2. [Recommendation]
```
