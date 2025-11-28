# Phase 3 Deep Audit Report - Critical System Issues
**Date:** 2025-11-28  
**Status:** 🔴 MULTIPLE CRITICAL ISSUES FOUND

---

## Executive Summary

Third-pass audit reveals **5 critical issues** blocking production deployment:

| Issue | Severity | Component | Impact | Status |
|-------|----------|-----------|--------|--------|
| track-state-actions schema mismatch | 🔴 CRITICAL | Edge Function | 14 consecutive failures | 🔧 NEEDS FIX |
| send-spike-alerts configuration | 🔴 CRITICAL | Alerting System | All alerts failing | 🔧 NEEDS FIX |
| update_bluesky_trends timeout | 🔴 CRITICAL | Trend Calculation | Analysis pipeline blocked | 🔧 NEEDS FIX |
| Frontend realtime hooks misconfigured | 🟡 MEDIUM | UI | No live updates showing | 🔧 NEEDS FIX |
| calculate-attribution still failing | 🔴 CRITICAL | Attribution | 213 consecutive failures | ⚠️ MONITORING |

---

## Issue #1: track-state-actions Schema Mismatch

### Problem
Edge function has 14 consecutive failures due to column name mismatches.

### Root Cause
**Function expects:**
```typescript
{
  state_code: 'TX',
  state_name: 'Texas',
  official_name: 'Greg Abbott',
  official_title: 'Governor',
  action_date: '2025-11-28'
}
```

**Actual table schema:**
```sql
state_actions (
  state TEXT,              -- NOT state_code/state_name
  introduced_date DATE,    -- NOT action_date
  -- No official_name column
  -- No official_title column
)
```

### Impact
- State government actions are NOT being tracked
- Political threats from state legislatures are NOT being detected
- Users have no visibility into state-level policy changes

### Fix Required
Update `supabase/functions/track-state-actions/index.ts` to match actual schema:
```typescript
// Line 197-212 - WRONG columns
state_code → state
action_date → introduced_date
// Remove: official_name, official_title, state_name
```

---

## Issue #2: send-spike-alerts Configuration Missing

### Problem
All 7 spike alerts failed to send. Investigation shows:
- **RESEND_API_KEY** is not configured as a secret
- **SPIKE_ALERT_WEBHOOK_URL** environment variable doesn't exist
- All alerts have `notification_channels: ['webhook']` only
- Function can't send via email (no key) OR webhook (no URL)

### Data Evidence
```sql
SELECT * FROM spike_alerts WHERE status = 'failed';
-- Result: 7 alerts with notification_channels=['webhook'], status='failed'
```

### Impact
- Users are NOT receiving critical alerts
- Breaking news spikes go unnoticed
- Time-sensitive political developments are missed

### Fix Required
1. Add RESEND_API_KEY secret
2. Update `detect-spikes` edge function to set `notification_channels: ['email']` by default
3. Configure SPIKE_ALERT_WEBHOOK_URL if webhook delivery is needed

---

## Issue #3: update_bluesky_trends Performance Timeout

### Problem
Database function `update_bluesky_trends()` is timing out when called by `analyze-bluesky-posts` edge function.

**Error:** `canceling statement due to statement timeout`

### Root Cause
- Function processes ALL 39,798 analyzed posts every run
- Calculates trends for every unique topic (hundreds of topics)
- No indexing on critical columns
- No batch processing or pagination

### Current Performance
```sql
SELECT COUNT(*) FROM bluesky_posts WHERE ai_processed = true;
-- Result: 39,798 posts

-- Function must:
-- 1. DISTINCT unnest ALL topics from 39,798 posts
-- 2. For EACH topic, run 4 time-window counts
-- 3. Calculate velocity for EACH topic
-- 4. Calculate sentiment aggregations for EACH topic
-- 5. INSERT/UPDATE bluesky_trends for EACH topic
```

**Estimated processing time:** 60+ seconds  
**Database timeout:** 30 seconds  
**Result:** TIMEOUT FAILURE

### Impact
- Trending topics are NOT being calculated
- Frontend trend widgets show stale data
- Real-time intelligence pipeline is blocked

### Fix Required
Optimize `update_bluesky_trends()` database function:
1. Add indexes on `ai_topics`, `created_at`, `ai_processed`
2. Implement batch processing (limit 50 topics per run)
3. Cache topic lists instead of recalculating
4. Consider materialized view for trend calculations

---

## Issue #4: Frontend Realtime Hooks Misconfigured

### Problem
Frontend is subscribing to wrong tables for realtime updates.

**Current Implementation:**
```typescript
// useRealtimeAlerts.tsx
supabase
  .channel('alerts_realtime')
  .on('postgres_changes', {
    table: 'alert_queue'  // ❌ WRONG TABLE
  })
```

**Should be:**
```typescript
supabase
  .channel('intelligence_alerts')
  .on('postgres_changes', {
    table: 'client_entity_alerts'  // ✅ CORRECT
  })
```

### Impact
- Intelligence Hub alerts don't appear in real-time
- Users must refresh page to see new alerts
- "Real-time" features are actually polling-based

### Tables with Realtime Enabled (from Phase 2 audit)
✅ `entity_trends`  
✅ `client_entity_alerts`  
✅ `suggested_actions`  
✅ `entity_mentions`  
✅ `fundraising_opportunities`

