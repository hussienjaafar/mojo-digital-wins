# Lovable Prompt: Token Security Enhancements for Edge Functions

## Context

This prompt addresses critical security improvements for the invitation token system. The edge functions handle user invitations and must be hardened against various attack vectors.

### Current Architecture Overview

**Edge Functions Involved:**
1. `send-user-invitation` - Creates invitations and sends emails
2. `accept-invitation-signup` - Validates tokens and creates user accounts

**Database Tables:**
- `user_invitations` - Stores invitation records with tokens
- `invitation_audit_logs` - Already exists for tracking invitation events

### Current Token Expiry Implementation

In `send-user-invitation/index.ts`, the expiry is set in two places:

**Line 137-138 (Resend flow):**
```typescript
const newExpiry = new Date();
newExpiry.setDate(newExpiry.getDate() + 7); // 7 days from now
```

**Email templates reference:**
```typescript
expiresIn: '7 days',
```

The database default is also 7 days (from migration):
```sql
expires_at timestamptz DEFAULT (now() + interval '7 days')
```

---

## PROMPT 1: Reduce Token Expiry to 48 Hours

### Task Description

Update the `send-user-invitation` edge function to use 48-hour token expiry instead of 7 days. This reduces the attack window for token theft or brute-force attempts.

### Specific Changes Required

**1. Update send-user-invitation/index.ts**

Find and replace the resend expiry calculation (around lines 137-138):

**Current Code:**
```typescript
const newExpiry = new Date();
newExpiry.setDate(newExpiry.getDate() + 7); // 7 days from now
```

**Replace With:**
```typescript
const newExpiry = new Date();
newExpiry.setTime(newExpiry.getTime() + 48 * 60 * 60 * 1000); // 48 hours from now
```

**2. Update Email Template References**

Find all instances of `expiresIn: '7 days'` and replace with `expiresIn: '48 hours'`:

- Line 192-193 (resend flow):
```typescript
expiresIn: '48 hours',
```

- Line 356-357 (new invitation):
```typescript
expiresIn: '48 hours',
```

**3. Update comments if any reference 7 days**

### Testing Requirements

1. Create a new invitation and verify `expires_at` is ~48 hours in the future
2. Resend an invitation and verify `expires_at` is updated to ~48 hours from resend time
3. Verify email content shows "48 hours" instead of "7 days"

---

## PROMPT 2: Implement Single-Use Tokens

### Task Description

Ensure invitation tokens can only be used once. After successful acceptance, the token should be permanently invalidated even if the same `accept_invitation` function is called again.

### Background

The current implementation uses the `status` field to track acceptance:
- `pending` - Token is valid and unused
- `accepted` - Token has been used
- `expired` - Token has expired
- `revoked` - Token was manually revoked

The `accept_invitation` RPC function already checks for `status = 'accepted'`, but we need to add a `used_at` timestamp for better audit trails and ensure atomic marking.

### Changes Required in accept-invitation-signup/index.ts

**1. Add Validation for used_at Timestamp**

After fetching the invitation (around line 220), add a check for `used_at`:

```typescript
// After the invitation is fetched and before status checks
// Check if token was already used (belt-and-suspenders with status check)
if (invitation.used_at) {
  log.warn("Token already used", { usedAt: invitation.used_at });
  await logAuditEvent(supabaseAdmin, {
    invitationId: invitation.id,
    eventType: "token_reuse_attempt",
    email,
    organizationId: invitation.organization_id,
    invitationType: invitation.invitation_type,
    status: invitation.status,
    errorMessage: "Token has already been used",
    metadata: { requestId, usedAt: invitation.used_at },
  });
  return new Response(
    JSON.stringify({ error: "This invitation has already been used", requestId }),
    {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    }
  );
}
```

**2. Update the get_invitation_by_token RPC Call Response**

The edge function relies on `get_invitation_by_token` RPC. You'll need to ensure it returns `used_at`. See the migrations prompt for database changes.

### Note on Database Function

The `accept_invitation` database function will handle marking `used_at` atomically. The edge function just needs to check for it as a secondary validation.

---

## PROMPT 3: Implement Rate Limiting for Token Validation Failures

### Task Description

Add rate limiting to prevent brute-force attacks against invitation tokens. After 5 failed attempts to use a token, the token should be permanently blocked.

### Implementation Details for accept-invitation-signup/index.ts

**1. Add Failed Attempt Tracking**

After fetching the invitation, check the `failed_attempts` count:

```typescript
// After fetching invitation but before validation
// Check if token has been blocked due to too many failed attempts
const MAX_FAILED_ATTEMPTS = 5;

if (invitation.failed_attempts >= MAX_FAILED_ATTEMPTS) {
  log.warn("Token blocked due to failed attempts", {
    failedAttempts: invitation.failed_attempts
  });
  await logAuditEvent(supabaseAdmin, {
    invitationId: invitation.id,
    eventType: "token_blocked",
    email,
    organizationId: invitation.organization_id,
    invitationType: invitation.invitation_type,
    errorMessage: `Token blocked after ${invitation.failed_attempts} failed attempts`,
    metadata: { requestId, failedAttempts: invitation.failed_attempts },
  });
  return new Response(
    JSON.stringify({
      error: "This invitation link has been blocked due to too many failed attempts. Please request a new invitation.",
      requestId
    }),
    {
      status: 403,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    }
  );
}
```

