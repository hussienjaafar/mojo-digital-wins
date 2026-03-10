

# Fix: Meta OAuth Spinner Stuck After Successful Auth

## Root Cause

Field name mismatch between the `meta-oauth-callback` edge function response and `MetaCredentialAuth.tsx`:

| Edge function returns | Component expects (line 99-101) |
|---|---|
| `data.accessToken` | `data.access_token` |
| `data.metaUser` | `data.user` |

Because `data.access_token` is always `undefined`, the `if` block on line 99 never executes. The `oauthStep` stays `'authenticating'` and the spinner runs forever.

## Fix

**File: `src/components/admin/integrations/MetaCredentialAuth.tsx`** lines 99-101

Change:
```typescript
if (data.access_token) {
  setAccessToken(data.access_token);
  setMetaUserInfo(data.user);
```

To:
```typescript
if (data.accessToken) {
  setAccessToken(data.accessToken);
  setMetaUserInfo(data.metaUser);
```

One-line property name fix. Everything else in the flow is correct.

