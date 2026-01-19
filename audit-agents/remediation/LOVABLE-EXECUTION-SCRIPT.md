# Lovable Execution Script - Platform Remediation

**Generated:** 2026-01-19
**Priority:** CRITICAL
**Estimated Time:** 4-6 hours

---

## Overview

This script contains all SQL and configuration changes needed to fix the News & Trends "No actionable signals" issue. Execute in order.

---

## Phase 1: Database Setup (Run First)

### 1.1 Enable Extensions

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS vault;

-- Grant permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT USAGE ON SCHEMA vault TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;
```

### 1.2 Configure Vault Secrets

**IMPORTANT:** Replace placeholders with actual values

```sql
-- Store project URL
SELECT vault.create_secret(
  'https://nuclmzoasgydubdshtab.supabase.co',
  'project_url'
);

-- Store service role key (get from Supabase Dashboard → Settings → API)
SELECT vault.create_secret(
  'YOUR_SERVICE_ROLE_KEY_HERE',
  'service_role_key'
);

-- Store cron secret (generate with: openssl rand -base64 32)
SELECT vault.create_secret(
  'GENERATE_A_SECURE_32_CHAR_STRING_HERE',
  'cron_secret'
);
```

### 1.3 Populate Scheduled Jobs

```sql
-- Insert all required scheduled jobs
INSERT INTO scheduled_jobs (job_name, job_type, schedule, endpoint, is_active, description)
VALUES
  ('fetch_google_news', 'fetch_news', '*/5 * * * *', '/functions/v1/fetch-google-news', true, 'Fetch Google News'),
  ('fetch_rss_feeds', 'fetch_rss', '*/15 * * * *', '/functions/v1/fetch-rss-feeds', true, 'Fetch RSS feeds'),
  ('detect_trend_events', 'detect_trends', '*/5 * * * *', '/functions/v1/detect-trend-events', true, 'Detect trends'),
  ('extract_trend_entities', 'extract_entities', '*/15 * * * *', '/functions/v1/extract-trend-entities', true, 'Extract entities'),
  ('tag_trend_policy_domains', 'tag_domains', '*/15 * * * *', '/functions/v1/tag-trend-policy-domains', true, 'Tag domains'),
  ('tag_trend_geographies', 'tag_geo', '*/15 * * * *', '/functions/v1/tag-trend-geographies', true, 'Tag geographies'),
  ('compute_org_relevance', 'compute_relevance', '*/15 * * * *', '/functions/v1/compute-org-relevance', true, 'Compute org relevance'),
  ('match_entity_watchlist', 'match_watchlist', '*/15 * * * *', '/functions/v1/match-entity-watchlist', true, 'Match watchlists'),
  ('update_org_affinities', 'learn_affinities', '0 * * * *', '/functions/v1/update-org-affinities', true, 'Update affinities'),
  ('decay_stale_affinities', 'decay_affinities', '0 4 * * *', '/functions/v1/decay-stale-affinities', true, 'Decay affinities'),
  ('ttl_cleanup', 'cleanup', '0 3 * * *', '/functions/v1/ttl-cleanup', true, 'TTL cleanup'),
  ('collect_bluesky_posts', 'fetch_social', '*/10 * * * *', '/functions/v1/collect-bluesky-posts', true, 'Collect Bluesky'),
  ('analyze_bluesky_posts', 'analyze_social', '*/15 * * * *', '/functions/v1/analyze-bluesky-posts', true, 'Analyze Bluesky'),
  ('calculate_bluesky_trends', 'calc_social_trends', '*/15 * * * *', '/functions/v1/calculate-bluesky-trends', true, 'Bluesky trends')
ON CONFLICT (job_name) DO UPDATE SET
  is_active = true,
  schedule = EXCLUDED.schedule,
  endpoint = EXCLUDED.endpoint;
```

### 1.4 Create Master Scheduler

```sql
-- Remove existing if present
SELECT cron.unschedule('master-scheduler');

