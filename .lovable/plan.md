

# Database Cleanup Plan
**Goal**: Reclaim ~1-1.5 GB of disk space (excluding SMS events as requested)

---

## Current Storage Analysis

| Table | Size | Issue |
|-------|------|-------|
| `bluesky_posts` | 855 MB | 50,088 posts ALL over 14 days old |
| `cron.job_run_details` | 179 MB | 129,207 logs over 14 days old |
| `entity_mentions` | 270 MB | 118,607 mentions over 30 days old |
| `job_executions` | 33 MB | 60,301 stuck "running" records |

**Total recoverable**: ~1-1.5 GB

---

## Root Cause Analysis

1. **TTL Cleanup Job is Broken**: The scheduled job `TTL Cleanup` has been failing since December 6, 2025 with error: *"Unknown job type: ttl-cleanup"*
   - The job has `job_type: ttl-cleanup` but the scheduler only handles `cleanup_cache` 
   - Circuit breaker is open after 5 consecutive failures

2. **Bluesky Cleanup Misconfigured**: The pg_cron job calls `cleanup-bluesky-posts` with `retention_days: 30` instead of 7-14 days

3. **60,000+ Stuck Job Executions**: Records marked as "running" since November 30, 2025 - never cleaned up

---

## Implementation Plan

### Phase 1: Fix the Scheduler (Code Changes)

**File**: `supabase/functions/run-scheduled-jobs/index.ts`

Add a new case handler for `ttl-cleanup` job type:

```text
case 'ttl-cleanup':
case 'ttl_cleanup':
  console.log('[SCHEDULER] Running TTL cleanup');
  const ttlResponse = await supabase.functions.invoke('ttl-cleanup', { 
    body: {},
    headers: authHeaders
  });
  if (ttlResponse.error) throw new Error(ttlResponse.error.message);
  result = ttlResponse.data;
  itemsProcessed = result?.total_deleted || 0;
  break;
```

---

### Phase 2: Database Cleanup (One-Time SQL)

**A. Purge cron.job_run_details (>7 days)**
```sql
DELETE FROM cron.job_run_details 
WHERE start_time < NOW() - INTERVAL '7 days';
-- Expected: ~145,000 rows, ~170 MB recovered
```

**B. Clean stuck job_executions**
```sql
UPDATE job_executions 
SET status = 'timeout', 
    completed_at = started_at + INTERVAL '1 hour',
    error_message = 'Marked as timeout by cleanup job'
WHERE status = 'running' 
  AND started_at < NOW() - INTERVAL '1 hour';
-- Expected: ~60,000 rows fixed
```

**C. Re-enable TTL Cleanup job**
```sql
UPDATE scheduled_jobs 
SET is_active = true, 
    is_circuit_open = false, 
    consecutive_failures = 0,
    job_type = 'ttl_cleanup'  -- Use underscore format
WHERE job_name = 'TTL Cleanup';
```

**D. Fix pg_cron bluesky retention**
```sql
SELECT cron.alter_job(
  32,  -- cleanup-bluesky-posts job
  schedule := '0 */6 * * *',
  command := $$
    SELECT net.http_post(
      url:='https://nuclmzoasgydubdshtab.supabase.co/functions/v1/cleanup-bluesky-posts',
      headers:='{"Content-Type": "application/json", "x-cron-secret": "YOUR_CRON_SECRET"}'::jsonb,
      body:='{"retention_days": 7, "batch_size": 500, "max_batches": 20, "aggressive": true}'::jsonb
    ) AS request_id;
  $$
);
```

---

### Phase 3: Add Automatic Cron Cleanup

**File**: `supabase/functions/ttl-cleanup/index.ts`

Add a new cleanup step to purge old cron logs:

```text
// 9. Delete cron job_run_details older than 7 days
const { count: oldCronLogs, error: e9 } = await supabase
  .rpc('cleanup_cron_job_run_details', { retention_days: 7 });

results.push({ 
  table: 'cron.job_run_details', 
  deleted: oldCronLogs || 0,
  error: e9?.message 
});
```

**New Database Function** (migration):
```sql
CREATE OR REPLACE FUNCTION cleanup_cron_job_run_details(retention_days INT DEFAULT 7)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = cron, public
AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM cron.job_run_details 
  WHERE start_time < NOW() - (retention_days || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
```

---

### Phase 4: Trigger Immediate Cleanup

After deploying the fixes, manually trigger cleanup:

1. Deploy updated edge functions
2. Run TTL cleanup manually via admin API
3. Run bluesky cleanup with aggressive mode
4. Verify disk space recovery

---

## Expected Results

| Table | Before | After | Saved |
|-------|--------|-------|-------|
| `bluesky_posts` | 855 MB | ~50 MB | ~800 MB |
| `cron.job_run_details` | 179 MB | ~10 MB | ~170 MB |
| `entity_mentions` | 270 MB | ~50 MB | ~220 MB |
| `job_executions` (bloat) | 33 MB | ~5 MB | ~28 MB |

**Total estimated savings**: ~1.2 GB

---

## Technical Notes

- The `bluesky_posts` table has 800+ MB of index bloat that will be reclaimed after deletions
- A `REINDEX` may be needed after mass deletions to fully reclaim index space
- The stuck job_executions indicate the scheduler has memory/timeout issues that should be monitored
- Consider enabling a weekly maintenance window for `VACUUM ANALYZE` on high-churn tables

