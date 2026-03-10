

# Fix: Meta OAuth Missing `redirectUri` in Admin Panel

## The Bug

Two different components handle Meta OAuth:
- `MetaOAuthFlow.tsx` (onboarding wizard) — works correctly, passes `redirectUri`
- `MetaCredentialAuth.tsx` (admin org detail page) — **broken**, omits `redirectUri`

The popup shows "Connected successfully!" because that's just the Meta redirect landing page. The actual token exchange happens in the parent window and fails silently with a 400 error.

## Fix

**File: `src/components/admin/integrations/MetaCredentialAuth.tsx`** (line 93-94)

Change:
```typescript
const { data, error } = await supabase.functions.invoke('meta-oauth-callback', {
  body: { code, state, organizationId }
});
```

To:
```typescript
const { data, error } = await supabase.functions.invoke('meta-oauth-callback', {
  body: { code, state, redirectUri: `${window.location.origin}/meta-oauth-callback` }
});
```

This is a one-line fix. The `organizationId` is already encoded in the `state` parameter (base64-encoded JSON), so the edge function doesn't need it separately — but it does need `redirectUri` to match what was sent to Meta during the initial OAuth request.

## Build Errors

The existing build errors (`Cannot find name 'global'`, `Cannot find name 'process'`, `Cannot find namespace 'NodeJS'`) are pre-existing test/tooling type issues unrelated to this fix. They require adding `@types/node` to devDependencies and updating `tsconfig.json` — separate from this OAuth bug.

