
# Plan: Fix Build Errors & Improve Invitation Flow Logging

## 1. Password Reset Status

**Password reset email has been sent** to `clembalanoff@gmail.com`. The user should check their inbox (and spam folder) for an email from "Account Security" with the subject "Reset Your Password". This will allow them to set their own secure password.

## 2. Build Errors to Fix

### Error 1: ImpactMap.tsx - TypeScript Expression Type Error (Line 337)

**Problem**: The nested MapLibre expression using interpolate inside case conditions is not properly typed for the `ExpressionSpecification` type.

**Solution**: Add explicit type casting to fix the complex nested expression structure.

**File**: `src/components/voter-impact/ImpactMap.tsx`
**Lines**: 337-372

**Change**:
- The existing `as ExpressionSpecification` cast at line 372 is not enough for the nested structure
- Need to simplify the expression or cast it through `unknown` first
- Replace the problematic expression with a simplified version that uses `as unknown as ExpressionSpecification`

### Error 2: RegionSidebar.tsx - Invalid `as` prop (Line 161)

**Problem**: The CardTitle component doesn't support an `as` prop - it always renders an h3.

**Solution**: Remove the invalid `as="h3"` prop since CardTitle already renders as h3 by default.

**File**: `src/components/voter-impact/RegionSidebar.tsx`
**Line**: 161

**Current**:
```tsx
<CardTitle as="h3" className="text-sm font-medium text-[#94a3b8]">{title}</CardTitle>
```

**Fixed**:
```tsx
<CardTitle className="text-sm font-medium text-[#94a3b8]">{title}</CardTitle>
```

## 3. Logging Improvements for Invitation Flow

The invitation flow already has extensive structured logging in the Edge Function (`accept-invitation-signup/index.ts`). To help diagnose future issues, I recommend adding client-side diagnostic logging to the AcceptInvitation page.

**File**: `src/pages/AcceptInvitation.tsx`

### Add Client-Side Diagnostic Logging

Add a structured logging utility at the top of the file and use it throughout the invitation flow:

```typescript
// Diagnostic logging for invitation debugging
function logInvitationEvent(event: string, data?: Record<string, unknown>) {
  console.log(JSON.stringify({
    component: "AcceptInvitation",
    timestamp: new Date().toISOString(),
    event,
    url: window.location.href,
    token: new URLSearchParams(window.location.search).get("token")?.substring(0, 8) + "...",
    ...data,
  }));
}
```

### Log Key Events

Add logging calls to these key points:

1. **Page Load** - Log when the page loads with the token
2. **Invitation Loaded** - Log invitation details (status, type, email pattern)
3. **Signup Form Submit** - Log when the form is submitted
4. **Edge Function Response** - Log the response status and any error codes
5. **Session Established** - Log when the session is created
6. **Redirect** - Log when the user is redirected to the dashboard

### Example Additions

**loadInvitation function** (around line 176):
```typescript
const loadInvitation = async () => {
  logInvitationEvent("loading_invitation");
  try {
    const { data, error } = await supabase.rpc("get_invitation_by_token", {
      p_token: token!,
    });

    if (error) {
      logInvitationEvent("invitation_rpc_error", { error: error.message });
      throw error;
    }
    
    if (!data || data.length === 0) {
      logInvitationEvent("invitation_not_found");
      setError("Invitation not found or has expired");
      return;
    }

    const inv = data[0] as InvitationDetails;
    logInvitationEvent("invitation_loaded", { 
      status: inv.status, 
      type: inv.invitation_type,
      hasOrg: !!inv.organization_id 
    });
    // ... rest of function
```

**handleSignup function** (around line 240):
```typescript
logInvitationEvent("signup_started", { email: invitation!.email });

const response = await fetch(/* ... */);
const result = await response.json();

logInvitationEvent("signup_response", { 
  status: response.status, 
  ok: response.ok,
  code: result.code,
  hasAccessToken: !!result.access_token,
  requestId: result.requestId  // Correlates with edge function logs
});
```

## Summary of Changes

| File | Change | Purpose |
|------|--------|---------|
| `src/components/voter-impact/ImpactMap.tsx` | Fix type casting for district color expression | Resolve TypeScript build error |
| `src/components/voter-impact/RegionSidebar.tsx` | Remove invalid `as` prop from CardTitle | Resolve TypeScript build error |
| `src/pages/AcceptInvitation.tsx` | Add structured diagnostic logging | Debug future invitation issues |

## Verification

After implementation:
1. Build should complete without TypeScript errors
2. Voter Impact Map should display correctly with colored districts
3. Console logs will show detailed invitation flow diagnostics
4. Edge function logs already show server-side events (as seen in previous debugging)
