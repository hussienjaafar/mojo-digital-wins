# Data Architecture Remediation Report

**Project:** mojo-digital-wins  
**Period:** January 2026  
**Status:** P0/P1 Items Complete, P2/P3 Remaining  
**Audit Reference:** [DATA_ARCHITECTURE_AUDIT.md](./DATA_ARCHITECTURE_AUDIT.md)

---

## Executive Summary

This report documents the remediation work completed in response to the Data Architecture Audit. All **P0** (Critical) and **P1** (High Priority) issues have been addressed, with some **P2/P3** hygiene items remaining for future cleanup.

---

## 1. Completed Remediation Items

### 1.1 Shared RPC Client (R1 - P0)

**Issue:** Duplicate `fetchCanonicalDailyRollup` implementations in `useClientDashboardMetricsQuery.ts` and `useDonationMetricsQuery.ts`.

**Solution:** Created `src/lib/actblueRpcClient.ts` as the single source of truth.

**File Created:**
```
src/lib/actblueRpcClient.ts (130 lines)
├── fetchDailyRollup() - Timezone-aware daily rollup
├── fetchPeriodSummary() - Period totals
├── fetchActBlueRollup() - Combined fetcher
└── RPC field mapping documentation
```

**Key Implementation:**
- Standardized field mappings (RPC → Frontend):
  - `gross_raised` → `gross_raised`
  - `transaction_count` → `donation_count`
  - `recurring_amount` → `recurring_revenue`
- Calculated `total_fees` as `(gross_raised - net_raised)`
- Enforced `p_use_utc: false` (Eastern Time)

---

### 1.2 Unified ActBlue Hook Enhancement (R2 - P0)

**Issue:** `useActBlueMetrics` existed but lacked sparklines, trends, and previous period data required by `buildHeroKpis`.

**Solution:** Enhanced hook with parallel period fetching and sparkline computation.

**File Enhanced:**
```
src/hooks/useActBlueMetrics.ts
├── computeSparklines() - 7-day normalized coordinates
├── calculatePreviousPeriod() - Date range calculation
├── calculateTrend() - Period-over-period %
├── Parallel fetching (current + previous period)
└── Extended ActBlueMetricsDataWithSparklines type
```

**New Exports:**
- `SparklineData` interface
- `ActBlueMetricsDataWithSparklines` interface
- Derived hooks: `useActBlueSummary`, `useActBlueChannels`, `useActBlueDailyData`

---

### 1.3 Dashboard Migration Adapter (MR-1 - P1)

**Issue:** `ClientDashboard.tsx` used 1,200-line legacy hook, preventing unified metrics adoption.

**Solution:** Created adapter hook bridging unified data to legacy format.

**File Created:**
```
src/hooks/useDashboardMetricsV2.ts (283 lines)
├── fetchChannelSpend() - Meta/SMS spend aggregation
├── transformToLegacyFormat() - Maps unified → DashboardKPIs
├── Channel name mapping (meta→"Meta Ads", etc.)
└── Composite loading/error states
```

**Migration Applied:**
```diff
src/pages/ClientDashboard.tsx
- import { useClientDashboardMetricsQuery } from "@/queries"
+ import { useDashboardMetricsV2 } from "@/hooks/useDashboardMetricsV2"
```

---

### 1.4 Timezone Standardization (QW-3/R4 - P1)

**Issue:** Inconsistent `p_use_utc` parameter usage across hooks.

**Solution:** 
- Removed legacy `getTimezoneAwareBounds()` function from `useDonationMetricsQuery.ts`
- All RPC calls now rely on server-side Eastern Time interpretation
- Added documentation comment explaining the pattern

**Standardized Pattern:**
```typescript
// Server interprets date strings as Eastern Time boundaries
// No manual timezone conversion needed on frontend
```

---

### 1.5 Query Key Unification (LA-1 - P1)

**Issue:** Multiple key patterns prevented cache sharing (`donationKeys`, `actBlueMetricsKeys`, etc.).

**Solution:** Migrated `useDonationMetricsQuery` to use unified `actblueKeys`.

**Changes in `useDonationMetricsQuery.ts`:**
```typescript
// Before
queryKey: donationKeys.metrics(organizationId || "", effectiveRange)

// After  
queryKey: actblueKeys.periodSummary(organizationId || "", startDate, endDate)
```

**Query Keys Standardized (`src/queries/queryKeys.ts`):**
```typescript
export const actblueKeys = {
  all: ['actblue'] as const,
  dailyRollup: (orgId, start, end) => [...actblueKeys.all, 'daily-rollup', ...],
  periodSummary: (orgId, start, end) => [...actblueKeys.all, 'period-summary', ...],
  filteredRollup: (orgId, start, end, campaign?, creative?) => [...],
};
```

---

### 1.6 Legacy Hook Cleanup (R3/QW-2 - P1)

**Issue:** `useChannelSummariesLegacy` exported but potentially unused.

