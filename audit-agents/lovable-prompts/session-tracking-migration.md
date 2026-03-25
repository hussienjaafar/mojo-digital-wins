# Lovable Prompt: Session Tracking Database Migration

## Overview

Create a database migration for tracking user sessions with device information, enabling concurrent session management and security auditing.

## Database Schema

### Table: `user_sessions`

```sql
-- User sessions table for tracking active sessions across devices
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Device and location information
    device_info JSONB DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,

    -- Session timestamps
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE,

    -- Session status
    is_current BOOLEAN DEFAULT FALSE,
    is_valid BOOLEAN DEFAULT TRUE,

    -- Security tracking
    refresh_count INTEGER DEFAULT 0,
    last_refresh_at TIMESTAMP WITH TIME ZONE,

    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at) WHERE is_valid = TRUE;
CREATE INDEX idx_user_sessions_last_active ON user_sessions(last_active_at DESC);
CREATE INDEX idx_user_sessions_user_valid ON user_sessions(user_id, is_valid) WHERE is_valid = TRUE;

-- Trigger for updated_at
CREATE TRIGGER update_user_sessions_updated_at
    BEFORE UPDATE ON user_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### Device Info JSONB Structure

```json
{
  "browser": "Chrome",
  "browserVersion": "120.0.0",
  "os": "macOS",
  "osVersion": "14.0",
  "device": "desktop",
  "screenResolution": "1920x1080",
  "timezone": "America/New_York",
  "language": "en-US"
}
```

## Row Level Security (RLS) Policies

```sql
-- Enable RLS
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own sessions
CREATE POLICY "Users can view own sessions"
    ON user_sessions
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can update their own sessions (for last_active_at, ending sessions)
CREATE POLICY "Users can update own sessions"
    ON user_sessions
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Only the system can insert sessions (via service role or trigger)
CREATE POLICY "System can insert sessions"
    ON user_sessions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can delete (invalidate) their own sessions
CREATE POLICY "Users can delete own sessions"
    ON user_sessions
    FOR DELETE
    USING (auth.uid() = user_id);

-- Admins can view all sessions for security auditing
CREATE POLICY "Admins can view all sessions"
    ON user_sessions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'
        )
    );
