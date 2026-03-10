

# Fix: sync-meta-ads Fails Because ad_account_id Is Missing

## Problem
The `encrypted_credentials` for this org has `ad_accounts` (array of 37 accounts) and `access_token`, but no `ad_account_id` field. The `sync-meta-ads` function reads `credentials.ad_account_id` (line 389) and gets `undefined`, causing `Object with ID 'undefined'` error.

## Root Cause
The `meta-oauth-callback` edge function stores the token and full ad accounts list but does not store a selected `ad_account_id`. The frontend fix to persist the selection in `handleSelectAccount` requires the user to re-connect and re-select — which hasn't happened.

## Fix (Two Parts)

### 1. Edge Function: Add fallback in `sync-meta-ads` (lines 385-393)
When `ad_account_id` is missing, fall back to the first account in the `ad_accounts` array:

```typescript
const credentials = credData.encrypted_credentials as unknown as MetaCredentials;
const { access_token } = credentials;

// Resolve ad_account_id: direct field, or fallback to first in ad_accounts list
let ad_account_id = credentials.ad_account_id 
  || (credentials as any).ad_accounts?.[0]?.account_id;

if (!ad_account_id) {
  throw new Error('No ad_account_id configured. Please re-connect Meta and select an ad account.');
}

if (!ad_account_id.startsWith('act_')) {
  ad_account_id = `act_${ad_account_id}`;
}
```

### 2. Edge Function: Also fix `meta-oauth-callback` to persist `ad_account_id` when there's only one account
If the OAuth returns exactly 1 ad account, auto-set it as the `ad_account_id` in the DB so sync works immediately.

This is a two-file edge function update. No frontend changes needed.

