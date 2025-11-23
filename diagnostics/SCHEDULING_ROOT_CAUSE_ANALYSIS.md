# 🔍 ROOT CAUSE ANALYSIS: Daily Briefings Not Auto-Generating

**Date**: November 23, 2025
**Status**: IDENTIFIED - Simple fix needed
**Severity**: Medium (Data collection working, automation partially broken)

---

## 📊 CURRENT HEALTH STATUS (User-Provided Data)

| System | Status | Records | Last Update | Expected Freshness |
|--------|--------|---------|-------------|-------------------|
| RSS Articles | ✅ HEALTHY | 7,444 | 4.6 minutes ago | < 30 min |
| Bluesky Posts | ✅ HEALTHY | 217,380 | Streaming live | < 5 min |
| Daily Briefings | 🟡 STALE | 2 | **92.8 hours ago** | < 24 hours |

**Problem**: Daily briefings should generate every 30 minutes but haven't run in ~4 days.

---

## 🏗️ SCHEDULING ARCHITECTURE (Current State)

### **Three Scheduling Mechanisms:**

#### 1. **GitHub Actions** ✅ WORKING (Partial)
**File**: `.github/workflows/scheduled-jobs.yml`
```yaml
schedule:
  - cron: '*/5 * * * *'  # Every 5 minutes
jobs:
  run-scheduler:
    steps:
      - run: curl POST $SUPABASE_URL/functions/v1/run-scheduled-jobs
```

