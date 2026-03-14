

# Real-Time SMS Revenue on Dashboard

## Problem

The SMS summary card reads `sms_campaigns.amount_raised` which is only updated by batch attribution jobs. Donations arrive in real-time via ActBlue webhooks but the SMS card stays stale.

## Plan

### 1. Hybrid SMS summary: cached + live donations

Update `useChannelSummaries` to supplement `sms_campaigns` data with a live query against `actblue_transactions` for donations matching known SMS refcodes. This way, even before the batch attribution runs, the SMS card shows live revenue.

**Logic:**
- Query `refcode_mappings` where `platform = 'sms'` to get all SMS-attributed refcodes for the org
- Query `actblue_transactions` for donations in the date range matching those refcodes
- Merge: use the higher of `sms_campaigns.amount_raised` vs live-calculated revenue per campaign

### 2. Auto-refresh SMS on ActBlue webhook sync

In `useAutoRefreshOnSync`, add `['sms']` and `['channels']` to the `actblue_webhook` source's query keys so the SMS card also refreshes when new donations arrive.

```
actblue_webhook: [
  ...existing keys,
  ['sms'],       // <-- new
  ['channels'],  // <-- new
]
```

### 3. Handle "unsynced" campaigns

For today's case where the Switchboard campaign hasn't synced yet, show an "unattributed SMS donations" line when there are recent donations matching SMS refcodes that don't correspond to any `sms_campaigns` row. This ensures revenue is visible immediately.

### Files changed

| File | Change |
|------|--------|
| `src/hooks/useChannelSummaries.tsx` | Add live donation query against `actblue_transactions` using SMS refcodes from `refcode_mappings` |
| `src/hooks/useAutoRefreshOnSync.ts` | Add `['sms']` and `['channels']` to `actblue_webhook` source keys |

No database changes needed — all data already exists.

