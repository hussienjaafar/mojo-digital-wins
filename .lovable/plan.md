

# Fix: Meta OAuth Popup Communication Failure

## Root Cause

The edge function logs confirm the OAuth flow **succeeds on the backend** — credentials are stored, 37 ad accounts fetched, token expires May 9. The issue is purely frontend: **the popup cannot communicate back to the parent window**.

When the popup navigates through `facebook.com` and back, modern browsers clear `window.opener` for security (cross-origin navigation). In `MetaOAuthCallback.tsx`, when `window.opener` is null, the popup falls into the redirect-mode fallback and navigates *itself* to the admin page — but the parent window never receives the callback data, so it stays stuck on "Authenticating with Facebook..."

```text
Parent window                          Popup window
─────────────                          ────────────
opens popup ──────────────────────────► /meta-oauth-callback redirect
oauthStep = 'authenticating'           ↓
waiting for postMessage...             facebook.com/dialog/oauth
  ↓                                    ↓ (cross-origin nav clears window.opener)
  ↓                                    /meta-oauth-callback?code=X&state=Y
  ↓                                    window.opener === null ✗
  ↓                                    falls into redirect fallback
  ↓                                    navigates popup to /admin (wrong!)
  ↓
  spinner forever ✗
```

## Fix: Use `localStorage` as Cross-Window Communication Fallback

This is the standard pattern for OAuth popup flows when `window.opener` is lost.

### 1. `src/pages/MetaOAuthCallback.tsx`
After attempting `postMessage`, ALSO write to `localStorage` as a fallback:
```typescript
// Always write to localStorage as fallback
localStorage.setItem('meta_oauth_result', JSON.stringify({ code, state, timestamp: Date.now() }));

if (window.opener) {
  // Try postMessage (may work in some browsers)
  window.opener.postMessage({ type: 'META_OAUTH_CALLBACK', code, state }, window.location.origin);
}

setStatus('success');
setTimeout(() => window.close(), 1500);
```

Remove the `else` branch that redirects the popup to the admin page — it serves no purpose and creates confusion.

### 2. `src/components/admin/integrations/MetaCredentialAuth.tsx`
Add a `storage` event listener alongside the existing `message` listener:
```typescript
useEffect(() => {
  const handleStorage = (e: StorageEvent) => {
    if (e.key === 'meta_oauth_result' && e.newValue) {
      const { code, state } = JSON.parse(e.newValue);
      localStorage.removeItem('meta_oauth_result');
      handleOAuthCallback(code, state);
    }
  };
  window.addEventListener('storage', handleStorage);
  return () => window.removeEventListener('storage', handleStorage);
}, [organizationId]);
```

Also add a polling fallback (storage events only fire in *other* tabs, not the same tab that wrote the value — but since this is a popup→parent scenario, it should fire; still, add a poll as safety):
```typescript
// Inside handleStartOAuth, after window.open:
const pollInterval = setInterval(() => {
  const result = localStorage.getItem('meta_oauth_result');
  if (result) {
    clearInterval(pollInterval);
    const { code, state } = JSON.parse(result);
    localStorage.removeItem('meta_oauth_result');
    handleOAuthCallback(code, state);
  }
}, 500);

// Clear after 5 minutes
setTimeout(() => clearInterval(pollInterval), 5 * 60 * 1000);
```

### 3. Add a timeout with user guidance
If stuck for 30+ seconds, show a message with a manual retry option instead of spinning forever.

## Summary
Two files changed, no backend changes needed. The credentials are already being stored successfully — this fix just ensures the frontend learns about it.

