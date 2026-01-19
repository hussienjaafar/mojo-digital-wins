# Comprehensive Platform Remediation Plan

**Date:** 2026-01-19
**Based on:** Full Platform Audit with World-Class Intelligence Standards
**Status:** CRITICAL - Immediate Action Required
**Health Score:** 35/100 (F Grade)

---

## Executive Summary

The platform audit revealed **critical operational failures** that are causing the News & Trends page to show "No actionable signals" despite having 655 trend events and 52,824 articles in the database.

### Critical Issue Chain

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ROOT CAUSE ANALYSIS                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [CAUSE 1] Scheduler Not Running                                     │
│       ↓                                                              │
│  [EFFECT] job_executions table is EMPTY                             │
│       ↓                                                              │
│  [CAUSE 2] detect-trend-events not executing                        │
│       ↓                                                              │
│  [EFFECT] is_trending flags not being set                           │
│       ↓                                                              │
│  [CAUSE 3] UI queries filter on is_trending=true                    │
│       ↓                                                              │
│  [EFFECT] "No actionable signals" displayed                         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Audit Findings Summary

| Phase | Status | Finding | Severity |
|-------|--------|---------|----------|
| Data Freshness | ⚠️ WARNING | Data exists but processing stopped | HIGH |
| Pipeline Operations | ❌ CRITICAL | Scheduler completely non-functional | CRITICAL |
| Source Integration | ✅ PASS | 173 RSS sources active, data fresh | OK |
| UI Data Flow | ❌ CRITICAL | Schema mismatch + actionability filters | CRITICAL |
| Signal Quality | ✅ PASS | 655 trend_events, 801 entity_mentions | OK |

### Key Metrics

| Metric | Current | Expected | Gap |
|--------|---------|----------|-----|
| job_executions rows | 0 | >1000/day | CRITICAL |
| Trending events (is_trending=true) | Unknown | >50 | Unknown |
| Bluesky data age | 14,026 min | <10 min | CRITICAL |
| Articles data age | 3 min | <5 min | OK |
| trend_events total | 655 | N/A | OK |

---

## Remediation Agent Assignments

### New Operational Agents (Created for this remediation)

| Agent | Focus | Issues Assigned | Priority |
|-------|-------|-----------------|----------|
| `14-scheduler-remediator.md` | Cron jobs, pg_cron, Vault secrets | 3 issues | CRITICAL |
| `15-pipeline-activator.md` | Trigger pipeline stages, verify data flow | 4 issues | CRITICAL |
| `16-data-freshness-fixer.md` | Stale sources, API reconnection | 2 issues | HIGH |
| `17-ui-data-flow-fixer.md` | Views, queries, actionability filters | 3 issues | HIGH |

### Existing Agents (Re-tasked)

| Agent | Additional Tasks |
|-------|------------------|
| `10-security-remediator.md` | Verify cron authentication |
| `13-schema-migrator.md` | Add missing views/indexes |

---

## Phase 1: CRITICAL - Scheduler Infrastructure (Day 1)

**Agent:** `14-scheduler-remediator.md`
**Estimated Time:** 2-4 hours
**Dependencies:** None

### Task 1.1: Enable Required Extensions

```sql
-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;
```

### Task 1.2: Configure Vault Secrets

```sql
-- Store project URL in vault
SELECT vault.create_secret(
  'https://nuclmzoasgydubdshtab.supabase.co',
  'project_url'
);

-- Store service role key for cron jobs
SELECT vault.create_secret(
  '[SERVICE_ROLE_KEY]',
  'service_role_key'
);

-- Store cron secret for job authentication
SELECT vault.create_secret(
  '[CRON_SECRET]',
  'cron_secret'
);
```

### Task 1.3: Populate scheduled_jobs Table

