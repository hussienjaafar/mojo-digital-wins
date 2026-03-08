

# Implement Meta Sync Error Fix (Previously Approved)

The approved plan was not yet executed. Here are the three changes to implement:

## 1. Fix error capture in `tiered-meta-sync/index.ts` (lines 241-243)

Replace the generic error throw with logic that extracts the actual error from `syncData`:

```typescript
if (syncError) {
  let actualError = syncError.message || 'Sync function failed';
  try {
    if (syncData && typeof syncData === 'object' && syncData.error) {
      actualError = syncData.error;
    } else if (typeof syncData === 'string') {
      const parsed = JSON.parse(syncData);
      actualError = parsed.error || actualError;
    }
  } catch {}
  throw new Error(actualError);
}
```

## 2. Store actual error in `admin-sync-meta/index.ts` (lines 189-193)

Update the `client_api_credentials` update to include `last_sync_error`:

```typescript
.update({ 
  last_sync_at: new Date().toISOString(), 
  last_sync_status: 'api_error',
  last_sync_error: `Meta API Error: ${campaignsData.error.message} (code: ${campaignsData.error.code})`
})
```

## 3. Database: Reset error counts for Abdul & Rashid

```sql
UPDATE client_api_credentials 
SET sync_error_count = 0, last_sync_error = NULL
WHERE platform = 'meta' 
AND organization_id IN (
  '8ba98ab9-e079-4e93-90dc-269cd384e99b',
  'd2a7a38c-c60d-4ee1-b8b4-1eb4af6fcfa9'
);
```

| File | Change |
|------|--------|
| `supabase/functions/tiered-meta-sync/index.ts` | Extract actual error body from syncData |
| `supabase/functions/admin-sync-meta/index.ts` | Store error detail in `last_sync_error` |
| Database migration | Reset error counts for 2 orgs |