**Solution:** Verified unused and removed.

**Files Modified:**
```
src/queries/useChannelSummariesQuery.ts
- Deleted useChannelSummariesLegacy function

src/queries/index.ts
- Removed useChannelSummariesLegacy from exports
```

---

### 1.7 Deprecation Warning (P2)

**Issue:** `useClientDashboardMetricsQuery` still exists for edge cases.

**Solution:** Added `@deprecated` JSDoc warning.

**Implementation:**
```typescript
/**
 * @deprecated Use `useActBlueMetrics` from `@/hooks/useActBlueMetrics` instead.
 * This hook is retained for backwards compatibility during migration.
 */
export function useClientDashboardMetricsQuery(...) { ... }
```

---

## 2. Files Changed Summary

| File | Action | Lines Changed | Purpose |
|------|--------|---------------|---------|
| `src/lib/actblueRpcClient.ts` | **Created** | +130 | Single source of truth for RPC calls |
| `src/hooks/useActBlueMetrics.ts` | Enhanced | +200 | Sparklines, trends, previous period |
| `src/hooks/useDashboardMetricsV2.ts` | **Created** | +283 | Adapter for ClientDashboard migration |
| `src/pages/ClientDashboard.tsx` | Modified | ~5 | Import migration |
| `src/queries/useDonationMetricsQuery.ts` | Modified | -40, +10 | Removed timezone logic, unified keys |
| `src/queries/useChannelSummariesQuery.ts` | Modified | -45 | Removed legacy hook |
| `src/queries/useClientDashboardMetricsQuery.ts` | Modified | +6 | Added deprecation warning |
| `src/queries/index.ts` | Modified | ~10 | Updated exports |

**Net Impact:** ~+550 lines added, ~85 lines removed

---

## 3. Architecture After Remediation

```
┌─────────────────────────────────────────────────────────────────┐
│                    CANONICAL DATA LAYER                         │
├─────────────────────────────────────────────────────────────────┤
│  src/lib/actblueRpcClient.ts                                    │
│  └── fetchDailyRollup(), fetchPeriodSummary()                   │
│  └── Standardized field mappings                                │
│  └── Enforced p_use_utc=false (Eastern Time)                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    UNIFIED HOOK LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│  src/hooks/useActBlueMetrics.ts (PRIMARY)                       │
│  └── Full dashboard metrics with sparklines & trends            │
│  └── Derived: useActBlueSummary, useActBlueChannels, etc.       │
│                                                                 │
│  src/hooks/useDashboardMetricsV2.ts (ADAPTER)                   │
│  └── Bridges unified data → legacy DashboardKPIs format         │
│  └── Combines ActBlue + Meta/SMS spend                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CONSUMPTION LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  ClientDashboard.tsx → useDashboardMetricsV2 ✅                 │
│  DonationOverview.tsx → useDonationMetricsQuery (actblueKeys) ✅│
│  Other pages → useActBlueMetrics directly ✅                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Outstanding Items (P2/P3)

| ID | Issue | Priority | Effort | Notes |
|----|-------|----------|--------|-------|
| R6 | Backfill Edge Function Audit | P2 | 2h | 33+ `backfill-*` functions need review |
| MR-2 | Unified Donor Segment RPC | P2 | 4h | Consolidate 2-stage fetch in `useDonorSegmentQuery` |
| N3 | Session Table TTL Cleanup | P3 | 1h | Verify cron job for `user_sessions` |
| LA-2 | Materialized Channel Summary | P3 | 8h | `channel_summary_daily` view for cross-channel queries |

---

## 5. Validation Checklist

- [x] `ClientDashboard.tsx` renders correctly with unified hook
- [x] KPI cards show accurate data
- [x] Sparklines display 7-day trends
- [x] Period-over-period comparisons work
- [x] Channel breakdown displays correctly
- [x] No console warnings about deprecated hooks
- [x] Query cache sharing verified (same data, single fetch)

---

## 6. Recommendations

### Immediate
1. Monitor `ClientDashboard` for any data discrepancies
2. Review any pages still importing `useClientDashboardMetricsQuery` and migrate

### Short-term (2 weeks)
1. Address MR-2: Create unified donor segment RPC
2. Complete R6: Audit and archive one-time backfill functions

### Medium-term (1 month)
1. Remove `useClientDashboardMetricsQuery` after confirming no consumers
2. Implement LA-2 materialized view for cross-channel queries
3. Performance benchmark before/after comparison

---

## Appendix: Type Exports Added

```typescript
// src/queries/index.ts - New exports
export type { SparklineData } from "./useClientDashboardMetricsQuery";
export type { 
  ActBlueMetricsDataWithSparklines,
  SparklineData as ActBlueSparklineData 
} from "@/hooks/useActBlueMetrics";
```

---

*Report Generated: January 2026*  
*Audit Reference: docs/DATA_ARCHITECTURE_AUDIT.md*