```sql
-- Insert all required scheduled jobs
INSERT INTO scheduled_jobs (job_name, job_type, schedule, endpoint, is_active, description)
VALUES
  -- Ingestion Layer (Tier 1)
  ('fetch_google_news', 'fetch_news', '*/5 * * * *', '/functions/v1/fetch-google-news', true, 'Fetch Google News articles'),
  ('fetch_rss_feeds', 'fetch_rss', '*/15 * * * *', '/functions/v1/fetch-rss-feeds', true, 'Fetch RSS feed articles'),

  -- Processing Layer (Tier 1)
  ('detect_trend_events', 'detect_trends', '*/5 * * * *', '/functions/v1/detect-trend-events', true, 'Detect and score trending events'),
  ('extract_trend_entities', 'extract_entities', '*/15 * * * *', '/functions/v1/extract-trend-entities', true, 'Extract entities from trends'),
  ('tag_trend_policy_domains', 'tag_domains', '*/15 * * * *', '/functions/v1/tag-trend-policy-domains', true, 'Tag policy domains'),
  ('tag_trend_geographies', 'tag_geo', '*/15 * * * *', '/functions/v1/tag-trend-geographies', true, 'Tag geographic regions'),

  -- Scoring Layer (Tier 1)
  ('compute_org_relevance', 'compute_relevance', '*/15 * * * *', '/functions/v1/compute-org-relevance', true, 'Compute org-specific relevance scores'),
  ('match_entity_watchlist', 'match_watchlist', '*/15 * * * *', '/functions/v1/match-entity-watchlist', true, 'Match entities against org watchlists'),

  -- Learning Layer (Tier 2)
  ('update_org_affinities', 'learn_affinities', '0 * * * *', '/functions/v1/update-org-affinities', true, 'Update topic affinity scores'),
  ('decay_stale_affinities', 'decay_affinities', '0 4 * * *', '/functions/v1/decay-stale-affinities', true, 'Decay old affinity scores'),

  -- Maintenance Layer (Tier 3)
  ('ttl_cleanup', 'cleanup', '0 3 * * *', '/functions/v1/ttl-cleanup', true, 'Clean up expired data')
ON CONFLICT (job_name) DO UPDATE SET
  is_active = true,
  schedule = EXCLUDED.schedule,
  endpoint = EXCLUDED.endpoint;
```

### Task 1.4: Create pg_cron Master Trigger

```sql
-- Create master cron job that triggers run-scheduled-jobs every minute
SELECT cron.schedule(
  'master-scheduler',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
           || '/functions/v1/run-scheduled-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := jsonb_build_object('triggered_by', 'pg_cron', 'timestamp', now())
  ) AS request_id;
  $$
);
```

### Task 1.5: Verify Scheduler Setup

```sql
-- Check cron jobs are scheduled
SELECT jobid, schedule, command, nodename FROM cron.job;

-- After 2 minutes, check job run details
SELECT jobid, runid, job_pid, status, start_time, end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;

-- Check job_executions table is populating
SELECT job_id, started_at, completed_at, status, error_message
FROM job_executions
ORDER BY started_at DESC
LIMIT 10;
```

---

## Phase 2: CRITICAL - Pipeline Activation (Day 1-2)

**Agent:** `15-pipeline-activator.md`
**Estimated Time:** 1-2 hours
**Dependencies:** Phase 1 complete

### Task 2.1: Manual Trigger - detect-trend-events

```bash
# Trigger trend detection immediately
curl -X POST \
  "https://nuclmzoasgydubdshtab.supabase.co/functions/v1/detect-trend-events" \
  -H "Authorization: Bearer [SERVICE_ROLE_KEY]" \
  -H "x-cron-secret: [CRON_SECRET]" \
  -H "Content-Type: application/json" \
  -d '{"manual_trigger": true}'
```

### Task 2.2: Verify is_trending Flags Set

```sql
-- Check trending status distribution
SELECT
  is_trending,
  COUNT(*) as count,
  MAX(last_seen_at) as latest
FROM trend_events
WHERE last_seen_at > NOW() - INTERVAL '24 hours'
GROUP BY is_trending;

-- Expected: is_trending=true should have count > 0
```

### Task 2.3: Manual Trigger - compute-org-relevance

```bash
# Trigger org relevance computation
curl -X POST \
  "https://nuclmzoasgydubdshtab.supabase.co/functions/v1/compute-org-relevance" \
  -H "Authorization: Bearer [SERVICE_ROLE_KEY]" \
  -H "x-cron-secret: [CRON_SECRET]" \
  -H "Content-Type: application/json"
```

### Task 2.4: Verify Pipeline Health

