

# Fix: Contact Form Email Notifications Blocked by CORS

## Problem
The `send-contact-notification` edge function works correctly when called directly, but **never executes from the browser** because of a CORS mismatch.

**Root cause**: Line 9 calls `getCorsHeaders()` without passing the request object. This returns a static first origin (e.g. `https://portal.molitico.com`). When the browser preflight comes from `mojo-digital-wins.lovable.app`, CORS fails and the POST is never sent. The frontend silently swallows the error.

Evidence:
- Zero function logs from real user submissions (only my test just now)
- Contact submissions ARE saved to the database (the insert happens before the notification call)
- The function itself works perfectly (test returned `success: true`)
- The CORS response header showed `portal.molitico.com` instead of matching the request origin

## Fix

**File: `supabase/functions/send-contact-notification/index.ts`**

1. Remove the module-level `const corsHeaders = getCorsHeaders();` (line 9)
2. Inside the handler, compute CORS headers dynamically by passing `req`:

```typescript
const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);  // ← pass req for dynamic origin matching

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  // ... rest unchanged
```

This one-line change ensures the `getCorsHeaders(req)` function matches the requesting origin against the allowlist (which already includes Lovable domains via the `isLovableDomain` check in `security.ts`).

3. Deploy the updated function.

## Result
After this fix, contact form submissions from any valid origin (published site, preview URLs) will successfully trigger email notifications to all 3 configured recipients.

