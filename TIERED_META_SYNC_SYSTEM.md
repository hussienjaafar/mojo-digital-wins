# Tiered Meta Marketing API Sync System

## Overview

This document describes the configurable, tiered sync priority system for Meta Marketing API data ingestion. The system allows per-client sync frequency configuration while maintaining API efficiency and rate limit safety.

## Sync Priority Tiers

| Tier   | Sync Frequency | Date Range | Use Case |
|--------|----------------|------------|----------|
| HIGH   | Every 1 hour   | Last 2 days | Active campaigns, critical clients |
| MEDIUM | Every 2 hours  | Last 3 days | Standard clients (default) |
| LOW    | Every 4 hours  | Last 7 days | Inactive or low-priority accounts |

## Architecture

### Database Schema

#### `client_api_credentials` (Extended)
New columns added:
- `meta_sync_priority`: TEXT ('high', 'medium', 'low') - default 'medium'
- `last_meta_sync_at`: TIMESTAMPTZ - when sync last completed
- `latest_meta_data_date`: DATE - most recent data date from Meta
- `sync_error_count`: INTEGER - consecutive error count
- `last_sync_error`: TEXT - last error message
- `rate_limit_backoff_until`: TIMESTAMPTZ - rate limit backoff expiry

#### `meta_sync_config`
Centralized tier configuration:
- `tier`: TEXT (high/medium/low)
- `interval_minutes`: INTEGER
- `date_range_days`: INTEGER
- `description`: TEXT

### Edge Functions

#### `tiered-meta-sync`
The main scheduler function that:
1. Runs every 15 minutes
2. Queries accounts due for sync based on priority tier
3. Syncs HIGH priority first, then MEDIUM, then LOW
4. Respects rate limits and backs off when needed
5. Skips lower-priority accounts if rate limited

#### `admin-sync-meta`
The actual Meta API sync function (unchanged behavior, now called by tiered scheduler).

### Database Functions

#### `get_meta_accounts_due_for_sync(p_limit INTEGER)`
Returns accounts that need syncing, ordered by:
1. Priority tier (HIGH first)
2. How overdue they are

#### `update_meta_sync_status(...)`
Updates sync status after completion, handling:
- Success timestamps
- Error tracking
- Rate limit backoff

## Admin UI

### MetaSyncPriorityManager Component
Located at: `src/components/admin/MetaSyncPriorityManager.tsx`

Features:
- View all Meta integrations with sync status
- Change priority tier per organization
- Trigger manual sync for any account
- Run tiered sync scheduler manually
- View error summary and rate limit status

## Scheduling

The scheduler (`run-scheduled-jobs`) now runs every 15 minutes and invokes `tiered-meta-sync` which intelligently decides which accounts to sync.

**Cron expression**: `*/15 * * * *`

## Rate Limit Handling

When a 429 (rate limit) is detected:
1. Mark the account with `rate_limit_backoff_until` = now + 15 minutes
2. Skip remaining lower-priority accounts in current run
3. HIGH priority accounts still attempted (may fail gracefully)

## Debugging

### Check sync status
```sql
SELECT * FROM meta_sync_status ORDER BY sync_due DESC, minutes_until_sync;
```

### Check which accounts are due
```sql
SELECT * FROM get_meta_accounts_due_for_sync(10);
```

### Check sync config
```sql
SELECT * FROM meta_sync_config;
```

### View recent sync errors
```sql
SELECT organization_name, meta_sync_priority, sync_error_count, last_sync_error
FROM meta_sync_status
WHERE sync_error_count > 0;
```

## Adjusting Tier Configuration

To change sync intervals globally:

```sql
UPDATE meta_sync_config 
SET interval_minutes = 45, date_range_days = 2 
WHERE tier = 'high';
```

## Upgrading a Client to HIGH Priority

Via Admin UI: Use the MetaSyncPriorityManager component.

Via SQL:
```sql
UPDATE client_api_credentials 
SET meta_sync_priority = 'high' 
WHERE organization_id = 'YOUR_ORG_ID' AND platform = 'meta';
```

## Monitoring

The system provides visibility through:
1. `meta_sync_status` view - real-time sync status
2. `data_freshness` table - unified freshness tracking
3. Admin UI component - visual management interface
4. Edge function logs - detailed sync logs

## Best Practices

1. **Default to MEDIUM**: Most clients should be on MEDIUM tier
2. **Use HIGH sparingly**: Only for clients with active campaigns needing real-time data
3. **Monitor errors**: Accounts with 3+ consecutive errors should be investigated
4. **Check rate limits**: If many accounts show rate limit backoff, reduce HIGH tier usage