-- Create master scheduler cron job
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
    body := jsonb_build_object('triggered_by', 'pg_cron', 'timestamp', NOW()::text)
  ) AS request_id;
  $$
);
```

### 1.5 Create trend_events_active View

```sql
CREATE OR REPLACE VIEW public.trend_events_active AS
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
  END as baseline_delta_pct,
  COALESCE(te.trend_score, 0) +
    CASE WHEN te.is_breaking THEN 50 ELSE 0 END +
    COALESCE(te.z_score_velocity, 0) * 10 as rank_score
FROM trend_events te
WHERE te.last_seen_at > NOW() - INTERVAL '48 hours';

GRANT SELECT ON public.trend_events_active TO authenticated;
GRANT SELECT ON public.trend_events_active TO anon;
```

---

## Phase 2: Set Environment Variables

In Supabase Dashboard → Settings → Edge Functions, set:

| Variable | Value |
|----------|-------|
| `CRON_SECRET` | Same value used in vault.create_secret |

---

## Phase 3: Manual Pipeline Trigger

After database setup, trigger the pipeline to populate data:

### 3.1 Trigger detect-trend-events

```bash
curl -X POST \
  "https://nuclmzoasgydubdshtab.supabase.co/functions/v1/detect-trend-events" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "x-cron-secret: YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"force_full_scan": true}'
```

### 3.2 Trigger compute-org-relevance

```bash
curl -X POST \
  "https://nuclmzoasgydubdshtab.supabase.co/functions/v1/compute-org-relevance" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "x-cron-secret: YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"process_all_orgs": true}'
```

---

## Phase 4: Verification Queries

### 4.1 Check Scheduler is Running

```sql
-- After 2-3 minutes, check cron job runs
SELECT jobid, status, start_time, end_time
FROM cron.job_run_details
WHERE start_time > NOW() - INTERVAL '5 minutes'
ORDER BY start_time DESC;

-- Check job_executions is populating
SELECT * FROM job_executions ORDER BY started_at DESC LIMIT 5;
```

### 4.2 Check Trending Data

```sql
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_trending = true) as trending,
  COUNT(*) FILTER (WHERE confidence_score >= 70) as high_confidence
FROM trend_events
WHERE last_seen_at > NOW() - INTERVAL '24 hours';
```

### 4.3 Check UI Query Will Work

```sql
SELECT COUNT(*) as would_display
FROM trend_events
WHERE is_trending = true
  AND confidence_score >= 30
  AND last_seen_at > NOW() - INTERVAL '24 hours'
  AND (
    is_breaking = true
    OR confidence_score >= 70
    OR z_score_velocity >= 2
  );
```

---

## Phase 5: Optional UI Adjustment

If data exists but UI still shows empty, update actionability filter:

**File:** `src/pages/admin/NewsTrendsPage.tsx` (around line 112)

**Current:**
```typescript
const actionable = trends.filter(t => {
  return t.is_breaking ||
    t.confidence_score >= 70 ||
    (t.z_score_velocity && t.z_score_velocity >= 2);
});
```

**Change to:**
```typescript
const actionable = trends.filter(t => {
  const orgScore = orgScores.get(t.id);
  const hasHighRelevance = orgScore && orgScore.relevance_score >= 25;

  return t.is_breaking ||
    t.confidence_score >= 50 ||
    (t.z_score_velocity && t.z_score_velocity >= 1.5) ||
    hasHighRelevance ||
    t.source_count >= 3;
});
```

---

## Success Criteria

After completing all phases:

| Check | Expected |
|-------|----------|
| `cron.job_run_details` has rows | ✅ Yes |
| `job_executions` has rows | ✅ Yes |
| Trending events exist | ✅ >10 |
| UI shows trends | ✅ Yes |

---

## Troubleshooting

### "vault.create_secret does not exist"
Run: `CREATE EXTENSION IF NOT EXISTS vault;`

### Cron job runs but job_executions empty
Check CRON_SECRET matches between vault and Edge Function secrets

### UI still empty after all fixes
1. Hard refresh browser (Cmd+Shift+R)
2. Check browser console for errors
3. Verify `trend_events_active` view returns data