```sql
-- Full pipeline health check
SELECT
  'trend_evidence' as stage,
  COUNT(*) as count_24h,
  MAX(discovered_at) as latest,
  EXTRACT(EPOCH FROM (NOW() - MAX(discovered_at)))/60 as minutes_stale
FROM trend_evidence
WHERE discovered_at > NOW() - INTERVAL '24 hours'

UNION ALL

SELECT
  'trend_events' as stage,
  COUNT(*) as count_24h,
  MAX(last_seen_at) as latest,
  EXTRACT(EPOCH FROM (NOW() - MAX(last_seen_at)))/60 as minutes_stale
FROM trend_events
WHERE last_seen_at > NOW() - INTERVAL '24 hours'

UNION ALL

SELECT
  'org_trend_scores' as stage,
  COUNT(*) as count_24h,
  MAX(computed_at) as latest,
  EXTRACT(EPOCH FROM (NOW() - MAX(computed_at)))/60 as minutes_stale
FROM org_trend_scores
WHERE computed_at > NOW() - INTERVAL '24 hours';
```

---

## Phase 3: HIGH - Data Source Revival (Day 2)

**Agent:** `16-data-freshness-fixer.md`
**Estimated Time:** 2-3 hours
**Dependencies:** Phase 2 complete

### Task 3.1: Diagnose Bluesky Staleness

```sql
-- Check Bluesky data age
SELECT
  MAX(created_at) as latest_post,
  EXTRACT(EPOCH FROM (NOW() - MAX(created_at)))/60 as minutes_stale,
  COUNT(*) as total_posts
FROM bluesky_posts;

-- Check if Bluesky fetch is scheduled
SELECT * FROM scheduled_jobs WHERE job_name LIKE '%bluesky%';
```

### Task 3.2: Reactivate Bluesky Ingestion

```sql
-- Add Bluesky fetch job if missing
INSERT INTO scheduled_jobs (job_name, job_type, schedule, endpoint, is_active, description)
VALUES
  ('collect_bluesky_posts', 'fetch_social', '*/10 * * * *', '/functions/v1/collect-bluesky-posts', true, 'Collect Bluesky political posts'),
  ('analyze_bluesky_posts', 'analyze_social', '*/15 * * * *', '/functions/v1/analyze-bluesky-posts', true, 'Analyze Bluesky content'),
  ('calculate_bluesky_trends', 'calc_trends', '*/15 * * * *', '/functions/v1/calculate-bluesky-trends', true, 'Calculate Bluesky trending topics')
ON CONFLICT (job_name) DO UPDATE SET is_active = true;
```

### Task 3.3: Verify All Source Types Active

```sql
-- Source type distribution check
SELECT
  source_type,
  COUNT(*) as count_24h,
  MAX(discovered_at) as latest,
  CASE
    WHEN NOW() - MAX(discovered_at) < INTERVAL '15 minutes' THEN '✅ FRESH'
    WHEN NOW() - MAX(discovered_at) < INTERVAL '1 hour' THEN '⚠️ STALE'
    ELSE '❌ CRITICAL'
  END as status
FROM trend_evidence
WHERE discovered_at > NOW() - INTERVAL '24 hours'
GROUP BY source_type
ORDER BY count_24h DESC;
```

---

## Phase 4: HIGH - UI Data Flow Fix (Day 2-3)

**Agent:** `17-ui-data-flow-fixer.md`
**Estimated Time:** 2-3 hours
**Dependencies:** Phase 2 complete

### Task 4.1: Verify trend_events_active View

```sql
-- Check if view exists
SELECT viewname FROM pg_views WHERE viewname = 'trend_events_active';

-- If missing, create it
CREATE OR REPLACE VIEW trend_events_active AS
SELECT
  te.*,
  CASE
    WHEN te.last_seen_at > NOW() - INTERVAL '1 hour' THEN 'fresh'
    WHEN te.last_seen_at > NOW() - INTERVAL '6 hours' THEN 'recent'
    WHEN te.last_seen_at > NOW() - INTERVAL '24 hours' THEN 'aging'
    ELSE 'stale'
  END as freshness,
  COALESCE(te.baseline_7d, 0) as safe_baseline,
  CASE
    WHEN te.baseline_7d > 0 THEN
      ROUND(((te.current_24h / 24.0 - te.baseline_7d) / te.baseline_7d * 100)::numeric, 1)
    ELSE 0
  END as baseline_delta_pct
FROM trend_events te
WHERE te.last_seen_at > NOW() - INTERVAL '48 hours';
```

### Task 4.2: Analyze Actionability Filter Impact

