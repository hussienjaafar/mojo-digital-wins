# Data Architecture Audit Report (v2)

**Repo:** mojo-digital-wins
**Branch:** docs/dashboard-architecture
**Audit Date:** 2026-01-25 (Updated)
**Last Pull:** 978a781 (166 files changed, +22,773 / -4,459 lines)
**Auditor:** Claude (Data Architecture Specialist)

---

## 1. REPO AUDIT SUMMARY

### What's New Since Last Audit
- **22+ new migrations** adding timezone-aware RPCs, multi-org support, session management
- **10+ new edge functions** including integration health, data reconciliation, backfill management
- **Major new features:** Donor segmentation, ad hierarchy, motivation insights, data validation
- **Deleted files:** `useCreativeVariationsQuery.ts`, `CampaignCreativeFilters.tsx` (consolidation)
- **158 edge functions** total (vs ~160 before - some consolidation)

### Critical Findings

| Priority | Issue | Status | Impact |
|----------|-------|--------|--------|
| P0 | Duplicate RPC wrapper implementations | **STILL PRESENT** | 2 files still duplicate `fetchCanonicalDailyRollup` |
| P0 | Unified hook underutilized | **STILL PRESENT** | `useActBlueMetrics` exists but `useClientDashboardMetricsQuery` still used |
| P1 | Query cache key fragmentation | **PARTIALLY FIXED** | Timezone-aware keys added, but multiple key patterns remain |
| P1 | Legacy compatibility hook | **STILL PRESENT** | `useChannelSummariesLegacy` exported but may be unused |
| P2 | Meta tables clarified | **IMPROVED** | `meta_ad_metrics` is canonical, `_daily` variant serves ad-level |

### Key Improvements Made
1. **Timezone-aware RPCs** - All rollup RPCs now have `p_use_utc` parameter (defaults TRUE)
2. **Unified ActBlue hook** - `useActBlueMetrics` fully implemented with `get_actblue_dashboard_metrics` RPC
3. **Donor key standardization** - `compute_donor_key()` function created for consistent hashing
4. **Integration health monitoring** - New `check-integration-health` edge function
5. **Data reconciliation** - New `reconcile-actblue-data` for gap detection

---

## 2. SYSTEM MAP (Updated)

### Data Flow Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              EXTERNAL SOURCES                                │
├─────────────────┬──────────────────┬──────────────────┬────────────────────┤
│   ActBlue       │   Meta Ads API   │   SMS/Switchboard│   News/Trends      │
│   (webhook)     │   (scheduled)    │   (webhook)      │   (scheduled)      │
└────────┬────────┴────────┬─────────┴────────┬─────────┴──────────┬─────────┘
         │                 │                  │                    │
         ▼                 ▼                  ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EDGE FUNCTIONS (158 total)                        │
├─────────────────┬──────────────────┬──────────────────┬────────────────────┤
│ actblue-webhook │ sync-meta-ads    │ sync-switchboard │ fetch-rss-feeds    │
│ reconcile-      │ tiered-meta-sync │ -sms             │ fetch-google-news  │
│   actblue-data  │ check-integration│                  │                    │
│ backfill-daily- │   -health        │                  │                    │
│   metrics       │                  │                  │                    │
└────────┬────────┴────────┬─────────┴────────┬─────────┴──────────┬─────────┘
         │                 │                  │                    │
         ▼                 ▼                  ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PRIMARY STORAGE (Tables)                          │
├─────────────────┬──────────────────┬──────────────────┬────────────────────┤
│ actblue_        │ meta_campaigns   │ sms_campaigns    │ articles           │
│ transactions    │ meta_ad_metrics  │ sms_events       │ bluesky_posts      │
│                 │ meta_creative_   │                  │ entity_trends      │
│                 │   insights       │                  │                    │
└────────┬────────┴────────┬─────────┴────────┬─────────┴──────────┬─────────┘
         │                 │                  │                    │
         ▼                 ▼                  ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    NEW: Unified RPC Layer (Timezone-aware)                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ get_actblue_daily_rollup(p_use_utc=TRUE)                                    │
