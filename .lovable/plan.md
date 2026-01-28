

# Investigation: Attributed ROI Data Consistency and Freshness

## Problem Summary

You're experiencing two issues:
1. **Data misalignment** between Hero KPI "Attributed ROI", Meta Ads Performance Overview, and Meta Ads Channel Details
2. **Stale data** - information often appears hours old

## Current Architecture

```text
+------------------+     +-------------------------+     +----------------------+
|  Hero KPI Card   |     | Meta Ads Performance    |     | Meta Ads Channel     |
| (Attributed ROI) |     | Overview (Today View)   |     | Details              |
+------------------+     +-------------------------+     +----------------------+
        |                           |                             |
        v                           v                             v
+------------------+     +-------------------------+     +----------------------+
| useDashboardV2   |     | useSingleDayMetaMetrics |     | useMetaAdsMetrics    |
|                  |     |                         |     | Query                |
+------------------+     +-------------------------+     +----------------------+
        |                           |                             |
        +------------+--------------+                             |
                     |                                            |
                     v                                            v
        +------------------------+              +---------------------------+
        | get_actblue_dashboard  | <-- SAME --> | meta_ad_metrics_daily     |
        | _metrics RPC           |    SPEND     | .conversion_value         |
        | (unified attribution)  |    SOURCE    | (Meta's reported value)   |
        +------------------------+              +---------------------------+
                     |                                            |
                     v                                            |
        +------------------------+                               |
        | actblue_transactions   |                               |
        | + refcode_mappings     |                               |
        | (OUR attribution)      |                               |
        +------------------------+                               |
                                                                 |
                     REVENUE SOURCE MISMATCH! ------------------+
```

## Root Causes Identified

### Issue 1: Data Misalignment

| Component | Revenue Source | Problem |
|-----------|---------------|---------|
| Hero KPI + Performance Overview | `get_actblue_dashboard_metrics` RPC | Uses OUR attribution (ActBlue + refcode mappings) |
| Meta Ads Channel Details | `meta_ad_metrics_daily.conversion_value` | Uses META'S reported conversions |

**Result**: When Meta's tracked conversions differ from our attributed donations (which they almost always do), the numbers won't match.

### Issue 2: Cache Time Inconsistency

| Hook | Stale Time | Impact |
|------|------------|--------|
| `useActBlueMetrics` | 5 minutes | Hero KPIs refresh slower |
| Channel Spend Query | 2 minutes | Spend data refreshes faster |
| `useMetaAdsMetricsQuery` | 2 minutes | Channel details refresh faster |

This 3-minute gap means sections can show data from different points in time.

### Issue 3: Data Freshness

| Factor | Current State |
|--------|--------------|
| Meta API Delay | 24-48 hours inherent (documented) |
| Tiered Sync | Runs every 15 mins but only for "due" accounts |
| Smart Refresh Threshold | Only triggers sync if data > 4 hours old |
| Scheduled Jobs | Only `process-meta-capi-outbox` found active |

---

## Proposed Solution

### Fix 1: Unify Revenue Source for Channel Details

**Goal**: Make MetaAdsMetrics use the same attribution RPC as Hero KPIs

**Changes**:
- Update `useMetaAdsMetricsQuery` to also call `get_actblue_dashboard_metrics` RPC for revenue
- Use `conversion_value` from Meta only as a display/comparison metric, not for ROI calculation
- Add a new field `ourAttributedRevenue` to the query results

**Files**:
- `src/queries/useMetaAdsMetricsQuery.ts` - Add RPC call for attribution
- `src/components/client/MetaAdsMetrics.tsx` - Use unified revenue for ROI display

### Fix 2: Standardize Cache Times

**Goal**: All dashboard data refreshes at the same cadence

**Changes**:
- Align all hooks to use 2-minute `staleTime` (or make it configurable)
- Add a shared constant for cache configuration

**Files**:
- `src/hooks/useActBlueMetrics.ts` - Change staleTime from 5 to 2 minutes
- Create `src/lib/query-config.ts` - Centralized cache settings

