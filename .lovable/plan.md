

# Fix: $20 Meta Revenue Gap Between Today View and Hero KPI

## Problem Summary

Two dashboard components display conflicting Meta attributed revenue for January 26, 2026:

| Component | Value | Data Source |
|-----------|-------|-------------|
| Meta Ads Performance Overview | $75.00 (0.55x ROI) | `useSingleDayMetaMetrics` with `p_use_utc: true` |
| Attributed ROI Details drawer | $55.00 (0.4x ROI) | `useActBlueMetrics` with `p_use_utc: false` (ET) |

The $20 gap comes from 1 transaction that occurred between midnight and 1 AM UTC on Jan 26, which falls on Jan 25 when using Eastern Time bucketing.

## Root Cause

The `useSingleDayMetaMetrics` hook explicitly passes `p_use_utc: true` to the RPC (line 48), while the `useActBlueMetrics` hook used by Hero KPIs passes `p_use_utc: false` (line 435). This timezone mismatch causes transactions in the 12-5 AM UTC window to appear in different day buckets.

## Solution

Standardize both hooks to use **Eastern Time** (`p_use_utc: false`) since:
1. ActBlue's native Fundraising Performance dashboard uses Eastern Time
2. The Hero KPIs already use Eastern Time
3. Users expect consistency across all dashboard views

## Implementation Steps

### Step 1: Fix the Timezone Parameter

**File: `src/hooks/useSingleDayMetaMetrics.ts`**

Change line 48 from:
```typescript
p_use_utc: true, // Use UTC for consistency
```
to:
```typescript
p_use_utc: false, // Use Eastern Time to match Hero KPIs and ActBlue dashboard
```

### Step 2: Fix Build Errors (Required)

The following TypeScript errors must be resolved before deployment:

**2a. `src/stores/dashboardStore.ts` (line 87)**
- Add missing KPI keys to `KPI_TO_SERIES_MAP`: `ci_needsAttention`, `ci_overallRoas`, `ci_scalable`, `ci_totalCreatives`, and 2 more

**2b. `src/hooks/useCreativeIntelligence.ts` (lines 209, 223)**
- Fix RPC function name type error by using type assertion
- Fix the type casting for the response

**2c. `src/pages/ClientCreativeIntelligenceV2.tsx` (lines 42, 43, 62)**
- Remove references to non-existent `election_date` and `election_name` columns from the `client_organizations` table query

**2d. `src/components/creative-intelligence/PerformanceQuadrantChart.tsx` (line 307)**
- Add type assertion `as const` to the `type: 'value'` in xAxis/yAxis config

**2e. `src/components/creative-intelligence/RecommendationTable.tsx` (line 248)**
- Remove the `emptyMessage` prop which doesn't exist on `V3DataTable`

**2f. `src/components/creative-intelligence/CreativeIntelligenceDashboard.tsx` (line 225)**
- Fix the CSV export type by spreading recommendations into plain objects

## Expected Outcome

After the fix:
- Both components will show **$55.00** Meta Revenue for Jan 26 (ET)
- Attributed ROI will display **0.4x** consistently across all views
- The "Meta Ads Performance Overview" will match the "Attributed ROI Details" drawer

## Technical Notes

### Why Eastern Time?
ActBlue processes donations in Eastern Time, and their dashboard reports use Eastern Time boundaries. Using UTC would cause:
1. Late-night EST donations to appear on the "next day"
2. Discrepancies when users compare our dashboard to ActBlue's native reporting
3. Inconsistency between different dashboard sections

### Alternative Considered
We could switch everything to UTC for technical simplicity, but this would break alignment with ActBlue's native reporting and user expectations for US-based fundraising operations.

