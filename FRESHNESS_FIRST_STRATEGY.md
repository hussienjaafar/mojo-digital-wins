# Freshness-First Data Ingestion Strategy

This document summarizes the unified data freshness strategy implemented for all data sources in this application.

## Overview

All three data sources (Meta Marketing API, ActBlue, Switchboard) now have:
1. **Clear freshness SLAs** defined in the database
2. **Automated tracking** via the `data_freshness` table
3. **Unified UI indicators** showing data currency
4. **Optimized sync schedules** meeting freshness targets

---

## Freshness SLAs by Source

| Source | Target Freshness | Sync Strategy | Schedule |
|--------|------------------|---------------|----------|
| **Meta Marketing API** | ≤24 hours | Incremental (last 7 days) | Every 4 hours |
| **ActBlue Webhook** | ≤1 hour (near real-time) | Real-time webhook ingestion | Immediate |
| **ActBlue CSV** | ≤24 hours (reconciliation) | 3-day lookback incremental | Every 6 hours |
| **Switchboard SMS** | ≤4 hours | Full paginated sync | Every hour |

---

## Implementation Details

### 1. Meta Marketing API

**Changes Made:**
- Date range optimized to **last 7 days** for scheduled syncs (previously 30 days)
- Added `time_increment=1` for daily granularity
- Freshness tracking now records `latest_data_date` and `data_lag_days`
- Sync schedule: `0 */4 * * *` (every 4 hours)

**Data Flow:**
```
Scheduled Job → admin-sync-meta → Meta Graph API
                      ↓
              meta_ad_metrics table
                      ↓
              data_freshness table (updated via RPC)
```

### 2. ActBlue

**Webhook Ingestion (Primary):**
- Real-time webhooks processed immediately
- Idempotent upsert via `lineitem_id`
- Freshness tracked per-organization
- Attribution touchpoints tracked automatically

**CSV Reconciliation (Backup):**
- Runs every 6 hours with 3-day lookback
- Catches missed webhooks and updates
- Handles ActBlue's payment processing delay
- Schedule: `0 */6 * * *`

**Data Flow:**
```
ActBlue → actblue-webhook → actblue_transactions
                 ↓
         data_freshness (source: 'actblue_webhook')

ActBlue → sync-actblue-csv → actblue_transactions
                 ↓
         data_freshness (source: 'actblue_csv')
```

### 3. Switchboard/OneSwitchboard

**Changes Made:**
- Sync frequency increased from every 12 hours to **every hour**
- Full paginated sync of all broadcasts
- Freshness tracking with latest broadcast date
- Schedule: `0 * * * *` (hourly)

**Data Flow:**
```
Scheduled Job → sync-switchboard-sms → Switchboard API
                       ↓
               sms_campaigns table
                       ↓
               data_freshness table
```

---

## Data Freshness Tracking

### Database Schema

**`data_freshness` table:**
```sql
source              -- 'meta', 'actblue_webhook', 'actblue_csv', 'switchboard'
scope               -- 'global' or organization_id
organization_id     -- FK to client_organizations
last_synced_at      -- When sync last ran
last_sync_status    -- 'success', 'error', 'pending'
latest_data_timestamp -- Latest date of actual data
data_lag_hours      -- Calculated lag
freshness_sla_hours -- Target SLA
is_within_sla       -- Boolean flag
sla_breach_count    -- Consecutive breaches
```

**`freshness_sla_config` table:**
```sql
source                  -- Data source name
target_freshness_hours  -- SLA in hours
sync_interval_minutes   -- How often to sync
description             -- Human-readable description
```

### Updating Freshness

All sync functions call the `update_data_freshness` RPC:

```typescript
await supabase.rpc('update_data_freshness', {
  p_source: 'meta',
  p_organization_id: organization_id,
  p_latest_data_timestamp: latestDataDate,
  p_sync_status: 'success',
  p_error: null,
  p_records_synced: recordCount,
  p_duration_ms: durationMs,
});
```

---

## UI Components

### DataFreshnessIndicator

Located at: `src/components/client/DataFreshnessIndicator.tsx`

Features:
- Shows freshness status for each source
- Color-coded badges (green/yellow/red)
- Compact mode for headers
- Full mode for settings pages
- Real-time updates via Supabase subscription

### useDataFreshness Hook

Located at: `src/hooks/useDataFreshness.tsx`

Provides:
- `records` - All freshness records
- `overallHealth` - 'healthy' | 'warning' | 'critical'
- `staleCount` - Number of stale sources
- `refresh()` - Manual refresh function

---

## Debugging Stale Data

### Step 1: Check Freshness Status

```sql
SELECT * FROM data_freshness_summary 
WHERE organization_id = 'your-org-id' 
ORDER BY source;
```

### Step 2: Check Sync Logs

```sql
-- Recent job executions
SELECT j.job_name, je.started_at, je.status, je.error_message
FROM job_executions je
JOIN scheduled_jobs j ON j.id = je.job_id
WHERE j.job_type IN ('sync_meta_ads', 'sync_actblue_csv', 'sync_switchboard_sms')
ORDER BY je.started_at DESC
LIMIT 20;
```

### Step 3: Check API Credentials

```sql
SELECT platform, last_sync_at, last_sync_status, is_active
FROM client_api_credentials
WHERE organization_id = 'your-org-id';
```

### Step 4: Verify Scheduled Jobs

```sql
SELECT job_name, job_type, schedule, is_active, last_run_at, last_run_status
FROM scheduled_jobs
WHERE job_type IN ('sync_meta_ads', 'sync_actblue_csv', 'sync_switchboard_sms');
```

---

## Reliability Features

### Retry Logic
- All sync functions have built-in error handling
- Failed syncs update `last_sync_status = 'error'`
- Jobs continue to next organization on failure

### Rate Limiting
- Meta: Respects Graph API rate limits
- ActBlue: 10s polling delay for CSV generation
- Switchboard: 50-page safety limit

### Idempotent Writes
- All syncs use upsert patterns
- Duplicate detection via unique constraints
- Existing records updated only if changed

---

## Monitoring Checklist

1. ✅ All scheduled jobs are `is_active = true`
2. ✅ `data_freshness.is_within_sla = true` for all sources
3. ✅ No jobs stuck in `last_run_status = 'running'`
4. ✅ ActBlue webhooks receiving events (check `webhook_logs`)
5. ✅ API credentials are valid (`is_active = true`)

---

## Future Improvements

1. **Alerting**: Trigger alerts when `sla_breach_count > 2`
2. **Backoff**: Implement exponential backoff for failed syncs
3. **Parallel Sync**: Process multiple orgs concurrently
4. **Streaming**: Explore Switchboard webhook support
5. **Caching**: Add Redis cache layer for dashboard queries

---

*Last Updated: 2025-12-06*