### Fix Required
Update frontend hooks:
1. `useRealtimeAlerts.tsx` → subscribe to `client_entity_alerts`
2. `useRealtimeTrends.tsx` → subscribe to `entity_trends`
3. Add new hook `useRealtimeActions.tsx` → subscribe to `suggested_actions`

---

## Issue #5: calculate-attribution Persistent Failures

### Status
Despite Phase 2 fix, function shows **213 consecutive failures** in scheduled_jobs.

### Investigation Findings
```sql
-- No recent edge function logs found for calculate-attribution
SELECT * FROM function_edge_logs 
WHERE function_id = 'calculate-attribution' 
ORDER BY timestamp DESC LIMIT 5;
-- Result: [] (empty)

-- No attribution records created
SELECT COUNT(*) FROM transaction_attribution;
-- Result: 0

-- No recent job executions logged
SELECT * FROM scheduled_jobs WHERE job_type = 'attribution';
-- Last run: 2025-11-28 18:58:03, Status: failed
```

### Possible Causes
1. Function deployment failed (not actually updated)
2. Schema mismatch still exists (fix not applied)
3. No actblue_transactions data to process
4. Job scheduler not actually invoking function

### Next Steps
1. Manually deploy `calculate-attribution` function
2. Test function with sample transaction data
3. Check job_executions table for error details
4. Verify scheduled_jobs next_run_at is updating

---

## System Health Scorecard

### Edge Functions
| Function | Status | Failures | Issue |
|----------|--------|----------|-------|
| calculate-attribution | 🔴 FAILING | 213 | Unknown - needs investigation |
| track-state-actions | 🔴 FAILING | 14 | Schema mismatch |
| send-spike-alerts | 🔴 FAILING | 100% | Missing API keys |
| analyze-bluesky-posts | 🟡 DEGRADED | 0 | Timeout on trend updates |
| calculate-entity-trends | ✅ WORKING | 0 | Fixed in Phase 1 |
| generate-suggested-actions | ✅ WORKING | 0 | Fixed in Phase 1 |

### Database Health
| Table | Records | Status | Notes |
|-------|---------|--------|-------|
| bluesky_posts | 10,000+ | ✅ GOOD | Ingesting continuously |
| entity_mentions | 10,050 | ✅ GOOD | Latest: 2025-11-28 |
| entity_trends | 10 | ⚠️ STALE | Not updating (timeout issue) |
| bluesky_trends | Unknown | ⚠️ STALE | Not updating (timeout issue) |
| client_entity_alerts | 0 | ⚠️ WAITING | No watchlist entries |
| spike_alerts | 7 | 🔴 FAILED | All alerts failed to send |
| transaction_attribution | 0 | 🔴 EMPTY | Function failing |
| state_actions | Unknown | 🔴 NOT TRACKING | Function failing |

### Realtime System
| Feature | Status | Issue |
|---------|--------|-------|
| Trend Updates | 🔴 BROKEN | Frontend subscribes to wrong table |
| Alert Notifications | 🔴 BROKEN | Frontend subscribes to wrong table |
| Entity Mentions | ✅ ENABLED | Realtime properly configured |

---

## Priority Action Items

### P0 - Critical Blockers (Fix Immediately)
1. ✅ Fix `track-state-actions` schema mismatch
2. ✅ Add RESEND_API_KEY secret for spike alerts
3. ✅ Optimize `update_bluesky_trends()` function
4. ✅ Fix frontend realtime subscriptions

### P1 - High Priority (Fix Today)
5. ⏳ Investigate and resolve `calculate-attribution` failures
6. ⏳ Add database indexes for trend calculations
7. ⏳ Configure webhook URL for spike alerts (or remove webhook channel)

### P2 - Medium Priority
8. ⏳ Populate entity_watchlist with sample data
9. ⏳ Test end-to-end alert delivery
10. ⏳ Add monitoring for edge function health

---

## Testing Checklist (After Fixes)

### Edge Functions
- [ ] Deploy fixed track-state-actions → verify state_actions inserts
- [ ] Deploy optimized analyze-bluesky-posts → verify trend updates
- [ ] Test send-spike-alerts with RESEND_API_KEY → verify email delivery
- [ ] Re-deploy calculate-attribution → verify attribution records created

### Frontend Realtime
- [ ] Open two browser tabs
- [ ] Add entity to watchlist in tab 1
- [ ] Verify alert appears in tab 2 without refresh
- [ ] Check browser console for realtime subscription success

### Intelligence Pipeline
- [ ] Verify bluesky_posts → entity_mentions flow
- [ ] Verify entity_mentions → entity_trends flow
- [ ] Verify entity_trends → client_entity_alerts flow
- [ ] Verify client_entity_alerts → frontend display

---

## Conclusion

**Phase 3 Audit Status:** CRITICAL ISSUES FOUND  
**System Confidence:** LOW  
**Production Ready:** NO

**Immediate Actions Required:**
1. Fix 3 failing edge functions
2. Add missing API key
3. Optimize database function
4. Fix frontend subscriptions

**Estimated Time to Resolution:** 2-3 hours

---

*Last Updated: 2025-11-28 19:15 UTC*