│ get_actblue_period_summary(p_use_utc=TRUE)                                  │
│ get_actblue_dashboard_metrics(p_use_utc=TRUE) ← UNIFIED, PREFERRED          │
│ get_actblue_filtered_rollup(p_use_utc=TRUE)                                 │
│ get_sms_metrics()                                                           │
│ check_client_data_health()                                                  │
└────────┬────────────────────────────────────┬───────────────────────────────┘
         │                                    │
         ▼                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           REACT QUERY HOOKS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ ✅ useActBlueMetrics (UNIFIED) - calls get_actblue_dashboard_metrics        │
│    └── useActBlueSummary, useActBlueChannels, useActBlueDailyData          │
│    └── useSMSMetricsUnified, useClientHealth                                │
│                                                                             │
│ ⚠️  useClientDashboardMetricsQuery - STILL has duplicate RPC wrappers       │
│ ⚠️  useDonationMetricsQuery - STILL has duplicate RPC wrappers              │
│ ⚠️  useChannelSummariesQuery + useChannelSummariesLegacy                    │
│                                                                             │
│ ✅ NEW: useDonorSegmentQuery - advanced filtering with LTV enrichment       │
│ ✅ NEW: useBackfillStatus - track import job progress                       │
│ ✅ NEW: useIntegrationHealth - health scores for integrations               │
│ ✅ NEW: useAdHierarchy - campaign→adset→ad aggregation                      │
└────────┬────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DASHBOARD PAGES                                   │
├─────────────────┬──────────────────┬──────────────────┬────────────────────┤
│ ClientDashboard │ ClientDonor      │ ClientAd         │ NEW: Donor         │
│ (still uses     │ Intelligence     │ Performance      │ Segmentation       │
│ old hook)       │                  │ (uses hierarchy) │                    │
└─────────────────┴──────────────────┴──────────────────┴────────────────────┘
```

---

## 3. REDUNDANCY & WASTE FINDINGS (Updated)

| ID | Domain | Problem Type | Evidence | Status | Fix | Effort |
|----|--------|--------------|----------|--------|-----|--------|
| R1 | ActBlue | **Duplicate RPC Wrappers** | `useClientDashboardMetricsQuery.ts:194-230`, `useDonationMetricsQuery.ts:116-161` both implement `fetchCanonicalDailyRollup` | **OPEN** | Delete from both, import from `useActBlueMetrics` or shared lib | S |
| R2 | ActBlue | **Unified Hook Not Adopted** | `useActBlueMetrics.ts` has full implementation, but `ClientDashboard.tsx` still uses `useClientDashboardMetricsQuery` | **OPEN** | Migrate `ClientDashboard.tsx` to use `useActBlueMetrics` | M |
| R3 | Queries | **Legacy Compatibility Hook** | `useChannelSummariesLegacy` exported in `index.ts:18` | **OPEN** | Grep for usage, remove if unused | S |
| R4 | ActBlue | **RPC Parameter Mismatch** | `useActBlueMetrics` uses `p_use_utc=false`, but `useDonationMetricsQuery` doesn't pass param | **OPEN** | Standardize UTC usage across all hooks | S |
| R5 | Meta | **Table Purpose Clarified** | `meta_ad_metrics` = daily rollup, `meta_ad_metrics_daily` = ad-level breakdown | **CLOSED** | Already serves different purposes | - |
| R6 | Edge Fn | **Backfill Proliferation** | 10+ `backfill-*` functions, some may be one-time | **OPEN** | Audit and archive completed backfills | S |

### New Issues Introduced

| ID | Domain | Problem Type | Evidence | Impact | Fix | Effort |
|----|--------|--------------|----------|--------|-----|--------|
| N1 | Donor | **Hybrid Query Strategy** | `useDonorSegmentQuery.ts:270-350` fetches demographics, then LTV separately | Adds latency for segment queries | Consider unified RPC | M |
| N2 | Auth | **Multi-table Sync** | `organization_memberships` + `client_users` sync triggers | Complexity risk | Monitor for sync issues | - |
| N3 | Sessions | **Table Bloat Risk** | `user_sessions` tracks all sessions indefinitely | Storage growth | Ensure cleanup cron active | S |

---

## 4. OPTIMIZATION PLAN (Updated)

### Phase 1: Quick Wins (1-2 days)

#### QW-1: Delete Duplicate RPC Wrappers (HIGH PRIORITY)
**What:** Remove `fetchCanonicalDailyRollup` and `fetchCanonicalPeriodSummary` from both files

**Files:**
- `src/queries/useClientDashboardMetricsQuery.ts` - Lines 194-268 (delete)
- `src/queries/useDonationMetricsQuery.ts` - Lines 116-220 (delete)

**Replace with:**
```typescript
// Option A: Import from useActBlueMetrics
import { useActBlueMetrics } from '@/hooks/useActBlueMetrics';

