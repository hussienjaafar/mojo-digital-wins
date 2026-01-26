# Data Architecture Audit Report (v6 - Timezone Fix)

**Repo:** mojo-digital-wins
**Branch:** docs/dashboard-architecture
**Audit Date:** 2026-01-26
**Last Update:** Timezone normalization fix
**Auditor:** Claude (Data Architecture Specialist)
**Remediation Report:** [DATA_ARCHITECTURE_REMEDIATION_REPORT.md](./DATA_ARCHITECTURE_REMEDIATION_REPORT.md)

---

## 1. REPO AUDIT SUMMARY

### Remediation Status: P0/P1 COMPLETE + Timezone Fix

All critical (P0) and high-priority (P1) issues identified in the original audit have been resolved.

### Latest Fix: ActBlue Timestamp Timezone Normalization

**Issue Discovered:** $40 discrepancy between ActBlue ($343) and our system ($303) for "Michael Blake for Congress" on Jan 25, 2026.

**Root Cause:** ActBlue sends timestamps in Eastern Time without timezone suffix. PostgreSQL interprets them as UTC, causing a 5-hour offset that shifts day boundaries for late-night donations.

**Solution Applied:**
| File | Change |
|------|--------|
| `supabase/functions/_shared/actblue-timezone.ts` | **NEW** - Shared utility to normalize ActBlue timestamps to UTC |
| `supabase/functions/actblue-webhook/index.ts` | Updated to normalize `paidAt` before storage |
| `supabase/functions/sync-actblue-csv/index.ts` | Updated to normalize `paid_at`/`date` fields |

**Behavior:**
- Timestamps with timezone suffix (e.g., `2026-01-25T23:30:00Z`) → Used as-is
- Timestamps without timezone suffix (e.g., `2026-01-25T23:30:00`) → Assumed Eastern Time, converted to UTC
- DST-aware: Uses EST (-05:00) in winter, EDT (-04:00) in summer

| Priority | Issue | Status | Resolution |
|----------|-------|--------|------------|
| P0 | Duplicate RPC wrapper implementations | **RESOLVED** | Created `src/lib/actblueRpcClient.ts` as single source |
| P0 | Unified hook underutilized | **RESOLVED** | Created `useDashboardMetricsV2` adapter, migrated `ClientDashboard.tsx` |
| P1 | Query cache key fragmentation | **RESOLVED** | Added unified `actblueKeys` in `queryKeys.ts` |
| P1 | Legacy compatibility hook | **RESOLVED** | Removed `useChannelSummariesLegacy` |
| P1 | RPC parameter inconsistency | **RESOLVED** | Standardized on `p_use_utc=false` (Eastern Time) |
| P2 | Meta tables clarified | **CLOSED** | Documented: `meta_ad_metrics` = canonical |

### Latest Updates (83e619e) - MAJOR CLEANUP

**Files Deleted (-2,605 lines):**
| File | Lines | Reason |
|------|-------|--------|
| `useClientDashboardMetricsQuery.ts` | 1,193 | Deprecated hook - fully replaced |
| `ClientDashboardMetrics.tsx` | 639 | Dead code - not imported anywhere |
| `useClientDashboardMetricsQuery.test.ts` | 310 | Tests for deleted hook |
| `campaign-filter.test.ts` | 425 | Tests for deleted hook |

**Files Created (+199 lines):**
| File | Lines | Purpose |
|------|-------|---------|
| `src/types/dashboard.ts` | 91 | Extracted types from deleted hook |
| `20260126001754` migration | 108 | Improved channel detection (lowercase, refcode2, contribution_form) |

**Channel Detection Improvements:**
- Now uses lowercase channel names (`meta`, `sms`, `email`, `organic`, `other`)
- Detects Meta via `refcode2` field (Facebook click ID suffix)
- Detects SMS via `contribution_form` pattern (`%sms%`)
- Better refcode pattern matching

### Files Added/Changed in Remediation

