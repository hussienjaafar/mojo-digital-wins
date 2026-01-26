
# Add Search Function & Update Meta OAuth Redirect URI

## Overview

Two changes are needed:
1. **Code Change**: Add search/filter functionality to the ad account selection list
2. **Configuration Change**: Add the new portal URL to Meta's allowed redirect URIs

---

## Part 1: Add Search Filter to Ad Account Selection

### Components to Update

Both components that display the ad account list need a search input:

| Component | Location | Selection Type |
|-----------|----------|----------------|
| `MetaAuthOptions.tsx` | Onboarding wizard | Multi-select (checkboxes) |
| `MetaCredentialAuth.tsx` | Admin Integration Center | Single-select |

### Implementation

Add a search input above the account list that filters by:
- Account name
- Account ID
- Business name

```text
+------------------------------------------+
|  Select Ad Account(s)                    |
|  +------------------------------------+  |
|  | 🔍 Search accounts...              |  |  <-- NEW
|  +------------------------------------+  |
|                                          |
|  [x] MPAC Ads                   Active   |
|      ID: 112517... MPAC USD              |
|                                          |
|  [ ] Nancy Jaafar...            Active   |
|      ID: 293864... Evolution LLC USD     |
+------------------------------------------+
```

### Code Changes

**1. MetaAuthOptions.tsx**

Add search state and filter logic:

```typescript
// Add state for search
const [accountSearch, setAccountSearch] = useState('');

// Filter accounts based on search
const filteredAccounts = useMemo(() => {
  if (!accountSearch.trim()) return adAccounts;
  const search = accountSearch.toLowerCase();
  return adAccounts.filter(account => 
    account.name.toLowerCase().includes(search) ||
    account.account_id.toLowerCase().includes(search) ||
    (account.business_name?.toLowerCase().includes(search) ?? false)
  );
}, [adAccounts, accountSearch]);
```

Add search input above the list:

```typescript
<div className="space-y-2">
  <Label>Select Ad Account(s)</Label>
  {adAccounts.length > 3 && (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Search accounts..."
        value={accountSearch}
        onChange={(e) => setAccountSearch(e.target.value)}
        className="pl-9"
      />
    </div>
  )}
  <div className="space-y-2 max-h-64 overflow-y-auto">
    {filteredAccounts.map((account) => (
      // ... existing account card
    ))}
    {filteredAccounts.length === 0 && accountSearch && (
      <p className="text-sm text-muted-foreground text-center py-4">
        No accounts match "{accountSearch}"
      </p>
    )}
  </div>
</div>
```

**2. MetaCredentialAuth.tsx**

Same pattern - add search state, filter logic, and search input.

---

## Part 2: Update Meta OAuth Redirect URI

### The Issue

The application now runs on `portal.molitico.com`, so the OAuth callback URL is:

```
https://portal.molitico.com/meta-oauth-callback
```

This URL must be added to the Meta App's **Valid OAuth Redirect URIs** list.

### How to Update (Manual Step)

You need to update the Meta App settings in the Facebook Developer Portal:

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Select your app (the one used for Meta Ads integration)
3. Navigate to **App Settings** → **Basic** (or **Facebook Login** → **Settings**)
4. Find **Valid OAuth Redirect URIs**
5. Add the following URI:
   ```
   https://portal.molitico.com/meta-oauth-callback
   ```
6. Keep existing URIs (for preview/development):
   - `https://mojo-digital-wins.lovable.app/meta-oauth-callback` (if exists)
   - Any preview URLs
7. Save changes

### Current Code Behavior

The redirect URI is built dynamically:
```typescript
const redirectUri = `${window.location.origin}/meta-oauth-callback`;
```

This correctly produces:
- Development: `https://<preview-id>.lovable.app/meta-oauth-callback`
- Production: `https://portal.molitico.com/meta-oauth-callback`

No code changes needed for the URI - just the Meta App configuration.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/integrations/MetaAuthOptions.tsx` | Add `accountSearch` state, `filteredAccounts` memo, search input UI |
| `src/components/admin/integrations/MetaCredentialAuth.tsx` | Same pattern as above |

## Imports to Add

```typescript
import { Search } from 'lucide-react';
import { useMemo } from 'react';
```

---

## Summary

| Task | Type | Action |
|------|------|--------|
| Search filter for ad accounts | Code | Add to both Meta components |
| Portal redirect URI | Config | Add `https://portal.molitico.com/meta-oauth-callback` to Meta App settings |

After implementation, users will be able to quickly find their ad account by typing in the search box, and the OAuth flow will work correctly on the portal domain.
