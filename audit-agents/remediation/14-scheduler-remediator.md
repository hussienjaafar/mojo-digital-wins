# Scheduler Infrastructure Remediator

**Role:** DevOps / Platform Engineer
**Focus:** pg_cron setup, Vault secrets, scheduled jobs infrastructure
**Priority:** CRITICAL
**Estimated Time:** 2-4 hours

---

## Overview

This agent fixes the completely non-functional scheduler system. The audit found that `job_executions` table is EMPTY, meaning no scheduled jobs have ever run. This is the root cause of the "No actionable signals" issue.

---

## Prerequisites

Before starting, verify you have:

- [ ] Supabase project admin access
- [ ] Service role key
- [ ] CRON_SECRET value (or ability to generate one)
- [ ] Access to Supabase Dashboard → Database → Extensions

---

## Step-by-Step Remediation

### Step 1: Enable Required Extensions

**Method A: Via Supabase Dashboard**

1. Go to Database → Extensions
2. Search for `pg_cron` and enable it
3. Search for `pg_net` and enable it
4. Search for `vault` and enable it (if not already)

**Method B: Via SQL**

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Enable pg_net for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Enable vault for secure secret storage
CREATE EXTENSION IF NOT EXISTS vault;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT USAGE ON SCHEMA vault TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;
```

**Verification:**

```sql
SELECT extname, extversion FROM pg_extension
WHERE extname IN ('pg_cron', 'pg_net', 'vault');

-- Expected: 3 rows returned
```

---

### Step 2: Configure Vault Secrets

Store sensitive values in Supabase Vault for secure access by cron jobs:

```sql
-- Store project URL
SELECT vault.create_secret(
  'https://nuclmzoasgydubdshtab.supabase.co',
  'project_url'
);

-- Store service role key for authenticated cron calls
-- IMPORTANT: Replace [YOUR_SERVICE_ROLE_KEY] with actual key
SELECT vault.create_secret(
  '[YOUR_SERVICE_ROLE_KEY]',
  'service_role_key'
);

-- Generate and store cron secret
-- IMPORTANT: Generate a secure random string (32+ chars)
SELECT vault.create_secret(
  '[GENERATE_SECURE_RANDOM_STRING]',
  'cron_secret'
);
```

**To generate a secure cron secret:**

```bash
openssl rand -base64 32
# Or use: head -c 32 /dev/urandom | base64
```

**Verification:**

```sql
SELECT name FROM vault.secrets
WHERE name IN ('project_url', 'service_role_key', 'cron_secret');

-- Expected: 3 rows returned
```

---

### Step 3: Populate scheduled_jobs Table

Ensure all required jobs are registered:

```sql
-- Clear any orphaned jobs first
DELETE FROM scheduled_jobs WHERE job_name IS NULL;

-- Insert all required scheduled jobs
INSERT INTO scheduled_jobs (
  job_name, job_type, schedule, endpoint, is_active, description
)
VALUES
  -- TIER 1: Critical Ingestion (every 5-15 min)
  ('fetch_google_news', 'fetch_news', '*/5 * * * *',
   '/functions/v1/fetch-google-news', true,
   'Fetch Google News political articles'),

  ('fetch_rss_feeds', 'fetch_rss', '*/15 * * * *',
   '/functions/v1/fetch-rss-feeds', true,
   'Fetch RSS feed articles from configured sources'),

  -- TIER 1: Critical Processing (every 5-15 min)
  ('detect_trend_events', 'detect_trends', '*/5 * * * *',
   '/functions/v1/detect-trend-events', true,
   'Detect trending events and set is_trending flags'),

  ('extract_trend_entities', 'extract_entities', '*/15 * * * *',
   '/functions/v1/extract-trend-entities', true,
   'Extract politicians, orgs, legislation from trends'),

  ('tag_trend_policy_domains', 'tag_domains', '*/15 * * * *',
   '/functions/v1/tag-trend-policy-domains', true,
   'Tag trends with policy domains'),

  ('tag_trend_geographies', 'tag_geo', '*/15 * * * *',
   '/functions/v1/tag-trend-geographies', true,
   'Tag trends with geographic regions'),

  -- TIER 1: Critical Scoring (every 15 min)
  ('compute_org_relevance', 'compute_relevance', '*/15 * * * *',
   '/functions/v1/compute-org-relevance', true,
   'Compute organization-specific relevance scores'),

  ('match_entity_watchlist', 'match_watchlist', '*/15 * * * *',
   '/functions/v1/match-entity-watchlist', true,
   'Match trends against org watchlists'),

  -- TIER 2: Learning (hourly)
  ('update_org_affinities', 'learn_affinities', '0 * * * *',
   '/functions/v1/update-org-affinities', true,
   'Update topic affinity scores from user behavior'),

  ('correlate_trends_campaigns', 'correlate', '30 * * * *',
   '/functions/v1/correlate-trends-campaigns', true,
   'Correlate trends with campaign performance'),

  -- TIER 3: Maintenance (daily)
  ('decay_stale_affinities', 'decay_affinities', '0 4 * * *',
   '/functions/v1/decay-stale-affinities', true,
   'Decay old affinity scores to prevent stale data'),

  ('ttl_cleanup', 'cleanup', '0 3 * * *',
   '/functions/v1/ttl-cleanup', true,
   'Clean up expired cache and old data'),

  ('cleanup_old_cache', 'cleanup', '0 5 * * 0',
   '/functions/v1/cleanup-old-cache', true,
   'Weekly cleanup of old cache entries')

