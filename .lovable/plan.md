

# Root Cause: Meta Ad Spend Not Populating on Client Dashboard

## The Problem

The client dashboard shows zero Meta ad spend because it queries the wrong table.

## Data Flow (Current — Broken)

```text
admin-sync-meta (runs every 30 min)
  └─► meta_ad_metrics          ← HAS data through March 10 ✓
  └─► meta_creative_insights   ← HAS data ✓
  └─► meta_campaigns           ← HAS data ✓
  ╳   meta_ad_metrics_daily    ← NOT written to ✗

sync-meta-ads (NOT scheduled — manual only)
  └─► meta_ad_metrics          ← writes here too
  └─► meta_ad_metrics_daily    ← ONLY source for this table
        │
        ▼
meta_fundraising_metrics_daily (VIEW)
  = meta_ad_metrics_daily JOIN meta_campaigns
  WHERE objective IN ('OUTCOME_SALES', 'CONVERSIONS')
        │
        ▼
useDashboardMetricsV2 → fetchChannelSpend()
  └─► queries meta_fundraising_metrics_daily
  └─► Returns $0 spend for any date after Jan 30 ✗
```

**Result**: `meta_ad_metrics_daily` has no data after Jan 30, 2026. Every dashboard metric that depends on Meta spend (ROI, ROAS, total spend, channel breakdown, time series) shows zero.

## Cascading Impact

All of these are broken because they depend on `meta_fundraising_metrics_daily` or `meta_ad_metrics_daily`:
- Hero KPIs: ROI, Total Spend, Attributed ROI all show $0
- Performance chart: Meta spend line is flat at zero
- Channel breakdown: Meta Ads shows 0 donations attributed
- Creative Intelligence: DataFreshnessIndicator queries `meta_ad_metrics_daily`
- KPI drilldowns, channel summaries

## Fix Options

### Option A: Make `admin-sync-meta` also write to `meta_ad_metrics_daily` (Recommended)

Add ad-level insights fetching to the `admin-sync-meta` function — the same logic that `sync-meta-ads` uses (lines 1493-1665). This means the scheduled job populates BOTH tables every 30 minutes.

**Changes:**
1. **`supabase/functions/admin-sync-meta/index.ts`**: After the campaign-level insights loop (line 293), add an ad-level insights fetch per campaign that upserts to `meta_ad_metrics_daily` with the same fields (ad_id, link_clicks, link_ctr, etc.)
2. **Run a one-time backfill**: Invoke `sync-meta-ads` or `backfill-meta-ads` for the gap period (Jan 31 – Mar 10) to fill in the missing data

### Option B: Switch dashboard to query `meta_ad_metrics` instead

Change `fetchChannelSpend()` to query `meta_ad_metrics` (which has current data) instead of `meta_fundraising_metrics_daily`. This is faster to implement but loses the fundraising-only objective filtering and ad-level granularity.

**Changes:**
1. **`src/hooks/useDashboardMetricsV2.ts`** line 73-79: Replace `meta_fundraising_metrics_daily` with `meta_ad_metrics`, adding a JOIN or subquery filter for fundraising objectives
2. Update any other hooks that depend on `meta_ad_metrics_daily`

### Option C: Schedule `sync-meta-ads` alongside `admin-sync-meta`

Add `sync-meta-ads` as a scheduled job. This is the simplest fix but `sync-meta-ads` is a 2000+ line function with heavy API usage that may timeout or hit rate limits when run for all orgs.

## Recommended Approach: Option A + Immediate Backfill

1. Update `admin-sync-meta` to write ad-level data to `meta_ad_metrics_daily`
2. Trigger a backfill for the Jan 31 – Mar 10 gap
3. Dashboard immediately starts showing correct data going forward

This aligns with the existing architecture where `admin-sync-meta` is the scheduled workhorse, and ensures both tables stay in sync.