### Fix 3: Improve Data Freshness

**Goal**: Reduce perceived staleness from hours to ~30 minutes

**Changes**:

1. **Add scheduled Meta sync job** - Currently missing from `scheduled_jobs`
   - Run `sync-meta-ads` every 30 minutes via pg_cron

2. **Lower Smart Refresh threshold** from 4 hours to 1 hour
   - Users clicking refresh will trigger sync more often

3. **Add "Last Synced" indicator** to all three sections
   - Show when data was last refreshed so users know what they're looking at

4. **Optional: Add polling for active dashboard sessions**
   - Auto-refresh every 15 minutes while user has dashboard open

**Files**:
- Database: Add new scheduled job for Meta sync
- `src/hooks/useSmartRefresh.ts` - Lower threshold to 1 hour
- `src/components/client/ClientDashboard.tsx` - Add optional polling
- New migration for scheduled job

---

## Implementation Plan

### Phase 1: Fix Data Alignment (Highest Priority)
1. Modify `useMetaAdsMetricsQuery` to fetch from unified attribution RPC
2. Update MetaAdsMetrics component to use unified revenue source
3. Add visual indicator showing data source (e.g., "Based on ActBlue attribution")

### Phase 2: Standardize Caching
1. Create shared cache configuration module
2. Update all dashboard hooks to use consistent staleTime
3. Ensure query keys are structured for proper invalidation

### Phase 3: Improve Freshness
1. Add `sync-meta-ads` to scheduled_jobs (every 30 min)
2. Lower Smart Refresh threshold to 1 hour
3. Add "Last synced X minutes ago" to dashboard header
4. Consider optional auto-polling for active sessions

---

## Technical Details

### Modified Query (Phase 1)

```typescript
// In useMetaAdsMetricsQuery.ts
async function fetchMetaAdsMetrics(...) {
  const [metaMetrics, attribution] = await Promise.all([
    // Existing Meta metrics fetch
    supabase.from('meta_ad_metrics_daily')...,
    // NEW: Unified attribution
    supabase.rpc('get_actblue_dashboard_metrics', {
      p_organization_id: organizationId,
      p_start_date: startDate,
      p_end_date: endDate,
      p_use_utc: false,
    })
  ]);
  
  // Extract Meta-attributed revenue from unified source
  const metaChannel = attribution.data?.channels?.find(c => c.channel === 'meta');
  
  return {
    ...existingData,
    ourAttributedRevenue: metaChannel?.revenue || 0,
    ourAttributedROI: totals.spend > 0 
      ? (metaChannel?.revenue || 0) / totals.spend 
      : 0,
  };
}
```

### New Scheduled Job (Phase 3)

```sql
-- Add to scheduled_jobs table
INSERT INTO scheduled_jobs (job_name, schedule, endpoint, job_type, is_active)
VALUES (
  'sync-meta-ads-scheduled',
  '*/30 * * * *',  -- Every 30 minutes
  'sync-meta-ads',
  'edge_function',
  true
);
```

---

## Expected Outcomes

| Metric | Before | After |
|--------|--------|-------|
| Revenue source consistency | 2/3 sections aligned | 3/3 sections aligned |
| Maximum cache staleness | 5 minutes | 2 minutes |
| Meta data refresh frequency | Manual / 4+ hours | Every 30 minutes |
| User visibility into freshness | Limited | Clear indicators |

---

## Files to Change

| File | Change Type |
|------|-------------|
| `src/queries/useMetaAdsMetricsQuery.ts` | Add unified attribution fetch |
| `src/components/client/MetaAdsMetrics.tsx` | Use ourAttributedRevenue for ROI |
| `src/hooks/useActBlueMetrics.ts` | Align staleTime to 2 minutes |
| `src/hooks/useSmartRefresh.ts` | Lower threshold to 1 hour |
| New: `src/lib/query-config.ts` | Centralized cache settings |
| Database migration | Add sync-meta-ads scheduled job |

