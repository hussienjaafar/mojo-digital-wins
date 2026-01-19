# Data Freshness Fixer

**Role:** Data Engineer / Integration Specialist
**Focus:** Stale data sources, API reconnection, source health
**Priority:** HIGH
**Estimated Time:** 2-3 hours
**Dependencies:** `15-pipeline-activator.md` should be complete

---

## Overview

This agent addresses stale data sources identified in the audit. The primary issue found was Bluesky data being 14,026 minutes (9.7 days) old, indicating a broken integration.

---

## Current State Analysis

### Audit Findings

| Source Type | Status | Age | Expected |
|-------------|--------|-----|----------|
| articles (RSS) | ✅ FRESH | 3 min | <5 min |
| google_news | ❓ UNKNOWN | ? | <5 min |
| bluesky_posts | ❌ STALE | 14,026 min | <10 min |
| reddit | ❓ UNKNOWN | ? | <30 min |

---

## Step-by-Step Remediation

### Step 1: Diagnose All Source Types

```sql
-- Comprehensive source health check
SELECT
  source_type,
  COUNT(*) as items_24h,
  COUNT(*) as items_1h,
  MAX(discovered_at) as latest,
  ROUND(EXTRACT(EPOCH FROM (NOW() - MAX(discovered_at)))/60) as minutes_stale,
  CASE
    WHEN NOW() - MAX(discovered_at) < INTERVAL '15 minutes' THEN '✅ FRESH'
    WHEN NOW() - MAX(discovered_at) < INTERVAL '1 hour' THEN '⚠️ STALE'
    WHEN NOW() - MAX(discovered_at) < INTERVAL '24 hours' THEN '❌ VERY STALE'
    ELSE '💀 DEAD'
  END as status
FROM trend_evidence
WHERE discovered_at > NOW() - INTERVAL '24 hours'
GROUP BY source_type
ORDER BY minutes_stale DESC;
```

---

### Step 2: Fix Bluesky Integration

**2.1 Check Bluesky Configuration:**

```sql
-- Check if Bluesky jobs are scheduled
SELECT job_name, is_active, schedule, last_run_at, endpoint
FROM scheduled_jobs
WHERE job_name LIKE '%bluesky%';
```

**2.2 Add Missing Bluesky Jobs:**

```sql
INSERT INTO scheduled_jobs (job_name, job_type, schedule, endpoint, is_active, description)
VALUES
  ('collect_bluesky_posts', 'fetch_social', '*/10 * * * *',
   '/functions/v1/collect-bluesky-posts', true,
   'Collect political posts from Bluesky'),

  ('analyze_bluesky_posts', 'analyze_social', '*/15 * * * *',
   '/functions/v1/analyze-bluesky-posts', true,
   'Analyze Bluesky posts for sentiment and topics'),

  ('calculate_bluesky_trends', 'calc_social_trends', '*/15 * * * *',
   '/functions/v1/calculate-bluesky-trends', true,
   'Calculate trending topics from Bluesky')
ON CONFLICT (job_name) DO UPDATE SET
  is_active = true,
  schedule = EXCLUDED.schedule;
```

**2.3 Check Bluesky Credentials:**

Verify environment variables are set:

```bash
# Via Supabase CLI
supabase secrets list | grep -i bluesky

# Expected:
# BLUESKY_USERNAME
# BLUESKY_PASSWORD (or BLUESKY_APP_PASSWORD)
```

If missing, set them:

```bash
supabase secrets set BLUESKY_USERNAME="your-handle.bsky.social"
supabase secrets set BLUESKY_APP_PASSWORD="xxxx-xxxx-xxxx-xxxx"
```

**2.4 Manually Trigger Bluesky Collection:**

```bash
curl -X POST \
  "https://nuclmzoasgydubdshtab.supabase.co/functions/v1/collect-bluesky-posts" \
  -H "Authorization: Bearer [SERVICE_ROLE_KEY]" \
  -H "x-cron-secret: [CRON_SECRET]" \
  -H "Content-Type: application/json"
```

**2.5 Verify Bluesky Data Flow:**

```sql
-- Check if new Bluesky posts arrived
SELECT
  COUNT(*) as new_posts,
  MAX(created_at) as latest
FROM bluesky_posts
WHERE created_at > NOW() - INTERVAL '1 hour';
```

---

### Step 3: Fix Google News Integration

**3.1 Verify Google News API Key:**

```bash
# Check if API key is set
supabase secrets list | grep -i google

# Expected: GOOGLE_NEWS_API_KEY
```

**3.2 Test Google News Fetch:**

```bash
curl -X POST \
  "https://nuclmzoasgydubdshtab.supabase.co/functions/v1/fetch-google-news" \
  -H "Authorization: Bearer [SERVICE_ROLE_KEY]" \
  -H "x-cron-secret: [CRON_SECRET]" \
  -H "Content-Type: application/json"
```

**3.3 Check Response for Errors:**

If the function returns an error, check:

- API key validity
- Rate limit status
- API quota remaining

**3.4 Verify Google News Data:**

```sql
SELECT
  COUNT(*) as items_24h,
  MAX(discovered_at) as latest
FROM trend_evidence
WHERE source_type = 'google_news'
AND discovered_at > NOW() - INTERVAL '24 hours';
```

---

### Step 4: Verify RSS Feed Health

**4.1 Check RSS Source Configuration:**