```

## Database Functions

### Create Session

```sql
CREATE OR REPLACE FUNCTION create_user_session(
    p_user_id UUID,
    p_device_info JSONB DEFAULT '{}',
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days')
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session_id UUID;
BEGIN
    -- Mark all other sessions for this user as not current
    UPDATE user_sessions
    SET is_current = FALSE
    WHERE user_id = p_user_id AND is_current = TRUE;

    -- Insert new session
    INSERT INTO user_sessions (
        user_id,
        device_info,
        ip_address,
        user_agent,
        expires_at,
        is_current
    )
    VALUES (
        p_user_id,
        p_device_info,
        p_ip_address,
        p_user_agent,
        p_expires_at,
        TRUE
    )
    RETURNING id INTO v_session_id;

    RETURN v_session_id;
END;
$$;
```

### Update Session Activity

```sql
CREATE OR REPLACE FUNCTION update_session_activity(
    p_session_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE user_sessions
    SET
        last_active_at = NOW(),
        updated_at = NOW()
    WHERE id = p_session_id
    AND is_valid = TRUE
    AND expires_at > NOW();

    RETURN FOUND;
END;
$$;
```

### Refresh Session

```sql
CREATE OR REPLACE FUNCTION refresh_user_session(
    p_session_id UUID,
    p_new_expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days')
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE user_sessions
    SET
        expires_at = p_new_expires_at,
        last_refresh_at = NOW(),
        refresh_count = refresh_count + 1,
        last_active_at = NOW(),
        updated_at = NOW()
    WHERE id = p_session_id
    AND is_valid = TRUE
    AND auth.uid() = user_id;

    RETURN FOUND;
END;
$$;
```

### End Session (Logout)

```sql
CREATE OR REPLACE FUNCTION end_user_session(
    p_session_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE user_sessions
    SET
        is_valid = FALSE,
        is_current = FALSE,
        ended_at = NOW(),
        updated_at = NOW()
    WHERE id = p_session_id
    AND auth.uid() = user_id;

    RETURN FOUND;
END;
$$;
```

### End All Sessions (Security Action)

```sql
CREATE OR REPLACE FUNCTION end_all_user_sessions(
    p_except_current BOOLEAN DEFAULT TRUE
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    IF p_except_current THEN
        UPDATE user_sessions
        SET
            is_valid = FALSE,
            ended_at = NOW(),
            updated_at = NOW()
        WHERE user_id = auth.uid()
        AND is_valid = TRUE
        AND is_current = FALSE;
    ELSE
        UPDATE user_sessions
        SET
            is_valid = FALSE,
            is_current = FALSE,
            ended_at = NOW(),
            updated_at = NOW()
        WHERE user_id = auth.uid()
        AND is_valid = TRUE;
    END IF;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;
```

### Get Active Sessions

```sql
CREATE OR REPLACE FUNCTION get_user_active_sessions()
RETURNS TABLE (
    id UUID,
    device_info JSONB,
    ip_address TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    last_active_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_current BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        us.id,
        us.device_info,
        us.ip_address,
        us.started_at,
        us.last_active_at,
        us.expires_at,
        us.is_current
    FROM user_sessions us
    WHERE us.user_id = auth.uid()
    AND us.is_valid = TRUE
    AND us.expires_at > NOW()
    ORDER BY us.is_current DESC, us.last_active_at DESC;
END;
$$;
```

### Cleanup Expired Sessions (Scheduled Job)

```sql
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Mark expired sessions as invalid
    UPDATE user_sessions
    SET
        is_valid = FALSE,
        is_current = FALSE,
        ended_at = COALESCE(ended_at, expires_at),
        updated_at = NOW()
    WHERE is_valid = TRUE
    AND expires_at < NOW();

    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- Optionally delete very old sessions (older than 90 days)
    DELETE FROM user_sessions
    WHERE ended_at < NOW() - INTERVAL '90 days';

    RETURN v_count;
END;
$$;
```

## Supabase Edge Function: Session Webhook

Create an edge function to handle session creation on login:

```typescript
// supabase/functions/handle-session/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface SessionPayload {
  user_id: string;
  device_info?: Record<string, string>;
  ip_address?: string;
  user_agent?: string;
}

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { user_id, device_info, ip_address, user_agent } = await req.json() as SessionPayload

  const { data, error } = await supabase.rpc('create_user_session', {
    p_user_id: user_id,
    p_device_info: device_info || {},
    p_ip_address: ip_address,
    p_user_agent: user_agent,
  })

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ session_id: data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
```

## Frontend Integration

### React Hook for Session Management

The frontend `useSessionManager` hook should be updated to:

1. Call `create_user_session` on login
2. Call `update_session_activity` periodically (every 5 minutes)
3. Call `refresh_user_session` when extending session
4. Call `end_user_session` on logout
5. Provide `get_user_active_sessions` for the security settings page

### Security Settings UI

Create a "Active Sessions" page where users can:
- View all their active sessions with device info
- See which session is current
- End individual sessions
- "Sign out everywhere" to end all sessions

## Scheduled Jobs

Set up a pg_cron job to cleanup expired sessions:

```sql
-- Run every hour
SELECT cron.schedule(
    'cleanup-expired-sessions',
    '0 * * * *',
    'SELECT cleanup_expired_sessions();'
);
```

## Migration Order

1. Create the `user_sessions` table
2. Add indexes
3. Enable RLS and create policies
4. Create all functions
5. Set up the edge function webhook
6. Configure pg_cron job
7. Update frontend to integrate with session tracking

## Security Considerations

1. **IP Address Privacy**: Consider hashing or partially masking IP addresses for privacy
2. **Device Fingerprinting**: Be mindful of privacy regulations when collecting device info
3. **Session Limits**: Consider implementing max concurrent sessions per user
4. **Suspicious Activity**: Monitor for unusual patterns (many sessions, rapid location changes)
5. **Audit Logging**: Log security-sensitive session actions

## Testing Checklist

- [ ] Session created on login
- [ ] Session activity updated periodically
- [ ] Session refreshed when extending
- [ ] Session ended on logout
- [ ] "Sign out everywhere" works correctly
- [ ] Expired sessions cleaned up
- [ ] RLS policies working correctly
- [ ] Admins can view all sessions
- [ ] Device info captured correctly