```sql
-- Simulate UI query and actionability filters
WITH ui_query AS (
  SELECT *
  FROM trend_events
  WHERE is_trending = true
    AND confidence_score >= 30
    AND last_seen_at > NOW() - INTERVAL '24 hours'
)
SELECT
  COUNT(*) as total_matching_base_query,
  COUNT(*) FILTER (WHERE is_breaking = true) as breaking_count,
  COUNT(*) FILTER (WHERE confidence_score >= 70) as high_confidence_count,
  COUNT(*) FILTER (WHERE z_score_velocity >= 2) as high_velocity_count,
  COUNT(*) FILTER (
    WHERE is_breaking = true
       OR confidence_score >= 70
       OR z_score_velocity >= 2
  ) as would_display_in_ui
FROM ui_query;
```

### Task 4.3: Adjust Actionability Thresholds (if needed)

If `would_display_in_ui` is 0 despite having trending events, adjust thresholds:

**File:** `src/pages/admin/NewsTrendsPage.tsx` (lines 108-120)

```typescript
// Current (too strict):
const actionable = trends.filter(t => {
  return t.is_breaking ||
    t.confidence_score >= 70 ||  // Lower to >= 50
    (t.z_score_velocity && t.z_score_velocity >= 2);  // Lower to >= 1.5
});

// Proposed (more permissive):
const actionable = trends.filter(t => {
  const orgScore = orgScores.get(t.id);
  const hasHighRelevance = orgScore && orgScore.relevance_score >= 25;

  return t.is_breaking ||
    t.confidence_score >= 50 ||
    (t.z_score_velocity && t.z_score_velocity >= 1.5) ||
    hasHighRelevance ||
    t.source_count >= 3;  // Multi-source corroboration
});
```

---

## Phase 5: MEDIUM - Monitoring & Alerting (Day 3)

**Agent:** `08-pipeline-operations-auditor.md` (monitoring mode)
**Estimated Time:** 1-2 hours
**Dependencies:** Phases 1-4 complete

### Task 5.1: Create Health Check Dashboard Query

```sql
-- Save as database function for monitoring
CREATE OR REPLACE FUNCTION check_pipeline_health()
RETURNS TABLE(
  component TEXT,
  status TEXT,
  last_activity TIMESTAMPTZ,
  minutes_since_activity NUMERIC,
  recommendation TEXT
) AS $$
BEGIN
  RETURN QUERY

  -- Check trend_evidence freshness
  SELECT
    'trend_evidence'::TEXT,
    CASE
      WHEN NOW() - MAX(discovered_at) < INTERVAL '10 minutes' THEN 'HEALTHY'
      WHEN NOW() - MAX(discovered_at) < INTERVAL '30 minutes' THEN 'WARNING'
      ELSE 'CRITICAL'
    END,
    MAX(discovered_at),
    EXTRACT(EPOCH FROM (NOW() - MAX(discovered_at)))/60,
    CASE
      WHEN NOW() - MAX(discovered_at) > INTERVAL '30 minutes'
      THEN 'Check fetch-google-news and fetch-rss-feeds'
      ELSE 'OK'
    END
  FROM trend_evidence

  UNION ALL

  -- Check trend_events freshness
  SELECT
    'trend_events'::TEXT,
    CASE
      WHEN NOW() - MAX(last_seen_at) < INTERVAL '15 minutes' THEN 'HEALTHY'
      WHEN NOW() - MAX(last_seen_at) < INTERVAL '60 minutes' THEN 'WARNING'
      ELSE 'CRITICAL'
    END,
    MAX(last_seen_at),
    EXTRACT(EPOCH FROM (NOW() - MAX(last_seen_at)))/60,
    CASE
      WHEN NOW() - MAX(last_seen_at) > INTERVAL '60 minutes'
      THEN 'Check detect-trend-events cron job'
      ELSE 'OK'
    END
  FROM trend_events
  WHERE is_trending = true

  UNION ALL

  -- Check scheduler health
  SELECT
    'job_executions'::TEXT,
    CASE
      WHEN COUNT(*) > 0 AND NOW() - MAX(started_at) < INTERVAL '5 minutes' THEN 'HEALTHY'
      WHEN COUNT(*) > 0 THEN 'WARNING'
      ELSE 'CRITICAL'
    END,
    MAX(started_at),
    CASE WHEN COUNT(*) > 0 THEN EXTRACT(EPOCH FROM (NOW() - MAX(started_at)))/60 ELSE 9999 END,
    CASE
      WHEN COUNT(*) = 0 THEN 'Scheduler not running - check pg_cron setup'
      ELSE 'OK'
    END
  FROM job_executions
  WHERE started_at > NOW() - INTERVAL '1 hour';

END;
$$ LANGUAGE plpgsql;
```