// Option B: Create shared lib (if not using full hook)
// src/lib/actblue-rpc.ts
export async function fetchDailyRollup(orgId: string, start: string, end: string) {
  return supabase.rpc('get_actblue_daily_rollup', { ... });
}
```

**Validation:**
- Run `npm run test`
- Verify ClientDashboard renders with same data

#### QW-2: Check Legacy Hook Usage
```bash
# Run this to find usage
grep -r "useChannelSummariesLegacy" src/ --include="*.tsx" --include="*.ts" | grep -v "index.ts" | grep -v ".test."
```

If empty, remove from `src/queries/useChannelSummariesQuery.ts:345-386` and `src/queries/index.ts:18`.

#### QW-3: Standardize UTC Parameter
All hooks calling ActBlue RPCs should use consistent `p_use_utc` value:
- `useActBlueMetrics` uses `false` (Eastern Time) - **KEEP as canonical**
- Update `useDonationMetricsQuery` to explicitly pass `p_use_utc: false`
- Update `useClientDashboardMetricsQuery` to explicitly pass `p_use_utc: false`

### Phase 2: Medium Refactors (1-2 weeks)

#### MR-1: Migrate ClientDashboard to Unified Hook
**Current:** `ClientDashboard.tsx` uses `useClientDashboardMetricsQuery` (1200+ lines)
**Target:** Use `useActBlueMetrics` + derived hooks

**Migration Steps:**
1. Map `DashboardKPIs` interface to `ActBlueSummary` + additional fields
2. Create adapter function if needed for missing fields (sparklines, channel breakdown)
3. Update `ClientDashboard.tsx` imports
4. Remove `useClientDashboardMetricsQuery` calls
5. Test KPI cards, charts, and trend comparisons

**Missing from `useActBlueMetrics`:**
- Previous period comparison (partially implemented)
- Sparkline data (not in RPC)
- Meta/SMS spend integration

**Recommendation:** Extend `get_actblue_dashboard_metrics` RPC to include sparklines and trends, OR create separate sparkline hook.

#### MR-2: Consolidate Donor Segment Queries
**Current:** `useDonorSegmentQuery.ts` does 2-stage fetch (demographics → LTV)
**Opportunity:** Create `get_donor_segment_data` RPC that joins tables server-side

```sql
CREATE FUNCTION get_donor_segment_data(
  p_org_id UUID,
  p_filters JSONB
) RETURNS TABLE (...) AS $$
  -- Join donor_demographics + donor_ltv_predictions + refcode_mappings
  -- Apply filters server-side
