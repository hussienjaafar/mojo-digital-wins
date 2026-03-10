

# Fix: Meta Sync Fails — `ad_account_id` Not Saved to Database

## Problem

The edge function logs show the exact error:
```
Meta API Error: Object with ID 'undefined' does not exist
```

The `sync-meta-ads` function reads `credentials.ad_account_id` from the database, but it's **never stored there**.

### What happens today:

1. **OAuth callback** stores credentials in DB with `ad_accounts` (full list) but **no `ad_account_id`**
2. User selects an ad account in the UI → `handleSelectAccount()` calls `onSuccess()` which updates **form state only**
3. The user would need to click a separate "Save" button to persist this to the DB — but the flow doesn't make this obvious
4. **Result**: DB credentials have no `ad_account_id`, sync calls fail

## Fix

**File: `src/components/admin/integrations/MetaCredentialAuth.tsx`** — `handleSelectAccount()` (line 213)

When the user selects an ad account, **immediately update the database** to merge `ad_account_id` into the existing stored credentials:

```typescript
const handleSelectAccount = async () => {
  if (!selectedAccountId || !accessToken) return;
  const account = adAccounts.find(a => a.id === selectedAccountId);
  if (!account) return;

  // Update DB directly — merge ad_account_id into existing credentials
  const { data: existing } = await supabase
    .from('client_api_credentials')
    .select('encrypted_credentials')
    .eq('organization_id', organizationId)
    .eq('platform', 'meta')
    .single();

  const existingCreds = (existing?.encrypted_credentials as Record<string, any>) || {};
  
  await supabase
    .from('client_api_credentials')
    .upsert({
      organization_id: organizationId,
      platform: 'meta',
      encrypted_credentials: {
        ...existingCreds,
        ad_account_id: account.account_id,
        business_manager_id: account.business_name || existingCreds.business_manager_id,
      },
      is_active: true,
    }, { onConflict: 'organization_id,platform' });

  // Still call onSuccess for form state
  onSuccess({
    access_token: accessToken,
    ad_account_id: account.account_id,
    business_manager_id: account.business_name || undefined,
  });

  toast.success(`Connected to ${account.name}`);
  setOauthStep('idle');
};
```

This is a single function change. The sync will immediately work after selecting an ad account.