ON CONFLICT (job_name) DO UPDATE SET
  is_active = true,
  schedule = EXCLUDED.schedule,
  endpoint = EXCLUDED.endpoint,
  description = EXCLUDED.description,
  updated_at = NOW();
```

**Verification:**

```sql
SELECT job_name, schedule, is_active, endpoint
FROM scheduled_jobs
WHERE is_active = true
ORDER BY schedule;

-- Expected: 13+ rows with is_active = true
```

---

### Step 4: Create pg_cron Master Trigger

This creates the cron job that triggers `run-scheduled-jobs` every minute:

```sql
-- First, remove any existing master scheduler
SELECT cron.unschedule('master-scheduler');

-- Create the master scheduler
SELECT cron.schedule(
  'master-scheduler',  -- Job name
  '* * * * *',         -- Every minute
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
           || '/functions/v1/run-scheduled-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := jsonb_build_object(
      'triggered_by', 'pg_cron',
      'timestamp', NOW()::text
    )
  ) AS request_id;
  $$
);
```

**Verification:**

```sql
-- Check cron job is scheduled
SELECT jobid, schedule, command, active
FROM cron.job
WHERE jobname = 'master-scheduler';

-- Expected: 1 row with active = true
```

---

### Step 5: Update Environment Variables

Ensure the CRON_SECRET is set in Supabase Edge Function secrets:

**Via Supabase CLI:**

```bash
supabase secrets set CRON_SECRET="[YOUR_CRON_SECRET]"
```

**Via Dashboard:**

1. Go to Settings → Edge Functions
2. Add secret: `CRON_SECRET` = `[YOUR_CRON_SECRET]`

---

### Step 6: Verify Scheduler is Running

Wait 2-3 minutes after setup, then verify:

```sql
-- Check pg_cron job runs
SELECT jobid, runid, status, start_time, end_time
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'master-scheduler')
ORDER BY start_time DESC
LIMIT 5;

-- Check job_executions table is populating
SELECT
  job_id,
  started_at,
  completed_at,
  status,
  error_message
FROM job_executions
ORDER BY started_at DESC
LIMIT 10;

-- Check scheduled_jobs last_run_at is updating
SELECT job_name, last_run_at, next_run_at
FROM scheduled_jobs
WHERE is_active = true
ORDER BY last_run_at DESC NULLS LAST;
```

**Expected Results:**

- `cron.job_run_details` should show runs every minute
- `job_executions` should have new rows appearing
- `scheduled_jobs.last_run_at` should be recent

---

## Troubleshooting

### Issue: "function vault.create_secret does not exist"

**Fix:** Enable vault extension:

```sql
CREATE EXTENSION IF NOT EXISTS vault;
```

### Issue: "permission denied for schema cron"

**Fix:** Grant permissions:

```sql
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT USAGE ON SCHEMA cron TO authenticated;
```

### Issue: pg_cron job runs but job_executions stays empty

**Check:** Verify CRON_SECRET matches between vault and edge function:

```sql
SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret';
```

Compare with: Supabase Dashboard → Settings → Edge Functions → CRON_SECRET

### Issue: HTTP requests failing with 401

**Fix:** The x-cron-secret header must match exactly. Check:

1. Vault secret is correctly stored
2. Edge function CRON_SECRET environment variable is set
3. Header name is exactly `x-cron-secret` (lowercase)

---

## Verification Checklist

- [ ] pg_cron extension enabled
- [ ] pg_net extension enabled
- [ ] Vault secrets configured (3 secrets)
- [ ] scheduled_jobs table populated (13+ active jobs)
- [ ] Master scheduler cron job created
- [ ] CRON_SECRET set in Edge Function secrets
- [ ] job_executions table receiving new rows
- [ ] No errors in cron.job_run_details

---

## Rollback

To completely remove scheduler infrastructure:

```sql
-- Unschedule the master job
SELECT cron.unschedule('master-scheduler');

-- Deactivate all scheduled jobs
UPDATE scheduled_jobs SET is_active = false;

-- Remove vault secrets (optional)
DELETE FROM vault.secrets WHERE name IN ('project_url', 'service_role_key', 'cron_secret');
```

---

## Next Agent

After completing this agent, proceed to:
→ `15-pipeline-activator.md` (Manual trigger pipeline stages)