| File | Action | Lines | Purpose |
|------|--------|-------|---------|
| `src/lib/actblueRpcClient.ts` | **Created** | 147 | Single source of truth for RPC calls |
| `src/hooks/useDashboardMetricsV2.ts` | **Created** | 283 | Adapter for ClientDashboard migration |
| `src/hooks/useActBlueMetrics.ts` | Enhanced | +158 | Sparklines, trends, previous period |
| `src/queries/queryKeys.ts` | Enhanced | +18 | Added `actblueKeys` |
| `src/pages/ClientDashboard.tsx` | Modified | ~7 | Migrated to `useDashboardMetricsV2` |
| `src/queries/useDonationMetricsQuery.ts` | Refactored | -204 | Uses shared RPC client |
| `src/queries/useChannelSummariesQuery.ts` | Refactored | -51 | Removed legacy hook |
| `src/queries/useClientDashboardMetricsQuery.ts` | Refactored | -121 | Uses shared RPC client, added deprecation |
| `src/queries/useActBlueDailyRollupQuery.ts` | Refactored | -117 | Uses shared RPC client |

**Net Impact:** +916 lines added, -511 lines removed (cleaner, consolidated)

---

## 2. CURRENT ARCHITECTURE (Post-Remediation)

```
┌─────────────────────────────────────────────────────────────────┐
│                    CANONICAL DATA LAYER                         │
├─────────────────────────────────────────────────────────────────┤
│  src/lib/actblueRpcClient.ts                                    │
│  ├── fetchDailyRollup()     - Timezone-aware daily metrics      │
│  ├── fetchPeriodSummary()   - Period totals                     │
│  └── fetchActBlueRollup()   - Combined fetcher                  │
│                                                                 │
│  Standardized field mappings:                                   │
│  • gross_raised → gross_raised                                  │
│  • transaction_count → donation_count                           │
│  • recurring_amount → recurring_revenue                         │
│  • total_fees = (gross_raised - net_raised)                     │
│  • p_use_utc = false (Eastern Time)                             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    UNIFIED HOOK LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│  src/hooks/useActBlueMetrics.ts (PRIMARY)                       │
│  ├── Full dashboard metrics with sparklines & trends            │
│  ├── computeSparklines() - 7-day normalized coordinates         │
│  ├── calculatePreviousPeriod() - Period comparison              │
│  └── Derived: useActBlueSummary, useActBlueChannels, etc.       │
│                                                                 │
│  src/hooks/useDashboardMetricsV2.ts (ADAPTER)                   │
│  ├── Bridges unified data → legacy DashboardKPIs format         │
│  ├── Combines ActBlue + Meta/SMS spend                          │
│  └── Provides _unified property for direct access               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CONSUMPTION LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  ✅ ClientDashboard.tsx      → useDashboardMetricsV2            │
│  ✅ DonationMetrics.tsx      → useDonationMetricsQuery          │
│  ✅ Other pages              → useActBlueMetrics directly       │
│                                                                 │
│  ⚠️  useClientDashboardMetricsQuery - DEPRECATED (retained)     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. QUERY KEY STANDARDIZATION

### New Unified Keys (`src/queries/queryKeys.ts`)

```typescript
export const actblueKeys = {
  all: ['actblue'] as const,
  dailyRollup: (orgId, start, end) =>
    [...actblueKeys.all, 'daily-rollup', orgId, start, end],
  periodSummary: (orgId, start, end) =>
    [...actblueKeys.all, 'period-summary', orgId, start, end],
  filteredRollup: (orgId, start, end, campaign?, creative?) =>
    [...actblueKeys.all, 'filtered-rollup', orgId, start, end, campaign, creative],
};
```

### Migration Status

| Hook | Old Key | New Key | Status |
|------|---------|---------|--------|
| `useDonationMetricsQuery` | `donationKeys.metrics` | `actblueKeys.periodSummary` | ✅ Migrated |
| `useActBlueDailyRollupQuery` | `actBlueRollupKeys.daily` | `actblueKeys.dailyRollup` | ✅ Migrated |
| `useChannelSummariesQuery` | `channelKeys.summaries` | (unchanged) | N/A |

---

## 4. VERIFICATION RESULTS

### Duplicate Code Elimination - VERIFIED

```bash
# No longer found in source files
grep -r "fetchCanonicalDailyRollup" src/
# Result: 0 files (only in docs)

