

# Fix Meta Ads Sync Failures for Abdul & Rashid

## Root Cause Analysis

Both "Abdul For Senate" and "Rashid For Illinois" have been failing since ~Feb 20 with 192 consecutive errors. The error message stored is the generic `"Edge Function returned a non-2xx status code"` — this is **not** the actual error.

**The problem is in the call chain:**
1. `run-scheduled-jobs` → calls `tiered-meta-sync`
2. `tiered-meta-sync` → calls `admin-sync-meta` via `supabase.functions.invoke()`
3. When `admin-sync-meta` returns a non-2xx (400/401/404), `supabase.functions.invoke()` puts a generic error in `syncError` and the **actual error body** (e.g. "Meta API Error: (#100) Missing permissions") is discarded
4. `tiered-meta-sync` stores only the generic message, masking the real issue

**Key facts:**
- Tokens are NOT expired (expire Mar 23 & Mar 29)
- Both use the same Meta user (Mohammed Maraqa)
- Both stopped working on the same day (Feb 20)
- The `last_sync_status` in `client_api_credentials` is `failed`, NOT `api_error` or `token_expired` — meaning `admin-sync-meta` itself is either crashing or its error-specific status updates aren't running

This strongly suggests `admin-sync-meta` is returning a non-2xx status **before** it gets to the Meta API call — likely a **404** from the credentials lookup or a parsing error. Or the Meta API is returning a permissions error that gets returned as 400.

## Fix Plan (2 changes)

### 1. Fix error capture in `tiered-meta-sync` (the critical fix)

When `supabase.functions.invoke()` returns an error, the response body is available in `syncError.context?.body` or by reading the response. Update the error handling to extract the actual error message:

**File:** `supabase/functions/tiered-meta-sync/index.ts` (lines 229-243)

```typescript
// Instead of just throwing syncError.message, extract the actual response body
const { data: syncData, error: syncError } = await supabase.functions.invoke('admin-sync-meta', { ... });

if (syncError) {
  // Try to get actual error from response body
  let actualError = syncError.message;
  try {
    // syncData may contain the error body even when syncError exists
    if (syncData?.error) {
      actualError = syncData.error;
    } else if (typeof syncData === 'string') {
      const parsed = JSON.parse(syncData);
      actualError = parsed.error || actualError;
    }
  } catch {}
  throw new Error(actualError);
}
```

### 2. Store the actual Meta API error in `admin-sync-meta`

When `admin-sync-meta` encounters a Meta API error, it updates `last_sync_status` to `api_error` but does NOT update `last_sync_error` with the actual message. AND the `tiered-meta-sync` caller overwrites this with its own generic error via `update_meta_sync_status`.

**File:** `supabase/functions/admin-sync-meta/index.ts` (lines 186-204)

Update the error path to also store the actual error message in `last_sync_error`:

```typescript
if (campaignsData.error) {
  const errorMsg = `Meta API Error: ${campaignsData.error.message} (code: ${campaignsData.error.code})`;
  await supabase
    .from('client_api_credentials')
    .update({ 
      last_sync_at: new Date().toISOString(), 
      last_sync_status: 'api_error',
      last_sync_error: errorMsg,
      sync_error_count: supabase.rpc ? undefined : undefined // keep existing
    })
    .eq('organization_id', organization_id)
    .eq('platform', 'meta');
  // ... return with actual error in body
}
```

### 3. Reset error counts and trigger manual sync

After deploying the fixes, reset the error counts for both orgs and trigger a manual sync to capture the actual Meta API error:

```sql
UPDATE client_api_credentials 
SET sync_error_count = 0, last_sync_error = NULL
WHERE platform = 'meta' 
AND organization_id IN ('8ba98ab9-e079-4e93-90dc-269cd384e99b', 'd2a7a38c-c60d-4ee1-b8b4-1eb4af6fcfa9');
```

Then invoke `tiered-meta-sync` with each org to get the real error surfaced.

## Summary

| Change | File | Purpose |
|--------|------|---------|
| Better error extraction | `tiered-meta-sync/index.ts` | Capture actual error body instead of generic message |
| Store error details | `admin-sync-meta/index.ts` | Write actual Meta API error to `last_sync_error` |
| Reset + re-trigger | Database migration | Clear stale error counts, re-test sync |