**2. Increment Failed Attempts on Validation Failures**

When email mismatch or other validation failures occur, call an RPC to increment failed attempts:

```typescript
// Example: After email mismatch check (around line 315)
// Increment failed attempts
await supabaseAdmin.rpc('increment_invitation_failed_attempts', {
  p_invitation_id: invitation.id
});

await logAuditEvent(supabaseAdmin, {
  invitationId: invitation.id,
  eventType: "email_mismatch",
  email,
  // ... rest of existing audit log
});
```

**3. Update get_invitation_by_token Response**

Ensure the RPC returns `failed_attempts`. See migrations prompt.

---

## PROMPT 4: Enhanced Audit Logging with IP and User Agent

### Task Description

Enhance the audit logging to capture IP address and User-Agent header for all invitation acceptance attempts. This aids in security investigations and fraud detection.

### Changes to accept-invitation-signup/index.ts

**1. Extract Request Metadata at Start of Handler**

Add after line 140 (after CORS check):

```typescript
// Extract client information for audit logging
const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  || req.headers.get('x-real-ip')
  || req.headers.get('cf-connecting-ip')  // Cloudflare
  || 'unknown';
const userAgent = req.headers.get('user-agent') || 'unknown';

log.info("Invitation signup request started", {
  clientIp: clientIp.substring(0, 3) + '***',  // Partial IP for logs
  userAgentPrefix: userAgent.substring(0, 50)
});
```

**2. Update All logAuditEvent Calls to Include Request Metadata**

Modify the `logAuditEvent` helper or add to metadata in each call:

```typescript
await logAuditEvent(supabaseAdmin, {
  invitationId: invitation.id,
  eventType: "signup_success",
  email,
  userId: user.id,
  organizationId: result.organization_id,
  invitationType: result.invitation_type,
  status: "accepted",
  metadata: {
    requestId,
    clientIp,      // Add IP address
    userAgent,     // Add User-Agent
  },
});
```

**3. Create Helper Function for Consistent Metadata**

Add near the top of the file after imports:

```typescript
function getRequestMetadata(req: Request): { clientIp: string; userAgent: string } {
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || req.headers.get('cf-connecting-ip')
    || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  return { clientIp, userAgent };
}
```

Then use in the handler:

```typescript
const { clientIp, userAgent } = getRequestMetadata(req);
```

### Important Security Notes

1. **IP Address Privacy**: The full IP address is stored for security purposes but should be treated as PII
2. **User-Agent Length**: User-Agent strings can be very long; consider truncating if needed
3. **Header Spoofing**: These headers can be spoofed, so they should be used for investigation, not authentication

---

## PROMPT 5: Comprehensive Update Summary

### Full Change List for accept-invitation-signup/index.ts

1. **Add request metadata extraction** at the start of the handler
2. **Add used_at check** after fetching invitation
3. **Add failed_attempts check** and blocking logic
4. **Update all logAuditEvent calls** to include IP and User-Agent
5. **Add error handling for increment_invitation_failed_attempts RPC**

### Expected New RPC Functions to Call (defined in migrations)

- `get_invitation_by_token` - Must return `used_at` and `failed_attempts`
- `increment_invitation_failed_attempts(p_invitation_id uuid)` - New function to increment failure counter

### Testing Checklist

- [ ] Token expires after 48 hours
- [ ] Used token cannot be reused (check `used_at`)
- [ ] After 5 email mismatches, token is blocked
- [ ] IP address is captured in audit logs
- [ ] User-Agent is captured in audit logs
- [ ] All existing functionality still works

---

## Full Updated Code Structure

Here's the complete structure of changes needed in `accept-invitation-signup/index.ts`:

```typescript
// Near the top, add helper function
function getRequestMetadata(req: Request): { clientIp: string; userAgent: string } {
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || req.headers.get('cf-connecting-ip')
    || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  return { clientIp, userAgent };
}

// Inside serve handler, after CORS check:
const { clientIp, userAgent } = getRequestMetadata(req);

// After fetching invitation (around line 220), add:
// 1. Check for used_at
if (invitation.used_at) {
  // ... return error
}

// 2. Check for blocked due to failed attempts
const MAX_FAILED_ATTEMPTS = 5;
if (invitation.failed_attempts >= MAX_FAILED_ATTEMPTS) {
  // ... return error
}

// On validation failures (email mismatch, etc), call:
await supabaseAdmin.rpc('increment_invitation_failed_attempts', {
  p_invitation_id: invitation.id
});

// In all logAuditEvent calls, add to metadata:
metadata: { requestId, clientIp, userAgent, /* other existing fields */ }
```

---

## send-user-invitation/index.ts Changes Summary

1. **Line 137-138**: Change `newExpiry.setDate(newExpiry.getDate() + 7)` to `newExpiry.setTime(newExpiry.getTime() + 48 * 60 * 60 * 1000)`
2. **Line 192**: Change `expiresIn: '7 days'` to `expiresIn: '48 hours'`
3. **Line 356**: Change `expiresIn: '7 days'` to `expiresIn: '48 hours'`

No other changes needed for send-user-invitation as the new columns are handled in the database layer.
