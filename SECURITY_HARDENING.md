# Security Hardening Summary

## Changes Made

### 1. Secrets Hygiene
- `.env` is managed by Lovable Cloud and never committed
- `.env.example` contains only placeholders
- All secrets are injected via environment variables

### 2. ActBlue Webhook Multi-Tenant HMAC Validation
**File:** `supabase/functions/actblue-webhook/index.ts`

- Added HMAC-SHA256 signature validation using per-organization `webhook_secret`
- Incoming requests must include `X-ActBlue-Signature` header with format `sha256=<hex-signature>`
- Organization is identified by `entity_id` from the payload
- Webhook secret is stored in `client_api_credentials.encrypted_credentials.webhook_secret`
- Requests with missing/invalid signatures are rejected with 401/403

**Testable helpers exported:**
- `computeHmacSignature(body, secret)` - Computes HMAC-SHA256
- `validateHmacSignature(header, body, secret)` - Validates signature with timing-safe comparison

### 3. Auth on Service-Role Functions

**calculate-roi & analyze-donor-cohorts:**
- Switched from service-role to anon key + user JWT
- Requires authenticated user via `Authorization: Bearer <jwt>` header
- Verifies user belongs to target organization OR is admin
- Uses service role only for writes (after auth check)

**monitor-attribution-health:**
- Requires JWT authentication (`verify_jwt = true`)
- Enforces admin role check
- Only admins can monitor cross-organization health

**run-scheduled-jobs:**
- Requires JWT authentication (`verify_jwt = true`)
- Supports two auth methods:
  1. Admin JWT - for manual triggers from UI
  2. `X-Cron-Secret` header - for scheduled invocations
- Add `CRON_SECRET` to Supabase secrets for scheduled job authentication

### 4. CORS Hardening
All updated functions use restricted CORS:
```typescript
const ALLOWED_ORIGINS = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || [];
const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0] || 'https://lovable.dev',
  ...
};
```

### 5. API Credentials Security
**File:** `src/components/admin/APICredentialsManager.tsx`

- Never fetches or displays raw credentials after initial save
- Form data cleared immediately after save/close
- Secure input fields with show/hide toggle
- ActBlue now requires `webhook_secret` field (mandatory)
- Visual indicators showing credentials are encrypted

**Shared utilities:** `supabase/functions/_shared/security.ts`
- `encryptCredentials()` - AES-GCM encryption with PBKDF2 key derivation
- `decryptCredentials()` - Corresponding decryption
- `maskCredentials()` - Masks sensitive fields for display

### 6. Config Updates
**File:** `supabase/config.toml`

Updated `verify_jwt` settings:
- `run-scheduled-jobs` → `true`
- `monitor-attribution-health` → `true`
- `calculate-roi` → `true` (already was)
- `analyze-donor-cohorts` → `true` (already was)

## Manual Steps Required

1. **Set ALLOWED_ORIGINS secret:**
   ```
   ALLOWED_ORIGINS=https://your-app.lovable.app,https://custom-domain.com
   ```

2. **Set CRON_SECRET for scheduled jobs:**
   ```
   CRON_SECRET=<generate-strong-random-secret>
   ```

3. **Ensure per-org ActBlue webhook secrets:**
   - Each organization needs `webhook_secret` in their ActBlue credentials
   - Update existing credentials via the API Credentials Manager

4. **Update external cron/scheduler:**
   - Add `X-Cron-Secret: <your-cron-secret>` header to scheduled job calls

5. **Rotate Supabase anon key (if compromised):**
   - Generate new key in Supabase dashboard
   - Update will be automatic via Lovable Cloud

## Test Coverage

**File:** `supabase/functions/actblue-webhook/hmac.test.ts`

Run tests:
```bash
deno test --allow-env supabase/functions/actblue-webhook/hmac.test.ts
```

Tests cover:
- Signature consistency
- Valid signature acceptance
- Invalid signature rejection
- Wrong secret rejection
- Null/malformed header handling
- Body tampering detection
