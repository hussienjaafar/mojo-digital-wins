

# Fix: Refresh Button Not Updating All Dashboard Sections

## Problem Summary

When clicking the refresh button in the date range selector, some dashboard sections do not update. This is because the `useSmartRefresh` hook only invalidates a limited set of query keys, while the dashboard components use many additional query keys that are not included in the invalidation logic.

## Root Cause Analysis

### Current Invalidation List (useSmartRefresh.ts lines 151-164)

The refresh button currently only invalidates these query keys:

| Query Key | What It Covers |
|-----------|----------------|
| `['dashboard']` | Main dashboard summary data |
| `['actblue']` | ActBlue transaction queries |
| `['meta-metrics']` | Meta performance metrics |
| `['sms']` | SMS campaign data |
| `['attribution']` | Attribution analytics |
| `['recurring-health']` | Legacy recurring health |

### Missing Query Keys (Not Invalidated)

The following query keys are used by dashboard components but are **NOT invalidated** when refresh is clicked:

| Missing Key | Used By | Impact |
|-------------|---------|--------|
| `['hourly-metrics']` | TodayViewDashboard (hourly breakdown, comparison data) | Today view doesn't refresh |
| `['single-day-meta']` | useSingleDayMetaMetrics | Meta Ads section in Today view doesn't refresh |
| `['recurring-health-v2']` | useRecurringHealthQuery | Modern recurring donor health section doesn't refresh |
| `['creative-intelligence']` | useCreativeIntelligence | Creative Intelligence V2 doesn't refresh |
| `['donations']` | Donation list/timeseries queries | Donation tables don't refresh |
| `['meta']` | Meta campaign/creative queries | Meta ads detail views don't refresh |
| `['channels']` | Channel comparison views | Channel summaries don't refresh |
| `['kpis']` | KPI drilldown queries | KPI details don't refresh |
| `['intelligence']` | Donor intelligence queries | Attribution/donor segments don't refresh |
| `['alerts']` | Alert queries | Alert sections don't refresh |

### Why This Happens

The query key system in TanStack Query uses prefix matching. Invalidating `['dashboard']` will invalidate all queries starting with `['dashboard', ...]`, but it will **NOT** invalidate queries starting with `['hourly-metrics', ...]` or `['single-day-meta', ...]`.

---

## Solution

Expand the invalidation list in `useSmartRefresh.ts` to include all dashboard-related query keys. This ensures clicking refresh will update every section of the dashboard.

### Implementation Details

**File to Modify**: `src/hooks/useSmartRefresh.ts`

**Change Location**: Lines 157-164 (the invalidation block)

### Current Code

```typescript
await Promise.all([
  queryClient.invalidateQueries({ queryKey: ['actblue'] }),
  queryClient.invalidateQueries({ queryKey: ['meta-metrics'] }),
  queryClient.invalidateQueries({ queryKey: ['sms'] }),
  queryClient.invalidateQueries({ queryKey: ['attribution'] }),
  queryClient.invalidateQueries({ queryKey: ['recurring-health'] }),
]);
```

### Updated Code

```typescript
await Promise.all([
  // Core data sources
  queryClient.invalidateQueries({ queryKey: ['actblue'] }),
  queryClient.invalidateQueries({ queryKey: ['meta-metrics'] }),
  queryClient.invalidateQueries({ queryKey: ['meta'] }),
  queryClient.invalidateQueries({ queryKey: ['sms'] }),
  
  // Today/Single-day view specific
  queryClient.invalidateQueries({ queryKey: ['hourly-metrics'] }),
  queryClient.invalidateQueries({ queryKey: ['single-day-meta'] }),
  
  // Recurring health (both legacy and v2)
  queryClient.invalidateQueries({ queryKey: ['recurring-health'] }),
  queryClient.invalidateQueries({ queryKey: ['recurring-health-v2'] }),
  
  // Intelligence & analytics
  queryClient.invalidateQueries({ queryKey: ['attribution'] }),
  queryClient.invalidateQueries({ queryKey: ['intelligence'] }),
  queryClient.invalidateQueries({ queryKey: ['creative-intelligence'] }),
  
  // Other dashboard sections
  queryClient.invalidateQueries({ queryKey: ['donations'] }),
  queryClient.invalidateQueries({ queryKey: ['channels'] }),
  queryClient.invalidateQueries({ queryKey: ['kpis'] }),
  queryClient.invalidateQueries({ queryKey: ['alerts'] }),
]);
```

---

## Additional Consideration: Post-Sync Invalidation

The same issue exists in the post-sync invalidation (lines 206-209). After external syncs complete, only `['dashboard']` is invalidated. This should also include the expanded list or simply invalidate all queries to ensure fresh data is displayed.

### Option A: Repeat the full invalidation list

Duplicate the expanded list after syncs complete.

### Option B: Invalidate all queries with a single call

Use a broader invalidation strategy:

```typescript
// After syncs complete, invalidate everything for this organization
await queryClient.invalidateQueries({
  predicate: (query) => true, // Invalidates ALL queries
  refetchType: 'all'
});
```

**Recommended**: Option A (repeat the list) to maintain precision and avoid invalidating unrelated queries (like user settings, navigation state, etc.)

---

## Expected Results

After implementation:
1. Clicking the refresh button will update ALL dashboard sections
2. The Today View hourly breakdown and Meta metrics will refresh
3. Creative Intelligence will refresh
4. Recurring donor health will refresh
5. All channel and donation views will refresh

---

## Files Summary

| Action | File |
|--------|------|
| Modify | `src/hooks/useSmartRefresh.ts` |

