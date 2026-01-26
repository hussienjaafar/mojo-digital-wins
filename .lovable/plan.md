

# Implement Data Tracking for User Management

## Problem

The Enhanced User Management System UI is built, but all tracking tables are empty because the data collection mechanisms were never integrated into the application.

---

## Solution Overview

We need to connect the existing database functions to the actual user flows:

```text
+-------------------+     +----------------------+     +-------------------+
|   Login Flow      | --> | Track Session/Login  | --> | user_sessions     |
|   (ClientLogin)   |     | (call RPC functions) |     | login_attempts    |
+-------------------+     +----------------------+     +-------------------+

+-------------------+     +----------------------+     +-------------------+
|   User Activity   | --> | useActivityTracker   | --> | user_activity_logs|
|   (page views,    |     | (frontend hook)      |     |                   |
|    exports, etc)  |     +----------+-----------+     +-------------------+
+-------------------+                |
                                     v
                        +------------------------+
                        | log-user-activity      |
                        | (edge function)        |
                        +------------------------+

+-------------------+     +----------------------+     +-------------------+
|   Session/Login   | --> | geolocate-ip         | --> | user_locations    |
|   with IP address |     | (edge function)      |     | (cache)           |
+-------------------+     +----------------------+     +-------------------+
```

---

## Phase 1: Integrate Session & Login Tracking

### 1.1 Update Login Flow

Modify `src/pages/ClientLogin.tsx` to call tracking functions after successful login:

```typescript
// After successful signInWithPassword:
// 1. Record login attempt
await supabase.rpc('log_login_attempt', {
  p_email: email,
  p_success: true,
  p_ip_address: null, // Will get from edge function
  p_user_agent: navigator.userAgent
});

// 2. Create session record
await supabase.rpc('create_user_session', {
  p_user_id: data.user.id,
  p_device_info: parseDeviceInfo(navigator.userAgent),
  p_ip_address: null,
  p_user_agent: navigator.userAgent
});
```

### 1.2 Update AcceptInvitation Login

Apply same tracking to `src/pages/AcceptInvitation.tsx` login handler.

### 1.3 Add Failed Login Tracking

Record failed login attempts with failure reason:

```typescript
} catch (error: any) {
  await supabase.rpc('log_login_attempt', {
    p_email: email,
    p_success: false,
    p_failure_reason: error.message,
    p_user_agent: navigator.userAgent
  });
}
```

---

## Phase 2: Create Activity Tracking System

### 2.1 Create `useActivityTracker` Hook

New file: `src/hooks/useActivityTracker.ts`

```typescript
// Track significant user actions:
// - Page views (dashboard, reports, settings)
// - Data exports (CSV downloads)
// - Settings changes
// - Search queries (anonymized)
```

Features:
- Batches events to reduce API calls
- Debounces rapid events
- Graceful failure (non-blocking)
- Respects user privacy (no sensitive data)

### 2.2 Create `log-user-activity` Edge Function

New file: `supabase/functions/log-user-activity/index.ts`

- Accepts activity events from frontend
- Validates user session
- Inserts into `user_activity_logs` table
- Rate-limited to prevent abuse

### 2.3 Integrate into Key Components

Add tracking calls to:
- `ClientShell.tsx` - page navigation
- Export buttons - data exports
- Settings pages - configuration changes

---

## Phase 3: Create Geolocation System

### 3.1 Create `geolocate-ip` Edge Function

New file: `supabase/functions/geolocate-ip/index.ts`

- Uses free IP geolocation API (ip-api.com)
- Caches results in `user_locations` table (24-hour TTL)
- Called during session creation to enrich location data

### 3.2 Create `get-client-ip` Edge Function

New file: `supabase/functions/get-client-ip/index.ts`

- Returns the client's IP address
- Used by login flow to get accurate IP (since browser can't access this directly)

### 3.3 Update Session Creation Flow

Modify login to:
1. Get client IP via edge function
2. Create session with IP
3. Trigger async geolocation lookup

---

## Phase 4: Session Activity Updates

### 4.1 Create Session Heartbeat

Add to `useSessionManager.tsx`:

```typescript
// Every 5 minutes, update session activity
useEffect(() => {
  const interval = setInterval(() => {
    if (session) {
      supabase.rpc('update_session_activity', { 
        p_session_id: currentSessionId 
      });
    }
  }, 5 * 60 * 1000);
  return () => clearInterval(interval);
}, [session]);
```

### 4.2 Track Session End

On sign out, mark session as ended:

```typescript
await supabase.rpc('end_user_session', { 
  p_session_id: currentSessionId 
});
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/hooks/useActivityTracker.ts` | Client-side activity tracking hook |
| `supabase/functions/log-user-activity/index.ts` | Activity logging endpoint |
| `supabase/functions/geolocate-ip/index.ts` | IP geolocation service |
| `supabase/functions/get-client-ip/index.ts` | Client IP retrieval |
| `src/lib/deviceInfo.ts` | User agent parsing utility |

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/ClientLogin.tsx` | Add session/login tracking calls |
| `src/pages/AcceptInvitation.tsx` | Add session/login tracking calls |
| `src/hooks/useSessionManager.tsx` | Add heartbeat and session end tracking |
| `src/components/client/ClientShell.tsx` | Integrate activity tracker |
| `supabase/functions/db-proxy/index.ts` | Add `user_locations` to whitelist |

---

## Database Updates

### Fix RPC Return Type Issue

The network logs show an error with `get_user_login_history`:
```
"structure of query does not match function result type"
"Returned type inet does not match expected type text in column 6"
```

Need to update the function to cast `ip_address` to TEXT.

---

## Implementation Order

1. **Immediate** (this session):
   - Create device info parser utility
   - Update login pages to track sessions/logins
   - Create `get-client-ip` edge function

2. **Next** (follow-up):
   - Create `geolocate-ip` edge function
   - Create `log-user-activity` edge function
   - Create `useActivityTracker` hook
   - Integrate activity tracking

3. **Final**:
   - Add session heartbeat
   - Add session end tracking
   - Fix RPC return type issues

---

## Expected Outcome

After implementation:

| Data Source | Expected Population |
|-------------|---------------------|
| `user_sessions` | Every login creates a session record |
| `login_attempts` | All login attempts (success/failure) logged |
| `user_activity_logs` | Key user actions tracked |
| `user_locations` | IP addresses resolved to city/country |

The User Management UI will then display real data for:
- Last session info with device/location
- Login history with success/failure patterns
- Activity audit trail
- Location map visualization

