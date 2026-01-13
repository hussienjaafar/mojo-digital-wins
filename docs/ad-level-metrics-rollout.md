# Ad-Level Metrics Migration & Rollout Plan

## Overview

This document describes the migration from campaign-level to ad-level ROAS tracking for the `/client/ad-performance` page.

## Changes Made

### 1. Database Schema
- **New table**: `meta_ad_metrics_daily`
  - Stores daily metrics per `ad_id` (not campaign-level aggregates)
  - Unique constraint: `(organization_id, ad_account_id, date, ad_id)`
  - Includes `creative_id` for cross-reference with creative data

### 2. Edge Function (`sync-meta-ads`)
- Added ad-level insights fetch using `level=ad` parameter
- Stores daily metrics for each ad with:
  - Spend, impressions, clicks, reach
  - Meta's `purchase_roas` (matches Ads Manager)
  - Quality rankings

### 3. React Hook (`useAdPerformanceQuery`)
- **Primary path**: Uses `meta_ad_metrics_daily` for TRUE ad-level ROAS
- **Fallback path**: Campaign-level distribution (backward compatible)
- Automatically selects based on data availability

## Deployment Steps

### Step 1: Deploy Migration
```bash
# Apply the migration
supabase migration up

# Or via Supabase dashboard:
# Run: supabase/migrations/20260113000001_ad_level_metrics_daily.sql
```

### Step 2: Deploy Edge Function
```bash
# Deploy the updated sync-meta-ads function
supabase functions deploy sync-meta-ads
```

### Step 3: Deploy Frontend
```bash
# Standard deployment process
npm run build
# Deploy to hosting
```

## Backfill Strategy

### Option A: Per-Organization Backfill (Recommended)
Trigger a sync for each organization with a 90-day date range:

```typescript
// In admin UI or via API
const response = await fetch('/api/sync-meta-ads', {
  method: 'POST',
  body: JSON.stringify({
    organization_id: 'ORG_ID',
    start_date: '2024-10-01', // 90 days ago
    end_date: '2025-01-13',   // Today
    mode: 'backfill'
  })
});
```

### Option B: Scheduled Backfill
Add to cron jobs:
```sql
-- Run for each active organization
SELECT invoke_sync_meta_ads(
  organization_id,
  (CURRENT_DATE - INTERVAL '90 days')::date,
  CURRENT_DATE
)
FROM client_api_credentials
WHERE platform = 'meta' AND is_active = true;
```

### Option C: Manual SQL Backfill (If Needed)
If the Meta API rate limits are an issue, you can request historical exports from Meta and bulk insert:
```sql
-- Example bulk insert structure
INSERT INTO meta_ad_metrics_daily (
  organization_id, ad_account_id, date, ad_id, campaign_id,
  spend, impressions, clicks
)
SELECT
  'org-id', 'account-id', date, ad_id, campaign_id,
  spend, impressions, clicks
FROM staging_table
ON CONFLICT (organization_id, ad_account_id, date, ad_id)
DO UPDATE SET
  spend = EXCLUDED.spend,
  impressions = EXCLUDED.impressions,
  clicks = EXCLUDED.clicks,
  synced_at = NOW();
```

## Handling Organizations Without Ad-Level Data

The hook automatically falls back to campaign-level distribution if no data exists in `meta_ad_metrics_daily`. No UI changes needed - it just works.

### Optional: Add UI Indicator
If you want to show users when they're seeing estimated vs actual ROAS:

```tsx
// In AdPerformance page
const { data } = useAdPerformanceQuery({ ... });
const isUsingAdLevelData = /* check log output or add return field */;

{!isUsingAdLevelData && (
  <Alert>
    <Info className="h-4 w-4" />
    <AlertDescription>
      ROAS values are estimated based on campaign-level data.
      Sync your account to get accurate ad-level metrics.
    </AlertDescription>
  </Alert>
)}
```

## Verification

Run the verification queries after deployment:
```bash
psql $DATABASE_URL -f scripts/verify-ad-metrics.sql
```

Key checks:
1. ✓ `meta_ad_metrics_daily` has rows
2. ✓ Ad IDs are populated (should be 100%)
3. ✓ Spend totals roughly match campaign-level totals
4. ✓ Recent dates have data (check for sync freshness)

## Rollback Plan

If issues arise:
1. The hook automatically falls back to campaign-level data
2. No user-facing impact if `meta_ad_metrics_daily` is empty
3. To fully rollback:
   ```sql
   DROP TABLE IF EXISTS meta_ad_metrics_daily;
   ```

## Monitoring

Watch for:
- Edge function errors in Supabase logs
- `[AD-LEVEL METRICS]` log entries
- Hook debug logs: `[AdPerformance] Using ad-level metrics path` vs `Falling back to campaign-level`

## Timeline

| Phase | Duration | Description |
|-------|----------|-------------|
| 1. Deploy | 1 day | Migration, edge function, frontend |
| 2. Backfill | 2-3 days | Sync last 90 days for all orgs |
| 3. Monitor | Ongoing | Watch logs, verify accuracy |
| 4. Cleanup | After 30 days | Consider removing fallback code |
