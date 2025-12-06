# Meta Ads Data Freshness - Debug Report

## Issue Summary
Client dashboards were showing Meta Ads data that was ~1 week old instead of current data (within 24 hours).

## Root Cause Analysis

### Problem 1: Default Date Range Too Aggressive
The `admin-sync-meta` edge function was defaulting to a **30-day range** when no dates were specified. While this seems comprehensive, it led to several issues:
- Meta API may return truncated results for large date ranges
- No prioritization of recent data
- Older data was being re-fetched unnecessarily

### Problem 2: Missing `time_increment=1` Parameter
**CRITICAL BUG FOUND**: The Meta Graph API `insights` endpoint was being called WITHOUT the `time_increment=1` parameter. Without this parameter, Meta returns **aggregated** data for the entire date range instead of **daily breakdowns**.

Before:
```javascript
const insightsUrl = `...time_range={"since":"${since}","until":"${until}"}&access_token=...`
```

After:
```javascript  
const insightsUrl = `...time_range={"since":"${since}","until":"${until}"}&time_increment=1&access_token=...`
```

### Problem 3: Sync Frequency Too Low
The scheduled jobs were running Meta sync every **8 hours**. Given Meta's normal 24-48h processing delay, this meant:
- Syncs were often hitting the same stale data window
- Fresh data available in Meta wasn't being fetched promptly

### Problem 4: Insufficient Logging
The previous implementation lacked detailed logging of:
- Actual date ranges returned by Meta
- Per-campaign data availability
- Data freshness metrics

## Fixes Implemented

### 1. Updated `admin-sync-meta` Edge Function
- **Changed default date range**: Now uses last 7 days for scheduled syncs (focused on fresh data)
- **Added `time_increment=1`**: Ensures daily granularity for all insights requests
- **Added comprehensive logging**: Tracks per-campaign data ranges and freshness
- **Added data freshness metrics in response**: Returns `latest_data_date`, `data_lag_days`, and `lag_reason`

### 2. Updated Sync Schedule
- **Increased frequency**: From every 8 hours → every 4 hours
- Both `Sync Meta Ads` and `Sync Meta Ads Data` jobs now run at `0 */4 * * *`

### 3. Enhanced Frontend Indicator
- `MetaDataFreshnessIndicator` component now shows:
  - Latest data date
  - Data lag in days
  - Reason for any lag
  - Manual sync trigger with detailed results

## Verification Results

### Before Fix
```
Latest data date: 2025-12-02
Data lag: 4 days
```

### After Fix
```
Latest data date: 2025-12-06 (today)
Data lag: 0 days
Reason: "Data is current (within normal Meta 24h processing delay)"
Metrics stored: 8 new records
```

### Database Confirmation
```sql
SELECT date, COUNT(*), SUM(spend) FROM meta_ad_metrics 
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY date ORDER BY date DESC;

-- Results after fix:
-- 2025-12-06: 1 record, $99.05 spend (TODAY!)
-- 2025-12-05: 1 record, $245.70 spend
-- 2025-12-04: 1 record, $240.90 spend
-- 2025-12-03: 1 record, $218.79 spend
-- ...
```

## Technical Details

### Meta API Insights Endpoint
```
GET /v22.0/{campaign_id}/insights
?fields=impressions,clicks,spend,reach,actions,action_values,cpc,cpm,ctr
&time_range={"since":"2025-11-29","until":"2025-12-06"}
&time_increment=1  ← CRITICAL: Returns per-day data
&access_token=...
```

### Sync Schedule (Cron)
```
0 */4 * * *   # Every 4 hours (00:00, 04:00, 08:00, 12:00, 16:00, 20:00)
```

## Guarantees Going Forward

1. **Data Freshness**: Dashboard data will be no more than 24-48 hours old (within Meta's normal processing delay)
2. **Sync Frequency**: Automatic syncs every 4 hours
3. **Visibility**: Users can see exact data freshness in the `MetaDataFreshnessIndicator`
4. **Manual Override**: Users can trigger immediate sync if needed

## Files Changed
- `supabase/functions/admin-sync-meta/index.ts` - Complete rewrite with fixes
- `src/components/client/MetaDataFreshnessIndicator.tsx` - Fixed duplicate imports
- Database: Updated `scheduled_jobs` table to increase sync frequency

## Future Recommendations

1. **Add Backfill Mode**: For new organizations, run initial sync with `mode: 'backfill'` to get historical data
2. **Token Expiry Alerts**: The function now logs token expiry warnings - consider surfacing these to admins
3. **Per-Organization Scheduling**: Allow different sync frequencies per organization based on ad spend/activity