### Task 5.2: Set Up Alerting (Optional)

```sql
-- Create alert on pipeline failure
CREATE OR REPLACE FUNCTION alert_on_pipeline_failure()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'failed' THEN
    -- Insert into alerts table or send webhook
    INSERT INTO system_alerts (alert_type, severity, message, created_at)
    VALUES (
      'pipeline_failure',
      'high',
      format('Job %s failed: %s', NEW.job_id, NEW.error_message),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pipeline_failure_alert
AFTER INSERT OR UPDATE ON job_executions
FOR EACH ROW
WHEN (NEW.status = 'failed')
EXECUTE FUNCTION alert_on_pipeline_failure();
```

---

## Execution Timeline

```
Day 1 (Hours 0-8)
├── Phase 1: Scheduler Infrastructure [CRITICAL]
│   ├── 1.1 Enable extensions (30 min)
│   ├── 1.2 Configure Vault (30 min)
│   ├── 1.3 Populate scheduled_jobs (30 min)
│   ├── 1.4 Create pg_cron trigger (30 min)
│   └── 1.5 Verify setup (30 min)
│
└── Phase 2: Pipeline Activation [CRITICAL]
    ├── 2.1 Manual trigger detect-trend-events (15 min)
    ├── 2.2 Verify is_trending flags (15 min)
    ├── 2.3 Manual trigger compute-org-relevance (15 min)
    └── 2.4 Verify pipeline health (30 min)

Day 2 (Hours 8-16)
├── Phase 3: Data Source Revival [HIGH]
│   ├── 3.1 Diagnose Bluesky staleness (30 min)
│   ├── 3.2 Reactivate Bluesky ingestion (1 hour)
│   └── 3.3 Verify all sources active (30 min)
│
└── Phase 4: UI Data Flow Fix [HIGH]
    ├── 4.1 Verify view exists (30 min)
    ├── 4.2 Analyze actionability filters (30 min)
    └── 4.3 Adjust thresholds if needed (1 hour)

Day 3 (Hours 16-24)
└── Phase 5: Monitoring Setup [MEDIUM]
    ├── 5.1 Create health check function (1 hour)
    └── 5.2 Set up alerting (1 hour)
```

---

## Success Criteria

| Metric | Before | After | Verification |
|--------|--------|-------|--------------|
| job_executions rows (24h) | 0 | >100 | `SELECT COUNT(*) FROM job_executions` |
| Trending events | Unknown | >20 | `SELECT COUNT(*) FROM trend_events WHERE is_trending=true` |
| UI displays trends | No | Yes | Visual check of News & Trends page |
| Bluesky data age | 14,026 min | <30 min | `SELECT MAX(created_at) FROM bluesky_posts` |
| Pipeline health | CRITICAL | HEALTHY | `SELECT * FROM check_pipeline_health()` |

---

## Rollback Plan

Each phase should be committed separately for targeted rollback:

1. **Phase 1 Rollback:**
   ```sql
   SELECT cron.unschedule('master-scheduler');
   DELETE FROM scheduled_jobs WHERE is_active = true;
   ```

2. **Phase 4 Rollback:**
   - Revert `NewsTrendsPage.tsx` actionability thresholds
   - Drop recreated views: `DROP VIEW IF EXISTS trend_events_active;`

---

## Post-Remediation Audit

After completing all phases, run:

```bash
# Full platform re-audit
curl -X POST \
  "https://nuclmzoasgydubdshtab.supabase.co/functions/v1/audit-political-intelligence" \
  -H "Authorization: Bearer [SERVICE_ROLE_KEY]" \
  -H "Content-Type: application/json"
```

**Expected Result:**
- Overall Status: 🟢 HEALTHY
- Health Score: >80/100
- All phases: PASS

---

## References

- [Supabase Cron Documentation](https://supabase.com/docs/guides/cron)
- [Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)
- [Processing Large Jobs with Edge Functions](https://supabase.com/blog/processing-large-jobs-with-edge-functions)