$$;
```

### Phase 3: Larger Architecture Improvements (2-6 weeks)

#### LA-1: Complete Query Key Standardization
**Goal:** All ActBlue-related queries share cache when fetching same data

**Current state:**
```typescript
// Different key patterns - NO cache sharing
actBlueMetricsKeys.dashboard(...)  // ['actblue-metrics', 'dashboard', ...]
donationKeys.metrics(...)          // ['donations', 'metrics', ...]
channelKeys.summaries(...)         // ['channels', 'summaries', ...]
```

**Target:**
```typescript
// Unified key structure
export const actblueKeys = {
  all: ['actblue'] as const,
  metrics: (orgId: string, dateRange: { start: string; end: string }) =>
    [...actblueKeys.all, 'metrics', orgId, dateRange.start, dateRange.end],
  rollup: {
    daily: (orgId, start, end) => [...actblueKeys.all, 'rollup', 'daily', orgId, start, end],
    summary: (orgId, start, end) => [...actblueKeys.all, 'rollup', 'summary', orgId, start, end],
  }
};
```

#### LA-2: Create Materialized Channel Summary View
**Why:** Channel summaries (Meta + SMS + ActBlue) fetched repeatedly across pages

```sql
CREATE MATERIALIZED VIEW channel_summary_daily AS
SELECT
  organization_id,
  date,
  -- ActBlue
  actblue_gross, actblue_net, actblue_donors,
  -- Meta
  meta_spend, meta_impressions, meta_clicks,
  -- SMS
  sms_cost, sms_sent, sms_raised
FROM ...
WITH DATA;

CREATE UNIQUE INDEX ON channel_summary_daily (organization_id, date);