grep -r "fetchCanonicalPeriodSummary" src/
# Result: 0 files (only in docs)
```

### Legacy Hook Removal - VERIFIED

```bash
grep -r "useChannelSummariesLegacy" src/
# Result: Only comment "REMOVED - was unused"
```

### ClientDashboard Migration - VERIFIED

```typescript
// src/pages/ClientDashboard.tsx (line 29)
import { useDashboardMetricsV2 } from "@/hooks/useDashboardMetricsV2";
```

### Shared RPC Client Usage - VERIFIED

All query hooks now import from shared client:
- `useClientDashboardMetricsQuery.ts:8` - `import { fetchDailyRollup, fetchPeriodSummary } from "@/lib/actblueRpcClient"`
- `useDonationMetricsQuery.ts:9` - `import { fetchDailyRollup, fetchPeriodSummary } from "@/lib/actblueRpcClient"`

---

## 5. OUTSTANDING ITEMS (P2/P3)

| ID | Issue | Priority | Effort | Notes |
|----|-------|----------|--------|-------|
| ~~NEW~~ | ~~Delete dead `ClientDashboardMetrics.tsx`~~ | ~~P2~~ | - | **DONE** - Deleted in 83e619e |
| ~~-~~ | ~~Remove deprecated hook~~ | ~~P3~~ | - | **DONE** - `useClientDashboardMetricsQuery` deleted |
| R6 | Backfill Edge Function Audit | P2 | 2h | 33+ `backfill-*` functions need review |
| MR-2 | Unified Donor Segment RPC | P2 | 4h | Consolidate 2-stage fetch in `useDonorSegmentQuery` |
| N3 | Session Table TTL Cleanup | P3 | 1h | Verify cron job for `user_sessions` |
| LA-2 | Materialized Channel Summary | P3 | 8h | `channel_summary_daily` view for cross-channel queries |

---

## 6. RECOMMENDATIONS

### Immediate (This Week)
1. ✅ ~~Delete duplicate RPC wrappers~~ **DONE**
2. ✅ ~~Remove `useChannelSummariesLegacy`~~ **DONE**
3. ✅ ~~Migrate ClientDashboard to unified hook~~ **DONE**
4. Monitor `ClientDashboard` for any data discrepancies

### Short-term (2 weeks)
1. Address MR-2: Create unified donor segment RPC
2. Complete R6: Audit and archive one-time backfill functions
3. Review any pages still importing deprecated `useClientDashboardMetricsQuery`

### Medium-term (1 month)
1. Remove `useClientDashboardMetricsQuery` after confirming no consumers
2. Implement LA-2 materialized view for cross-channel queries
3. Performance benchmark before/after comparison

---

## 7. ARCHITECTURE QUALITY METRICS

### Before Remediation
- 3 duplicate RPC wrapper implementations
- 4+ different query key patterns for same data
- ~1,700 lines across duplicate hooks
- Cache misses due to key fragmentation

### After Remediation
- 1 shared RPC client (147 lines)
- 1 unified key pattern (`actblueKeys`)
- ~916 net new lines (adapter + enhancements)
- Cache hits via standardized keys

### Code Health Improvements
- **Single Source of Truth:** `actblueRpcClient.ts` for all ActBlue RPC calls
- **Standardized Field Mapping:** Documented in single location
- **Deprecation Path:** Legacy hooks marked with `@deprecated` JSDoc
- **Type Safety:** New exports for `SparklineData`, `ActBlueMetricsDataWithSparklines`

---

## Appendix A: Files Reference (Final State)

### Core Data Layer
| File | Lines | Status |
|------|-------|--------|
| `src/lib/actblueRpcClient.ts` | 147 | **CANONICAL** - All RPC calls |
| `src/hooks/useActBlueMetrics.ts` | 717 | **PRIMARY** - Unified metrics hook |
| `src/hooks/useDashboardMetricsV2.ts` | 283 | **ADAPTER** - ClientDashboard bridge |

### Query Hooks (Final State)
| File | Status |
|------|--------|
| `src/queries/useClientDashboardMetricsQuery.ts` | **DELETED** - Replaced by `useDashboardMetricsV2` |
| `src/queries/useDonationMetricsQuery.ts` | ✅ Uses shared RPC client + `actblueKeys` |
| `src/queries/useActBlueDailyRollupQuery.ts` | ✅ Uses shared RPC client + `actblueKeys` |
| `src/queries/useChannelSummariesQuery.ts` | ✅ Cleaned (legacy hook removed) |

### Types (Extracted)
| File | Status |
|------|--------|
| `src/types/dashboard.ts` | ✅ **NEW** - Types extracted from deleted hook |

### New Exports
```typescript
// src/queries/index.ts
export type { SparklineData } from "./useClientDashboardMetricsQuery";
export type {
  ActBlueMetricsDataWithSparklines,
  SparklineData as ActBlueSparklineData
} from "@/hooks/useActBlueMetrics";
```

---

*Audit Complete - All P0/P1 Items Resolved*
*Report Generated: January 2026*
