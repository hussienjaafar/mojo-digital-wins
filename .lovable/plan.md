
# Fix: Portal Not Loading - Missing Edge Function Registrations

## Problem Identified

The published site at `portal.molitico.com` is failing to load properly because the **`db-proxy` edge function is returning 404 errors**. 

This is happening because the function exists in the codebase (`supabase/functions/db-proxy/`) but is **not registered** in `supabase/config.toml`. Without registration, the function is never deployed, causing all calls to fail with 404.

The `db-proxy` function is critical for `portal.molitico.com` because:
- The portal subdomain cannot make direct REST API calls due to CORS restrictions
- All database queries from the portal are routed through this edge function
- Without it, users cannot access any data after logging in

### Evidence from Logs

```
OPTIONS | 404 | https://nuclmzoasgydubdshtab.supabase.co/functions/v1/db-proxy
```

Multiple 404 errors at timestamps around `1.770334959e+15` (just moments ago).

---

## Solution

Add the missing edge function registrations to `supabase/config.toml`.

### Functions to Register

| Function | Purpose | verify_jwt |
|----------|---------|------------|
| `db-proxy` | Proxies database calls for portal subdomain (bypasses CORS) | `false` (validates auth internally) |
| `get-client-ip` | Returns client IP for session tracking | `false` (public helper) |
| `geolocate-ip` | Looks up IP geolocation for analytics | `false` (internal helper) |

---

## Implementation

### Step 1: Add Missing Registrations to config.toml

Add the following entries to `supabase/config.toml`:

```toml
# --- PORTAL PROXY (handles CORS bypass for portal.molitico.com) ---
[functions.db-proxy]
verify_jwt = false  # Validates auth header internally

# --- IP/GEOLOCATION HELPERS ---
[functions.get-client-ip]
verify_jwt = false  # Public helper to get client IP

[functions.geolocate-ip]
verify_jwt = false  # Internal IP geolocation lookup
```

### Step 2: Deploy Functions

After adding the registrations, the functions will be automatically deployed. This should resolve the 404 errors and restore portal functionality.

---

## Why This Happened

Per the project's deployment requirements (documented in memory `infrastructure/deployment/edge-function-registration-requirement`):

> All Supabase Edge Functions must be explicitly registered in supabase/config.toml. Functions that exist in the filesystem but aren't registered will not be deployed and will return 404 errors.

These functions were likely added to the codebase but the corresponding `config.toml` entries were missed.

---

## Expected Outcome

After implementation:
1. `portal.molitico.com` will load correctly
2. Login flow will work (using `db-proxy` for session validation)
3. Client dashboard will display data
4. Session tracking will work (using `get-client-ip` and `geolocate-ip`)

---

## Verification Steps

After deployment, verify by:
1. Navigate to `https://portal.molitico.com`
2. Log in with valid credentials
3. Confirm the client dashboard loads with data
4. Check edge function logs to confirm `db-proxy` is responding with 200 status codes