```sql
-- List all active RSS sources
SELECT
  id,
  name,
  url,
  is_active,
  last_fetched_at,
  NOW() - last_fetched_at as since_last_fetch,
  fetch_error_count
FROM rss_sources
WHERE is_active = true
ORDER BY last_fetched_at DESC NULLS LAST
LIMIT 20;
```

**4.2 Identify Problematic Feeds:**

```sql
-- Feeds with fetch errors
SELECT name, url, fetch_error_count, last_error_message
FROM rss_sources
WHERE fetch_error_count > 3
AND is_active = true
ORDER BY fetch_error_count DESC;
```

**4.3 Reset Error Counts for Retry:**

```sql
-- Reset error counts to allow retry
UPDATE rss_sources
SET fetch_error_count = 0,
    last_error_message = NULL
WHERE fetch_error_count > 0
AND is_active = true;
```

**4.4 Trigger RSS Fetch:**

```bash
curl -X POST \
  "https://nuclmzoasgydubdshtab.supabase.co/functions/v1/fetch-rss-feeds" \
  -H "Authorization: Bearer [SERVICE_ROLE_KEY]" \
  -H "x-cron-secret: [CRON_SECRET]" \
  -H "Content-Type: application/json"
```

---

### Step 5: Add Missing Source Types

If certain source types are completely missing:

**5.1 Reddit (Optional):**

```sql
-- Add Reddit job if needed
INSERT INTO scheduled_jobs (job_name, job_type, schedule, endpoint, is_active, description)
VALUES
  ('fetch_reddit_posts', 'fetch_social', '*/30 * * * *',
   '/functions/v1/fetch-reddit-posts', true,
   'Fetch posts from political subreddits')
ON CONFLICT (job_name) DO NOTHING;
```

Verify Reddit credentials:

```bash
supabase secrets set REDDIT_CLIENT_ID="..."
supabase secrets set REDDIT_CLIENT_SECRET="..."
supabase secrets set REDDIT_USER_AGENT="..."
```

**5.2 Government Sources (Optional):**

```sql
-- Add Congress.gov job if needed
INSERT INTO scheduled_jobs (job_name, job_type, schedule, endpoint, is_active, description)
VALUES
  ('sync_congress_bills', 'fetch_gov', '0 */6 * * *',
   '/functions/v1/sync-congress-bills', true,
   'Sync bills from Congress.gov API'),

  ('fetch_executive_orders', 'fetch_gov', '0 */6 * * *',
   '/functions/v1/fetch-executive-orders', true,
   'Fetch executive orders from Federal Register')
ON CONFLICT (job_name) DO NOTHING;
```

---

### Step 6: Source Diversity Verification

```sql
-- Calculate source diversity score
WITH source_counts AS (
  SELECT
    source_type,
    COUNT(*) as count,
    SUM(COUNT(*)) OVER () as total
  FROM trend_evidence
  WHERE discovered_at > NOW() - INTERVAL '24 hours'
  GROUP BY source_type
)
SELECT
  source_type,
  count as items,
  ROUND(100.0 * count / NULLIF(total, 0), 1) as percentage,
  CASE
    WHEN 100.0 * count / NULLIF(total, 0) > 70 THEN '❌ DOMINANT'
    WHEN 100.0 * count / NULLIF(total, 0) > 40 THEN '⚠️ HIGH'
    WHEN 100.0 * count / NULLIF(total, 0) > 20 THEN '✅ BALANCED'
    ELSE '✅ LOW'
  END as concentration
FROM source_counts
ORDER BY count DESC;

-- Target: No single source > 50%
```

---

## Troubleshooting

### Issue: Bluesky authentication failing

**Symptoms:** 401 errors in function logs

**Fix:**
1. Generate new app password at bsky.app → Settings → App Passwords
2. Update secret: `supabase secrets set BLUESKY_APP_PASSWORD="new-password"`
3. Redeploy function: `supabase functions deploy collect-bluesky-posts`

### Issue: Google News rate limited

**Symptoms:** 429 errors, decreasing volume

**Fix:**
1. Check API quota in Google Cloud Console
2. Reduce fetch frequency from `*/5` to `*/15` minutes
3. Consider using multiple API keys in rotation

### Issue: RSS feeds timing out

**Symptoms:** Timeout errors, incomplete data

**Fix:**
1. Increase function timeout
2. Reduce batch size per fetch
3. Add retry logic with exponential backoff

---

## Verification Checklist

After completing all steps:

```sql
-- Final source health verification
SELECT
  source_type,
  COUNT(*) as items_24h,
  ROUND(EXTRACT(EPOCH FROM (NOW() - MAX(discovered_at)))/60) as minutes_stale,
  CASE
    WHEN NOW() - MAX(discovered_at) < INTERVAL '15 minutes' THEN '✅'
    ELSE '❌'
  END as healthy
FROM trend_evidence
WHERE discovered_at > NOW() - INTERVAL '24 hours'
GROUP BY source_type
ORDER BY source_type;
```

**Expected Results:**

| source_type | items_24h | minutes_stale | healthy |
|-------------|-----------|---------------|---------|
| google_news | >50 | <15 | ✅ |
| rss | >100 | <15 | ✅ |
| bluesky | >50 | <15 | ✅ |

---

## Next Agent

After completing this agent, proceed to:
→ `17-ui-data-flow-fixer.md` (Fix UI data display issues)
