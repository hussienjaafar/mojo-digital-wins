

# Fix: Meta Sync Uses Wrong Ad Account + Missing Date Range

## Problem Summary

Two issues causing the sync to return 0 data:

1. **Wrong ad account**: Org `d2a7a38c-c60d-4ee1-b8b4-1eb4af6fcfa9` has `ad_account_id: null` in the DB. The fallback picks the first account "All United" (`949896734145840`) which has **zero campaigns**. The correct account is **"Rashid for Illinois"** (`980883329227483`).

2. **Date range too narrow**: The logs show `Using requested dates: 2026-03-10 to 2026-03-10` — only today. Some callers (ClientHealthOverview, CreativeIntelligenceDashboard) don't pass dates, which should trigger the 30-day default, but the sync that ran used today-only dates.

## Fix (3 parts)

### 1. Edge function: Better fallback when multiple accounts exist
**File: `supabase/functions/sync-meta-ads/index.ts`** (~line 388)

When `ad_account_id` is null and there are multiple accounts in `ad_accounts`, return a clear error instead of blindly picking the first one:
```typescript
let ad_account_id = credentials.ad_account_id;

if (!ad_account_id) {
  const accounts = (credentials as any).ad_accounts;
  if (accounts?.length === 1) {
    ad_account_id = accounts[0].account_id;
  } else if (accounts?.length > 1) {
    throw new Error(`Multiple ad accounts available (${accounts.length}). Please select one in Settings > Integrations.`);
  } else {
    throw new Error('No ad_account_id configured. Please re-connect Meta.');
  }
}
```

### 2. Frontend: Show account selection when connected but no account selected
**File: `src/components/admin/integrations/MetaCredentialAuth.tsx`**

On mount, check if credentials exist in DB but `ad_account_id` is null. If so, auto-populate the account selection UI from the stored `ad_accounts` array so the user can select the right one without re-authenticating.

### 3. Frontend callers: Ensure proper date ranges
**Files: `src/components/admin/ClientHealthOverview.tsx`, `src/components/creative-intelligence/CreativeIntelligenceDashboard.tsx`**

Add a default 30-day `start_date` when invoking `sync-meta-ads` without dates, matching what `SyncControls.tsx` already does:
```typescript
body: { 
  organization_id: orgId,
  start_date: new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0],
  end_date: new Date().toISOString().split('T')[0]
}
```

## Result
After this fix, the user will see a prompt to select "Rashid for Illinois" from the 37 accounts. Once selected, it persists to the DB and all future syncs use the correct account with proper date ranges.