-- Refresh after sync completes
SELECT cron.schedule('refresh-channel-summary', '0 7 * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY channel_summary_daily$$);
```

---

## 5. SINGLE SOURCE OF TRUTH PROPOSAL (Updated)

### ActBlue Domain

| Layer | Canonical Source | Notes |
|-------|-----------------|-------|
| Storage | `actblue_transactions` | Immutable source of truth |
| Rollup | `get_actblue_dashboard_metrics` RPC | **PREFERRED** - single call, timezone-aware |
| Daily | `get_actblue_daily_rollup` RPC | For charts requiring daily granularity |
| Summary | `get_actblue_period_summary` RPC | For KPI totals |
| Hook | `useActBlueMetrics` | **CANONICAL HOOK** - migrate all consumers here |

### Donor Domain

| Layer | Canonical Source | Notes |
|-------|-----------------|-------|
| Demographics | `donor_demographics` table | With `donor_key` for joins |
| LTV | `donor_ltv_predictions` table | Keyed by `donor_key` |
| Segments | `useDonorSegmentQuery` hook | Hybrid server/client filtering |
| Identity | `compute_donor_key()` function | MD5-based standardized hashing |

### Integration Health Domain (NEW)

| Layer | Canonical Source | Notes |
|-------|-----------------|-------|
| Health Check | `check-integration-health` edge function | Calculates scores |
| Hook | `useIntegrationHealth` | Frontend consumption |
| Storage | `client_api_credentials.last_tested_at` | Last test timestamp |

---

## 6. NEW FEATURES ANALYSIS

### A. Donor Segmentation System
**Files:** `src/queries/useDonorSegmentQuery.ts` (827 lines), `src/types/donorSegment.ts`

**Architecture:**
- Server-side: Filter on `donor_demographics` (state, tier, frequency)
- Client-side: Computed fields (churn_risk, attribution)
- Enrichment: Batch LTV lookups via `donor_ltv_predictions`

**Concern:** Two-query strategy adds latency. Consider unified RPC.

### B. Ad Hierarchy System
**Files:** `src/hooks/useAdHierarchy.ts`, `src/types/adHierarchy.ts`

**Architecture:**
- Takes flat ad data, aggregates by `campaign_id` then `adset_id`
- Uses `useMemo` for O(n) aggregation
- Returns `{ campaigns[], adsets[], ads[] }`

**Status:** Clean implementation, no issues.

### C. Backfill Monitoring
**Files:** `src/hooks/useBackfillStatus.ts`, `supabase/functions/backfill-daily-metrics/`

**Architecture:**
- Tracks chunk-based import progress
- Supports cancel/retry operations
- UI component: `BackfillStatusBanner.tsx`

**Status:** Good addition for data ops visibility.

### D. Integration Health Monitoring
**Files:** `src/hooks/useIntegrationHealth.ts`, `supabase/functions/check-integration-health/`

**Scoring:**
- Credential config: 30%
- Webhook health: 30%
- Sync health: 20%
- Data freshness: 20%

**Status:** Valuable for proactive monitoring.

---

## 7. API CALL EFFICIENCY REVIEW (Updated)

### ActBlue RPCs - Now Unified

| RPC | Purpose | Parameters | Recommended Usage |
|-----|---------|------------|-------------------|
| `get_actblue_dashboard_metrics` | **ALL metrics in one call** | org, dates, campaign?, creative?, use_utc? | **PRIMARY** - use for dashboards |
| `get_actblue_daily_rollup` | Daily granularity | org, dates, use_utc? | Charts needing day-by-day |
| `get_actblue_period_summary` | Period totals | org, dates, use_utc? | KPI cards only |
| `get_actblue_filtered_rollup` | With campaign/creative filter | org, dates, filters, use_utc? | Drill-downs |

### Timezone Parameter Standard

**Recommendation:** Standardize on `p_use_utc = FALSE` (Eastern Time) to match ActBlue's Fundraising Performance dashboard:

```typescript
// All hooks should use this pattern
const { data } = await supabase.rpc('get_actblue_dashboard_metrics', {
  p_organization_id: orgId,
  p_start_date: startDate,
  p_end_date: endDate,
  p_use_utc: false, // Match ActBlue's ET-based reporting
});
```

---

## 8. NEXT STEPS CHECKLIST

### Immediate (This Week)
- [ ] **QW-1**: Delete duplicate `fetchCanonicalDailyRollup` from both hooks
- [ ] **QW-2**: Check `useChannelSummariesLegacy` usage and remove if unused
- [ ] **QW-3**: Add explicit `p_use_utc: false` to all RPC calls

### Short-term (Next 2 Weeks)
- [ ] **MR-1**: Begin migrating `ClientDashboard.tsx` to `useActBlueMetrics`
- [ ] Create adapter for missing fields (sparklines, trends)
- [ ] Update tests to use unified hook

### Medium-term (Next Month)
- [ ] **MR-2**: Create unified donor segment RPC
- [ ] **LA-1**: Standardize all query keys under `actblueKeys`
- [ ] Remove deprecated hooks after migration complete

### Long-term (Next Quarter)
- [ ] **LA-2**: Implement materialized `channel_summary_daily` view
- [ ] Performance benchmark before/after comparison
- [ ] Archive one-time backfill edge functions

---

## Appendix A: Files Reference (Updated)

### Query Hooks - Current State
| File | Lines | Status |
|------|-------|--------|
| `src/hooks/useActBlueMetrics.ts` | 559 | **CANONICAL** - Use this |
| `src/queries/useClientDashboardMetricsQuery.ts` | ~1200 | ⚠️ Has duplicate wrappers |
| `src/queries/useDonationMetricsQuery.ts` | ~450 | ⚠️ Has duplicate wrappers |
| `src/queries/useChannelSummariesQuery.ts` | 387 | ⚠️ Has legacy hook |
| `src/queries/useDonorSegmentQuery.ts` | 827 | NEW - Donor filtering |
| `src/hooks/useBackfillStatus.ts` | 471 | NEW - Backfill tracking |
| `src/hooks/useIntegrationHealth.ts` | 103 | NEW - Health monitoring |
| `src/hooks/useAdHierarchy.ts` | 163 | NEW - Ad aggregation |

### New Migrations (Since 2026-01-22)
| Migration | Purpose |
|-----------|---------|
| `20260122184213` | Multi-org membership system |
| `20260122184349` | Session management system |
| `20260123031427` | Standardized `donor_key` hashing |
| `20260124004247` | UTC parameter for all RPCs |
| `20260124230115` | Integration health functions |

### New Edge Functions
| Function | Purpose |
|----------|---------|
| `check-integration-health` | Calculate health scores |
| `reconcile-actblue-data` | Detect data gaps |
| `backfill-daily-metrics` | Admin backfill tool |
| `cancel-backfill` | Cancel running backfill |
| `manage-invitation` | Invitation lifecycle |
| `detect-ad-fatigue` | Ad performance alerts |
| `analyze-creative-motivation` | Motivation insights |

---

*End of Audit Report v2*
