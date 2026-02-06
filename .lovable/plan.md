
# Fix: Stale Dashboard Data After Meta Sync

## Problem

When Meta Ads data syncs in the background, some parts of the dashboard update while others remain stale until manual refresh. This happens because the cache invalidation logic has gaps -- several critical query keys are not being invalidated when a sync completes.

## Root Cause

There are three places that handle cache invalidation, and all three are missing key query keys:

1. **`useAutoRefreshOnSync`** (realtime listener on `data_freshness` table) -- missing `actblue-metrics`, `channel-spend`, `dashboard-sparkline`
2. **`useSmartRefresh`** (manual refresh button) -- missing `actblue-metrics`, `channel-spend`, `dashboard-sparkline`, `adPerformance`
3. Mismatched key prefixes between hooks and invalidation lists

### What each missing key controls:

| Query Key | What it powers | Why it's stale |
|-----------|---------------|----------------|
| `actblue-metrics` | ROI, attributed revenue, channel breakdown (Hero KPIs) | ROI uses Meta spend in denominator; old spend = wrong ROI |
| `channel-spend` | Meta/SMS spend totals and daily spend for the performance graph | Direct query to `meta_ad_metrics_daily`, never invalidated |
| `dashboard-sparkline` | Daily ROI sparklines, MRR trends | ROI sparkline uses spend data, stays stale |
| `adPerformance` | Ad Performance page metrics | Missing from `useSmartRefresh` |

## Solution

Update all three invalidation points to include the complete set of query keys.

---

## Technical Changes

### File 1: `src/hooks/useAutoRefreshOnSync.ts`

Update `SOURCE_QUERY_KEYS` to add the missing keys:

```typescript
const SOURCE_QUERY_KEYS: Record<string, string[][]> = {
  meta: [
    ['meta'],
    ['meta-metrics'],
    ['single-day-meta'],
    ['creative-intelligence'],
    ['hourly-metrics'],
    ['adPerformance'],
    ['actblue-metrics'],     // NEW: ROI depends on Meta spend
    ['channel-spend'],       // NEW: Direct meta_ad_metrics_daily query
    ['dashboard-sparkline'], // NEW: Sparkline ROI uses spend
  ],
  actblue_webhook: [
    ['actblue'],
    ['donations'],
    ['recurring-health'],
    ['recurring-health-v2'],
    ['hourly-metrics'],
    ['kpis'],
    ['actblue-metrics'],     // NEW: Core ActBlue data
    ['channel-spend'],       // NEW: Attribution affects channel view
    ['dashboard-sparkline'], // NEW: Sparkline data from RPC
  ],
  actblue_csv: [
    ['actblue'],
    ['donations'],
    ['recurring-health'],
    ['recurring-health-v2'],
    ['kpis'],
    ['actblue-metrics'],     // NEW: Core ActBlue data
    ['dashboard-sparkline'], // NEW: Sparkline data from RPC
  ],
  switchboard: [
    ['sms'],
    ['channels'],
    ['actblue-metrics'],     // NEW: SMS attribution in RPC
    ['channel-spend'],       // NEW: SMS spend in channel query
    ['dashboard-sparkline'], // NEW: Sparkline data
  ],
};
```

### File 2: `src/hooks/useSmartRefresh.ts`

Add the missing invalidation keys to **both** invalidation blocks (lines ~158-183 and ~230-246):

```typescript
// Add these to both Promise.all blocks:
queryClient.invalidateQueries({ queryKey: ['actblue-metrics'] }),
queryClient.invalidateQueries({ queryKey: ['channel-spend'] }),
queryClient.invalidateQueries({ queryKey: ['dashboard-sparkline'] }),
queryClient.invalidateQueries({ queryKey: ['adPerformance'] }),
```

---

## Why This Fixes the Issue

After these changes:
- When Meta syncs complete, the `channel-spend` query (which reads `meta_ad_metrics_daily` directly) will refetch with fresh spend data
- The `actblue-metrics` query (which calculates ROI using spend) will recalculate with the new spend figures
- The `dashboard-sparkline` query will update ROI sparklines
- All dashboard sections will show consistent, up-to-date numbers without manual refresh
- The manual refresh button will also invalidate all the same keys for consistency