**Status**:
- ✅ Deployed and running
- ✅ Calling `run-scheduled-jobs` every 5 minutes
- ✅ RSS sync working (proves it's functional)
- ⚠️ **BUT** only running jobs marked as `is_active=true` in `scheduled_jobs` table

#### 2. **Direct pg_cron Jobs** ✅ WORKING (Bluesky Only)
**Migration**: `20251122204218_9f36cc22-93d3-49f5-81a5-c160de8dfef8.sql`

```sql
-- REMOVED general scheduler (line 3):
SELECT cron.unschedule('run-scheduled-jobs-every-minute');

-- ADDED direct pg_cron jobs for Bluesky:
SELECT cron.schedule('bluesky-stream-every-2-min', '*/2 * * * *', ...);
SELECT cron.schedule('analyze-bluesky-every-10-min', '*/10 * * * *', ...);
SELECT cron.schedule('correlate-social-news-every-15-min', '*/15 * * * *', ...);
```

**Status**: ✅ Working perfectly (217,380 Bluesky posts collected)

#### 3. **scheduled_jobs Table** ❓ STATUS UNKNOWN
**Migration**: `20251118000003_scheduled_automation.sql`

**Expected Jobs**:
```sql
INSERT INTO scheduled_jobs (job_name, job_type, schedule) VALUES
  ('RSS Feed Sync', 'fetch_rss', '*/5 * * * *'),
  ('Smart Alerting', 'smart_alerting', '*/30 * * * *'),
  ('Daily Briefing Email', 'send_briefings', '0 8 * * *');
```

**Status**: ❓ Need to verify what's in the table and which jobs are `is_active=true`

---

## 🔍 ROOT CAUSE ANALYSIS

### **Why is RSS working but Smart Alerting is not?**

#### Theory #1: `is_active` Flag
**Hypothesis**: The `scheduled_jobs` table has RSS marked as `is_active=true` but Smart Alerting is `is_active=false`.

**Evidence**:
- GitHub Actions calls `run-scheduled-jobs` every 5 minutes ✅
- `run-scheduled-jobs` only runs jobs where `is_active=true` (line 30 in index.ts)
- RSS has fresh data (4.6 min ago) → Must be active
- Smart Alerting has no data (92.8 hours) → Must be inactive

**From run-scheduled-jobs/index.ts**:
```typescript
let query = supabase
  .from('scheduled_jobs')
  .select('*')
  .eq('is_active', true);  // ← ONLY ACTIVE JOBS

if (!forceRun) {
  query = query.lte('next_run_at', new Date().toISOString());
}
```

#### Theory #2: Job Auto-Disabled After Failures
**Hypothesis**: Smart Alerting failed 5 times in a row and was auto-disabled.

**Evidence**:
- Migration `20251122233823` added auto-disable logic (lines 88-90):
```sql
-- Auto-disable after 5 consecutive failures
is_active = CASE
  WHEN p_status = 'failed' AND COALESCE(v_consecutive_failures, 0) >= 4 THEN false
  ELSE is_active
END
```

**This means**:
- If a job fails 5 times → `is_active` automatically set to `false`
- Future scheduler runs skip it
- Job becomes "stuck" in disabled state until manually re-enabled

#### Theory #3: `next_run_at` Not Set Correctly
**Hypothesis**: Smart Alerting has `next_run_at` in the future (not due to run yet).

**Less likely** because:
- Job should have run at least once in 92.8 hours
- `*/30 * * * *` cron = every 30 minutes
- Should have 278+ opportunities to run

---

## 🎯 MOST LIKELY ROOT CAUSE

**Smart Alerting job is `is_active = false` in the `scheduled_jobs` table.**

**How this happened:**
1. Initial setup: Job created with `is_active = true`
2. Early execution: Job failed (common during development)
3. Retry failures: Consecutive failures accumulated
4. Auto-disable: After 5th failure, migration set `is_active = false`
5. **Result**: Job never runs again, even though code is now fixed

**Why RSS still works:**
- RSS has been more stable (fewer failures)
- OR was manually re-enabled at some point
- OR has `consecutive_failures < 5`

---

## ✅ DIAGNOSTIC QUERY TO RUN

**Run this in Supabase SQL Editor** to confirm the root cause:

```sql
-- File: CHECK_SCHEDULED_JOBS_TABLE.sql (created in C:\Users\Husse\)
SELECT
  job_name,
  job_type,
  schedule,
  is_active,  -- ← Check this!
  last_run_at,
  next_run_at,
  last_run_status,
  last_error,
  consecutive_failures,  -- ← And this!
  EXTRACT(EPOCH FROM (NOW() - last_run_at)) / 60 AS minutes_since_last_run
FROM scheduled_jobs
ORDER BY
  is_active DESC,
  last_run_at DESC;
```

**Expected Results:**

| job_name | is_active | consecutive_failures | Diagnosis |
|----------|-----------|---------------------|-----------|
| RSS Feed Sync | ✅ true | 0-4 | Working correctly |
| Smart Alerting | ❌ **false** | **5+** | 🔴 ROOT CAUSE |
| Daily Briefing Email | ❌ false | 5+ | Same issue |
| Collect Bluesky Posts | ✅ true | 0 | Direct pg_cron (not in table?) |

---

## 🔧 FIX (Two Options)

### **Option 1: Re-enable Jobs (Quick Fix - 30 seconds)**

**Run in Supabase SQL Editor:**
```sql
-- Re-enable Smart Alerting
UPDATE scheduled_jobs
SET
  is_active = true,
  consecutive_failures = 0,
  next_run_at = NOW() + INTERVAL '5 minutes',
  last_error = NULL
WHERE job_name = 'Smart Alerting';

-- Re-enable Daily Briefing Email
UPDATE scheduled_jobs
SET
  is_active = true,
  consecutive_failures = 0,
  next_run_at = NOW() + INTERVAL '5 minutes',
  last_error = NULL
WHERE job_name = 'Daily Briefing Email';

-- Verify
SELECT job_name, is_active, consecutive_failures, next_run_at
FROM scheduled_jobs
WHERE job_name IN ('Smart Alerting', 'Daily Briefing Email');
```

**Within 5 minutes:**
- GitHub Actions will call `run-scheduled-jobs`
- `run-scheduled-jobs` will see both jobs are active + due
- Smart Alerting edge function will execute
- Daily briefing will generate

### **Option 2: Direct pg_cron Jobs (Permanent Fix - 5 minutes)**

**Add direct pg_cron jobs** (like we did for Bluesky):

**Create new migration**: `20251123_add_direct_smart_alerting_cron.sql`
```sql
-- Add direct pg_cron job for Smart Alerting (every 30 min)
SELECT cron.schedule(
  'smart-alerting-every-30-min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://nuclmzoasgydubdshtab.supabase.co/functions/v1/smart-alerting',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51Y2xtem9hc2d5ZHViZHNodGFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MDgxNTMsImV4cCI6MjA3ODQ4NDE1M30.-1EDAX7A5pQxtFs3a9M4R2BHBMbWkoMdA5NLWdZyEjo'
    ),
    body := jsonb_build_object('action', 'full')
  ) AS request_id;
  $$
);

-- Add direct pg_cron job for Daily Briefing Email (daily at 8 AM)
SELECT cron.schedule(
  'daily-briefing-email-8am',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://nuclmzoasgydubdshtab.supabase.co/functions/v1/send-daily-briefing',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51Y2xtem9hc2d5ZHViZHNodGFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MDgxNTMsImV4cCI6MjA3ODQ4NDE1M30.-1EDAX7A5pQxtFs3a9M4R2BHBMbWkoMdA5NLWdZyEjo'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Optional: Add for RSS (replace GitHub Actions dependency)
SELECT cron.schedule(
  'rss-sync-every-5-min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://nuclmzoasgydubdshtab.supabase.co/functions/v1/fetch-rss-feeds',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51Y2xtem9hc2d5ZHViZHNodGFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MDgxNTMsImV4cCI6MjA3ODQ4NDE1M30.-1EDAX7A5pQxtFs3a9M4R2BHBMbWkoMdA5NLWdZyEjo'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

**Benefits**:
- ✅ No dependency on GitHub Actions
- ✅ No `is_active` flag issues
- ✅ Runs directly in database (more reliable)
- ✅ Same pattern as Bluesky (proven working)

---

## 📈 RECOMMENDED APPROACH

**Step 1: Quick Fix (Now)**
- Run Option 1 SQL to re-enable jobs
- Wait 5 minutes
- Check if daily briefing generates

**Step 2: Verify (In 10 minutes)**
- Run diagnostic query again
- Check `last_run_at` is recent
- Check `last_run_status = 'success'`

**Step 3: Permanent Fix (Next deployment)**
- Create Option 2 migration
- Push to GitHub
- Lovable auto-deploys
- Move from GitHub Actions → Direct pg_cron

---

## 🎯 NEXT ACTIONS

**RIGHT NOW** (User should do):
1. Open Supabase SQL Editor
2. Run `CHECK_SCHEDULED_JOBS_TABLE.sql`
3. Share results
4. If `is_active = false` for Smart Alerting:
   - Run Option 1 fix
   - Wait 5 minutes
   - Verify daily briefing generates

**ONCE FIXED**:
- Decide: Keep GitHub Actions or switch to direct pg_cron?
- If switching: I'll create the migration file
- Deploy and test

---

## 📝 FILES CREATED

1. **`C:\Users\Husse\CHECK_SCHEDULED_JOBS_TABLE.sql`** - Diagnostic query
2. **`C:\Users\Husse\SCHEDULING_ROOT_CAUSE_ANALYSIS.md`** - This document

---

## 🔗 ARCHITECTURE REFERENCE

**Current Scheduler Flow:**
```
GitHub Actions (every 5 min)
  └─> Calls: run-scheduled-jobs edge function
      └─> Queries: scheduled_jobs WHERE is_active=true AND next_run_at <= NOW()
          └─> For each job:
              ├─> fetch_rss → fetch-rss-feeds ✅
              ├─> smart_alerting → smart-alerting ❌ (is_active=false?)
              └─> send_briefings → send-daily-briefing ❌ (is_active=false?)

Direct pg_cron (parallel, independent):
  ├─> bluesky-stream (every 2 min) ✅
  ├─> analyze-bluesky-posts (every 10 min) ✅
  └─> correlate-social-news (every 15 min) ✅
```

**After permanent fix (Option 2):**
```
Direct pg_cron (all jobs):
  ├─> rss-sync (every 5 min) ✅
  ├─> bluesky-stream (every 2 min) ✅
  ├─> analyze-bluesky-posts (every 10 min) ✅
  ├─> correlate-social-news (every 15 min) ✅
  ├─> smart-alerting (every 30 min) ✅
  └─> daily-briefing-email (daily 8 AM) ✅

GitHub Actions: Can be removed (no longer needed)
```

---

**Status**: Awaiting user to run diagnostic query and confirm `is_active` status.
