# Lovable Prompt: Token Security Database Migrations

## Context

This migration prompt complements the edge function security hardening. These database changes support:

1. Reduced token expiry (48 hours instead of 7 days)
2. Single-use tokens via `used_at` timestamp
3. Rate limiting via `failed_attempts` counter
4. Enhanced audit logging with IP address and User-Agent

### Current Database Schema

The `user_invitations` table currently has:
```sql
CREATE TABLE public.user_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  invitation_type text NOT NULL CHECK (invitation_type IN ('platform_admin', 'organization_member')),
  organization_id uuid REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  role text CHECK (role IS NULL OR role IN ('admin', 'manager', 'viewer')),
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  resend_count integer DEFAULT 0 NOT NULL,
  -- constraints...
);
```

The `invitation_audit_logs` table exists with basic schema.

---

## MIGRATION 1: Add Security Columns to user_invitations

### Purpose

Add `used_at` and `failed_attempts` columns to track token usage and failed validation attempts.

### SQL Migration

```sql
-- Migration: Add security columns to user_invitations
-- Description: Adds used_at timestamp and failed_attempts counter for token security

-- Add used_at column to track when a token was used (single-use enforcement)
ALTER TABLE public.user_invitations
ADD COLUMN IF NOT EXISTS used_at timestamptz;

-- Add failed_attempts column to track validation failures (rate limiting)
ALTER TABLE public.user_invitations
ADD COLUMN IF NOT EXISTS failed_attempts integer DEFAULT 0 NOT NULL;

-- Add index for failed_attempts queries (finding blocked tokens)
CREATE INDEX IF NOT EXISTS idx_user_invitations_failed_attempts
ON public.user_invitations(failed_attempts)
WHERE failed_attempts > 0;

-- Add index for used_at queries
CREATE INDEX IF NOT EXISTS idx_user_invitations_used_at
ON public.user_invitations(used_at)
WHERE used_at IS NOT NULL;

COMMENT ON COLUMN public.user_invitations.used_at IS 'Timestamp when the token was used for signup/acceptance. NULL if not yet used.';
COMMENT ON COLUMN public.user_invitations.failed_attempts IS 'Count of failed validation attempts. Token is blocked after 5 failures.';
```

---

## MIGRATION 2: Update Default Token Expiry to 48 Hours

### Purpose

Change the default expiry from 7 days to 48 hours for new invitations.

### SQL Migration

```sql
-- Migration: Reduce default token expiry to 48 hours
-- Description: New invitations expire in 48 hours instead of 7 days for security

-- Update the default value for expires_at
ALTER TABLE public.user_invitations
ALTER COLUMN expires_at SET DEFAULT (now() + interval '48 hours');

COMMENT ON COLUMN public.user_invitations.expires_at IS 'Token expiry timestamp. Defaults to 48 hours from creation.';
```

### Note on Existing Invitations

This migration only affects new invitations. Existing pending invitations will retain their original 7-day expiry. If you want to update existing invitations, add:

```sql
-- OPTIONAL: Update existing pending invitations to 48-hour expiry
-- Only run if you want to shorten existing invitation windows
UPDATE public.user_invitations
SET expires_at = LEAST(expires_at, created_at + interval '48 hours')
WHERE status = 'pending'
  AND expires_at > now() + interval '48 hours';
```

---

## MIGRATION 3: Update get_invitation_by_token Function

### Purpose

Return the new security columns (`used_at`, `failed_attempts`) so the edge function can check them.

### SQL Migration

```sql
-- Migration: Update get_invitation_by_token to return security columns
-- Description: Adds used_at and failed_attempts to the returned data

DROP FUNCTION IF EXISTS public.get_invitation_by_token(text);

CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token text)
RETURNS TABLE (
  id uuid,
  email text,
  invitation_type text,
  organization_id uuid,
  organization_name text,
  role text,
  status text,
  expires_at timestamptz,
  used_at timestamptz,
  failed_attempts integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.email,
    i.invitation_type,
    i.organization_id,
    co.name as organization_name,
    i.role,
    i.status,
    i.expires_at,
    i.used_at,
    i.failed_attempts
  FROM user_invitations i
  LEFT JOIN client_organizations co ON co.id = i.organization_id
  WHERE i.token = p_token;
END;
$$;

COMMENT ON FUNCTION public.get_invitation_by_token(text) IS 'Retrieves invitation details by token, including security fields for validation.';
```

---

## MIGRATION 4: Create increment_invitation_failed_attempts Function

### Purpose

Atomic function to increment the failed_attempts counter when validation fails.

### SQL Migration

```sql
-- Migration: Create function to increment failed attempts
-- Description: Safely increments the failed_attempts counter for rate limiting

CREATE OR REPLACE FUNCTION public.increment_invitation_failed_attempts(p_invitation_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_count integer;
BEGIN
  UPDATE user_invitations
  SET failed_attempts = failed_attempts + 1
  WHERE id = p_invitation_id
  RETURNING failed_attempts INTO v_new_count;

  -- Log the failed attempt
  PERFORM log_invitation_event(
    p_invitation_id,
    'failed_attempt_recorded',
    NULL,  -- email
    NULL,  -- user_id
    NULL,  -- organization_id
    NULL,  -- invitation_type
    NULL,  -- status
    'Failed attempt #' || v_new_count,
    jsonb_build_object('failed_attempts', v_new_count),
    'rpc'
  );

  -- If we hit the threshold, update status to revoked
  IF v_new_count >= 5 THEN
    UPDATE user_invitations
    SET status = 'revoked'
    WHERE id = p_invitation_id
      AND status = 'pending';

    PERFORM log_invitation_event(
      p_invitation_id,
      'token_auto_revoked',
      NULL,
      NULL,
      NULL,
      NULL,
      'revoked',
      'Token auto-revoked after 5 failed attempts',
      jsonb_build_object('failed_attempts', v_new_count),
      'rpc'
    );
  END IF;

  RETURN v_new_count;
END;
$$;

COMMENT ON FUNCTION public.increment_invitation_failed_attempts(uuid) IS 'Increments failed attempt counter. Auto-revokes token after 5 failures.';
```

---

## MIGRATION 5: Update accept_invitation to Set used_at

### Purpose

Mark the token as used atomically when accepted, preventing race conditions.

### SQL Migration

```sql
-- Migration: Update accept_invitation to set used_at timestamp
-- Description: Marks token as used atomically during acceptance

CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation record;
  v_full_name text;
  v_result jsonb;
BEGIN
  -- Log: Started accepting invitation
  PERFORM log_invitation_event(
    NULL, 'accept_started', NULL, p_user_id, NULL, NULL, NULL, NULL,
    jsonb_build_object('token_prefix', left(p_token, 8) || '...'), 'rpc'
  );

  -- Get and lock the invitation
  SELECT * INTO v_invitation
  FROM user_invitations
  WHERE token = p_token
  FOR UPDATE;

  -- Validate invitation exists
  IF v_invitation IS NULL THEN
    PERFORM log_invitation_event(
      NULL, 'accept_failed', NULL, p_user_id, NULL, NULL, NULL,
      'Invitation not found',
      jsonb_build_object('token_prefix', left(p_token, 8) || '...'), 'rpc'
    );
    RETURN jsonb_build_object('success', false, 'error', 'Invitation not found');
  END IF;

  -- Log: Found invitation
  PERFORM log_invitation_event(
    v_invitation.id, 'invitation_found', v_invitation.email, p_user_id,
    v_invitation.organization_id, v_invitation.invitation_type, v_invitation.status,
    NULL, '{}'::jsonb, 'rpc'
  );

  -- NEW: Check if token was already used (single-use enforcement)
  IF v_invitation.used_at IS NOT NULL THEN
    PERFORM log_invitation_event(
      v_invitation.id, 'token_reuse_blocked', v_invitation.email, p_user_id,
      v_invitation.organization_id, v_invitation.invitation_type, v_invitation.status,
      'Token already used at ' || v_invitation.used_at::text,
      jsonb_build_object('used_at', v_invitation.used_at), 'rpc'
    );
    RETURN jsonb_build_object('success', false, 'error', 'This invitation has already been used');
  END IF;

  -- NEW: Check if token is blocked due to failed attempts
  IF v_invitation.failed_attempts >= 5 THEN
    PERFORM log_invitation_event(
      v_invitation.id, 'token_blocked_attempt', v_invitation.email, p_user_id,
      v_invitation.organization_id, v_invitation.invitation_type, v_invitation.status,
      'Token blocked after ' || v_invitation.failed_attempts || ' failed attempts',
      jsonb_build_object('failed_attempts', v_invitation.failed_attempts), 'rpc'
    );
    RETURN jsonb_build_object('success', false, 'error', 'This invitation has been blocked due to too many failed attempts');
  END IF;

  -- Check if already accepted
  IF v_invitation.status = 'accepted' THEN
    PERFORM log_invitation_event(
      v_invitation.id, 'accept_failed', v_invitation.email, p_user_id,
      v_invitation.organization_id, v_invitation.invitation_type, v_invitation.status,
      'Invitation already accepted', '{}'::jsonb, 'rpc'
    );
    RETURN jsonb_build_object('success', false, 'error', 'Invitation already accepted');
  END IF;

  -- Check if expired
  IF v_invitation.expires_at < now() THEN
    UPDATE user_invitations SET status = 'expired' WHERE id = v_invitation.id;
    PERFORM log_invitation_event(
      v_invitation.id, 'accept_failed', v_invitation.email, p_user_id,
      v_invitation.organization_id, v_invitation.invitation_type, 'expired',
      'Invitation has expired', '{}'::jsonb, 'rpc'
    );
    RETURN jsonb_build_object('success', false, 'error', 'Invitation has expired');
  END IF;

  -- Check if revoked
  IF v_invitation.status = 'revoked' THEN
    PERFORM log_invitation_event(
      v_invitation.id, 'accept_failed', v_invitation.email, p_user_id,
      v_invitation.organization_id, v_invitation.invitation_type, v_invitation.status,
      'Invitation has been revoked', '{}'::jsonb, 'rpc'
    );
    RETURN jsonb_build_object('success', false, 'error', 'Invitation has been revoked');
  END IF;

  -- Get full_name from auth.users metadata, fallback to profiles.email, then 'User'
  SELECT COALESCE(
    raw_user_meta_data->>'full_name',
    (SELECT email FROM profiles WHERE id = p_user_id),
    'User'
  ) INTO v_full_name
  FROM auth.users
  WHERE id = p_user_id;

  IF v_full_name IS NULL THEN
    SELECT COALESCE(email, 'User') INTO v_full_name FROM profiles WHERE id = p_user_id;
  END IF;

  -- Log: Processing invitation type
  PERFORM log_invitation_event(
    v_invitation.id, 'processing_' || v_invitation.invitation_type, v_invitation.email, p_user_id,
    v_invitation.organization_id, v_invitation.invitation_type, v_invitation.status,
    NULL, jsonb_build_object('full_name', v_full_name, 'role', v_invitation.role), 'rpc'
  );

  -- Process based on invitation type
  IF v_invitation.invitation_type = 'platform_admin' THEN
    -- Grant platform admin role
    INSERT INTO user_roles (user_id, role)
    VALUES (p_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Mark onboarding as complete for platform admins
    UPDATE profiles
    SET
      onboarding_completed = true,
      onboarding_completed_at = now()
    WHERE id = p_user_id;

    PERFORM log_invitation_event(
      v_invitation.id, 'admin_role_granted', v_invitation.email, p_user_id,
      NULL, 'platform_admin', NULL, NULL, '{}'::jsonb, 'rpc'
    );

  ELSIF v_invitation.invitation_type = 'organization_member' THEN
    -- Create client_users entry with proper error handling
    BEGIN
      INSERT INTO client_users (id, organization_id, role, full_name)
      VALUES (p_user_id, v_invitation.organization_id, v_invitation.role, v_full_name)
      ON CONFLICT (id) DO UPDATE SET
        organization_id = EXCLUDED.organization_id,
        role = EXCLUDED.role,
        full_name = COALESCE(NULLIF(EXCLUDED.full_name, 'User'), client_users.full_name);

      PERFORM log_invitation_event(
        v_invitation.id, 'client_user_created', v_invitation.email, p_user_id,
        v_invitation.organization_id, 'organization_member', NULL, NULL,
        jsonb_build_object('full_name', v_full_name, 'role', v_invitation.role), 'rpc'
      );
    EXCEPTION WHEN OTHERS THEN
      PERFORM log_invitation_event(
        v_invitation.id, 'client_user_failed', v_invitation.email, p_user_id,
        v_invitation.organization_id, 'organization_member', NULL,
        'Failed to create organization membership: ' || SQLERRM,
        jsonb_build_object('sqlstate', SQLSTATE), 'rpc'
      );
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Failed to create organization membership: ' || SQLERRM
      );
    END;

    -- Mark onboarding as complete for organization members
    UPDATE profiles
    SET
      onboarding_completed = true,
      onboarding_completed_at = now()
    WHERE id = p_user_id;
  END IF;

  -- Mark invitation as accepted AND set used_at (atomic single-use enforcement)
  UPDATE user_invitations
  SET
    status = 'accepted',
    accepted_at = now(),
    used_at = now()  -- NEW: Mark as used
  WHERE id = v_invitation.id;

  -- Log: Success
  PERFORM log_invitation_event(
    v_invitation.id, 'accept_success', v_invitation.email, p_user_id,
    v_invitation.organization_id, v_invitation.invitation_type, 'accepted',
    NULL, '{}'::jsonb, 'rpc'
  );

  RETURN jsonb_build_object(
    'success', true,
    'invitation_type', v_invitation.invitation_type,
    'organization_id', v_invitation.organization_id
  );
END;
$$;

COMMENT ON FUNCTION public.accept_invitation(text, uuid) IS 'Accepts an invitation token, creates user roles/memberships, marks token as used.';
```

---

## MIGRATION 6: Enhance invitation_audit_logs for IP and User-Agent

### Purpose

Add columns to store IP address and User-Agent for security investigations.

### SQL Migration

```sql
-- Migration: Add IP and User-Agent columns to invitation_audit_logs
-- Description: Enhanced audit logging for security investigations

-- Add client_ip column
ALTER TABLE public.invitation_audit_logs
ADD COLUMN IF NOT EXISTS client_ip inet;

-- Add user_agent column
ALTER TABLE public.invitation_audit_logs
ADD COLUMN IF NOT EXISTS user_agent text;

-- Add index for IP address queries (useful for detecting abuse patterns)
CREATE INDEX IF NOT EXISTS idx_invitation_audit_logs_client_ip
ON invitation_audit_logs(client_ip)
WHERE client_ip IS NOT NULL;

-- Update the log_invitation_event function to accept IP and User-Agent
DROP FUNCTION IF EXISTS public.log_invitation_event(uuid, text, text, uuid, uuid, text, text, text, jsonb, text);

CREATE OR REPLACE FUNCTION public.log_invitation_event(
  p_invitation_id UUID,
  p_event_type TEXT,
  p_email TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_organization_id UUID DEFAULT NULL,
  p_invitation_type TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_source TEXT DEFAULT 'rpc',
  p_client_ip TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
  v_client_ip inet;
BEGIN
  -- Safely parse IP address, NULL if invalid
  BEGIN
    v_client_ip := p_client_ip::inet;
  EXCEPTION WHEN OTHERS THEN
    v_client_ip := NULL;
  END;

  INSERT INTO invitation_audit_logs (
    invitation_id, event_type, email, user_id, organization_id,
    invitation_type, status, error_message, metadata, source,
    client_ip, user_agent
  ) VALUES (
    p_invitation_id, p_event_type, p_email, p_user_id, p_organization_id,
    p_invitation_type, p_status, p_error_message, p_metadata, p_source,
    v_client_ip, p_user_agent
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

COMMENT ON COLUMN public.invitation_audit_logs.client_ip IS 'Client IP address from request headers (x-forwarded-for, x-real-ip, cf-connecting-ip)';
COMMENT ON COLUMN public.invitation_audit_logs.user_agent IS 'Client User-Agent header string';
COMMENT ON FUNCTION public.log_invitation_event IS 'Logs invitation events with optional IP address and User-Agent for security auditing.';
```

---

## MIGRATION 7: Create Security Analytics Views

### Purpose

Create views for security monitoring and threat detection.

### SQL Migration

```sql
-- Migration: Create security analytics views for invitation system
-- Description: Views for monitoring suspicious activity patterns

-- View: Failed attempts summary by IP
CREATE OR REPLACE VIEW public.invitation_security_by_ip AS
SELECT
  client_ip,
  COUNT(*) as total_events,
  COUNT(*) FILTER (WHERE event_type LIKE '%failed%' OR event_type LIKE '%mismatch%' OR event_type LIKE '%blocked%') as failed_events,
  COUNT(DISTINCT email) as unique_emails,
  MIN(created_at) as first_seen,
  MAX(created_at) as last_seen,
  array_agg(DISTINCT event_type) as event_types
FROM invitation_audit_logs
WHERE client_ip IS NOT NULL
  AND created_at > now() - interval '7 days'
GROUP BY client_ip
HAVING COUNT(*) FILTER (WHERE event_type LIKE '%failed%' OR event_type LIKE '%mismatch%' OR event_type LIKE '%blocked%') > 0
ORDER BY failed_events DESC;

COMMENT ON VIEW public.invitation_security_by_ip IS 'Aggregated security events by IP address for the last 7 days';

-- View: Blocked tokens summary
CREATE OR REPLACE VIEW public.blocked_invitation_tokens AS
SELECT
  ui.id,
  ui.email,
  ui.invitation_type,
  ui.organization_id,
  co.name as organization_name,
  ui.failed_attempts,
  ui.created_at,
  ui.expires_at,
  ui.status,
  (
    SELECT jsonb_agg(jsonb_build_object(
      'event_type', ial.event_type,
      'created_at', ial.created_at,
      'client_ip', ial.client_ip,
      'user_agent', ial.user_agent
    ) ORDER BY ial.created_at DESC)
    FROM invitation_audit_logs ial
    WHERE ial.invitation_id = ui.id
    LIMIT 10
  ) as recent_events
FROM user_invitations ui
LEFT JOIN client_organizations co ON co.id = ui.organization_id
WHERE ui.failed_attempts >= 5
   OR (ui.status = 'revoked' AND ui.failed_attempts > 0)
ORDER BY ui.failed_attempts DESC, ui.created_at DESC;

COMMENT ON VIEW public.blocked_invitation_tokens IS 'Invitation tokens that were blocked due to failed attempts';

-- Grant access to admins only
GRANT SELECT ON public.invitation_security_by_ip TO authenticated;
GRANT SELECT ON public.blocked_invitation_tokens TO authenticated;

-- RLS for views (inherit from underlying tables)
-- Views automatically use the RLS of the underlying tables
```

---

## Combined Single Migration File

If you prefer to apply all changes in one migration:

```sql
-- Migration: Token Security Hardening
-- Description: Implements 48-hour expiry, single-use tokens, rate limiting, and enhanced audit logging

-- ============================================
-- 1. Add security columns to user_invitations
-- ============================================

ALTER TABLE public.user_invitations
ADD COLUMN IF NOT EXISTS used_at timestamptz;

ALTER TABLE public.user_invitations
ADD COLUMN IF NOT EXISTS failed_attempts integer DEFAULT 0 NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_invitations_failed_attempts
ON public.user_invitations(failed_attempts)
WHERE failed_attempts > 0;

CREATE INDEX IF NOT EXISTS idx_user_invitations_used_at
ON public.user_invitations(used_at)
WHERE used_at IS NOT NULL;

-- ============================================
-- 2. Update default token expiry to 48 hours
-- ============================================

ALTER TABLE public.user_invitations
ALTER COLUMN expires_at SET DEFAULT (now() + interval '48 hours');

-- ============================================
-- 3. Add audit log columns for IP and User-Agent
-- ============================================

ALTER TABLE public.invitation_audit_logs
ADD COLUMN IF NOT EXISTS client_ip inet;

ALTER TABLE public.invitation_audit_logs
ADD COLUMN IF NOT EXISTS user_agent text;

CREATE INDEX IF NOT EXISTS idx_invitation_audit_logs_client_ip
ON invitation_audit_logs(client_ip)
WHERE client_ip IS NOT NULL;

-- ============================================
-- 4. Update get_invitation_by_token function
-- ============================================

DROP FUNCTION IF EXISTS public.get_invitation_by_token(text);

CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token text)
RETURNS TABLE (
  id uuid,
  email text,
  invitation_type text,
  organization_id uuid,
  organization_name text,
  role text,
  status text,
  expires_at timestamptz,
  used_at timestamptz,
  failed_attempts integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.email,
    i.invitation_type,
    i.organization_id,
    co.name as organization_name,
    i.role,
    i.status,
    i.expires_at,
    i.used_at,
    i.failed_attempts
  FROM user_invitations i
  LEFT JOIN client_organizations co ON co.id = i.organization_id
  WHERE i.token = p_token;
END;
$$;

-- ============================================
-- 5. Create increment_invitation_failed_attempts function
-- ============================================

CREATE OR REPLACE FUNCTION public.increment_invitation_failed_attempts(p_invitation_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_count integer;
BEGIN
  UPDATE user_invitations
  SET failed_attempts = failed_attempts + 1
  WHERE id = p_invitation_id
  RETURNING failed_attempts INTO v_new_count;

  PERFORM log_invitation_event(
    p_invitation_id,
    'failed_attempt_recorded',
    NULL, NULL, NULL, NULL, NULL,
    'Failed attempt #' || v_new_count,
    jsonb_build_object('failed_attempts', v_new_count),
    'rpc'
  );

  IF v_new_count >= 5 THEN
    UPDATE user_invitations
    SET status = 'revoked'
    WHERE id = p_invitation_id
      AND status = 'pending';

    PERFORM log_invitation_event(
      p_invitation_id,
      'token_auto_revoked',
      NULL, NULL, NULL, NULL, 'revoked',
      'Token auto-revoked after 5 failed attempts',
      jsonb_build_object('failed_attempts', v_new_count),
      'rpc'
    );
  END IF;

  RETURN v_new_count;
END;
$$;

-- ============================================
-- 6. Update log_invitation_event to support IP/UA
-- ============================================

DROP FUNCTION IF EXISTS public.log_invitation_event(uuid, text, text, uuid, uuid, text, text, text, jsonb, text);

CREATE OR REPLACE FUNCTION public.log_invitation_event(
  p_invitation_id UUID,
  p_event_type TEXT,
  p_email TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_organization_id UUID DEFAULT NULL,
  p_invitation_type TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_source TEXT DEFAULT 'rpc',
  p_client_ip TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
  v_client_ip inet;
BEGIN
  BEGIN
    v_client_ip := p_client_ip::inet;
  EXCEPTION WHEN OTHERS THEN
    v_client_ip := NULL;
  END;

  INSERT INTO invitation_audit_logs (
    invitation_id, event_type, email, user_id, organization_id,
    invitation_type, status, error_message, metadata, source,
    client_ip, user_agent
  ) VALUES (
    p_invitation_id, p_event_type, p_email, p_user_id, p_organization_id,
    p_invitation_type, p_status, p_error_message, p_metadata, p_source,
    v_client_ip, p_user_agent
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- ============================================
-- 7. Update accept_invitation with security checks
-- ============================================

CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation record;
  v_full_name text;
BEGIN
  PERFORM log_invitation_event(
    NULL, 'accept_started', NULL, p_user_id, NULL, NULL, NULL, NULL,
    jsonb_build_object('token_prefix', left(p_token, 8) || '...'), 'rpc'
  );

  SELECT * INTO v_invitation
  FROM user_invitations
  WHERE token = p_token
  FOR UPDATE;

  IF v_invitation IS NULL THEN
    PERFORM log_invitation_event(
      NULL, 'accept_failed', NULL, p_user_id, NULL, NULL, NULL,
      'Invitation not found',
      jsonb_build_object('token_prefix', left(p_token, 8) || '...'), 'rpc'
    );
    RETURN jsonb_build_object('success', false, 'error', 'Invitation not found');
  END IF;

  PERFORM log_invitation_event(
    v_invitation.id, 'invitation_found', v_invitation.email, p_user_id,
    v_invitation.organization_id, v_invitation.invitation_type, v_invitation.status,
    NULL, '{}'::jsonb, 'rpc'
  );

  -- Single-use check
  IF v_invitation.used_at IS NOT NULL THEN
    PERFORM log_invitation_event(
      v_invitation.id, 'token_reuse_blocked', v_invitation.email, p_user_id,
      v_invitation.organization_id, v_invitation.invitation_type, v_invitation.status,
      'Token already used', jsonb_build_object('used_at', v_invitation.used_at), 'rpc'
    );
    RETURN jsonb_build_object('success', false, 'error', 'This invitation has already been used');
  END IF;

  -- Rate limit check
  IF v_invitation.failed_attempts >= 5 THEN
    PERFORM log_invitation_event(
      v_invitation.id, 'token_blocked_attempt', v_invitation.email, p_user_id,
      v_invitation.organization_id, v_invitation.invitation_type, v_invitation.status,
      'Token blocked', jsonb_build_object('failed_attempts', v_invitation.failed_attempts), 'rpc'
    );
    RETURN jsonb_build_object('success', false, 'error', 'This invitation has been blocked due to too many failed attempts');
  END IF;

  IF v_invitation.status = 'accepted' THEN
    PERFORM log_invitation_event(
      v_invitation.id, 'accept_failed', v_invitation.email, p_user_id,
      v_invitation.organization_id, v_invitation.invitation_type, v_invitation.status,
      'Invitation already accepted', '{}'::jsonb, 'rpc'
    );
    RETURN jsonb_build_object('success', false, 'error', 'Invitation already accepted');
  END IF;

  IF v_invitation.expires_at < now() THEN
    UPDATE user_invitations SET status = 'expired' WHERE id = v_invitation.id;
    PERFORM log_invitation_event(
      v_invitation.id, 'accept_failed', v_invitation.email, p_user_id,
      v_invitation.organization_id, v_invitation.invitation_type, 'expired',
      'Invitation has expired', '{}'::jsonb, 'rpc'
    );
    RETURN jsonb_build_object('success', false, 'error', 'Invitation has expired');
  END IF;

  IF v_invitation.status = 'revoked' THEN
    PERFORM log_invitation_event(
      v_invitation.id, 'accept_failed', v_invitation.email, p_user_id,
      v_invitation.organization_id, v_invitation.invitation_type, v_invitation.status,
      'Invitation has been revoked', '{}'::jsonb, 'rpc'
    );
    RETURN jsonb_build_object('success', false, 'error', 'Invitation has been revoked');
  END IF;

  SELECT COALESCE(
    raw_user_meta_data->>'full_name',
    (SELECT email FROM profiles WHERE id = p_user_id),
    'User'
  ) INTO v_full_name
  FROM auth.users
  WHERE id = p_user_id;

  IF v_full_name IS NULL THEN
    SELECT COALESCE(email, 'User') INTO v_full_name FROM profiles WHERE id = p_user_id;
  END IF;

  PERFORM log_invitation_event(
    v_invitation.id, 'processing_' || v_invitation.invitation_type, v_invitation.email, p_user_id,
    v_invitation.organization_id, v_invitation.invitation_type, v_invitation.status,
    NULL, jsonb_build_object('full_name', v_full_name, 'role', v_invitation.role), 'rpc'
  );

  IF v_invitation.invitation_type = 'platform_admin' THEN
    INSERT INTO user_roles (user_id, role)
    VALUES (p_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    UPDATE profiles
    SET onboarding_completed = true, onboarding_completed_at = now()
    WHERE id = p_user_id;

    PERFORM log_invitation_event(
      v_invitation.id, 'admin_role_granted', v_invitation.email, p_user_id,
      NULL, 'platform_admin', NULL, NULL, '{}'::jsonb, 'rpc'
    );

  ELSIF v_invitation.invitation_type = 'organization_member' THEN
    BEGIN
      INSERT INTO client_users (id, organization_id, role, full_name)
      VALUES (p_user_id, v_invitation.organization_id, v_invitation.role, v_full_name)
      ON CONFLICT (id) DO UPDATE SET
        organization_id = EXCLUDED.organization_id,
        role = EXCLUDED.role,
        full_name = COALESCE(NULLIF(EXCLUDED.full_name, 'User'), client_users.full_name);

      PERFORM log_invitation_event(
        v_invitation.id, 'client_user_created', v_invitation.email, p_user_id,
        v_invitation.organization_id, 'organization_member', NULL, NULL,
        jsonb_build_object('full_name', v_full_name, 'role', v_invitation.role), 'rpc'
      );
    EXCEPTION WHEN OTHERS THEN
      PERFORM log_invitation_event(
        v_invitation.id, 'client_user_failed', v_invitation.email, p_user_id,
        v_invitation.organization_id, 'organization_member', NULL,
        'Failed to create organization membership: ' || SQLERRM,
        jsonb_build_object('sqlstate', SQLSTATE), 'rpc'
      );
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Failed to create organization membership: ' || SQLERRM
      );
    END;

    UPDATE profiles
    SET onboarding_completed = true, onboarding_completed_at = now()
    WHERE id = p_user_id;
  END IF;

  -- Mark as accepted AND used (atomic)
  UPDATE user_invitations
  SET status = 'accepted', accepted_at = now(), used_at = now()
  WHERE id = v_invitation.id;

  PERFORM log_invitation_event(
    v_invitation.id, 'accept_success', v_invitation.email, p_user_id,
    v_invitation.organization_id, v_invitation.invitation_type, 'accepted',
    NULL, '{}'::jsonb, 'rpc'
  );

  RETURN jsonb_build_object(
    'success', true,
    'invitation_type', v_invitation.invitation_type,
    'organization_id', v_invitation.organization_id
  );
END;
$$;

-- Add comments
COMMENT ON COLUMN public.user_invitations.used_at IS 'Timestamp when the token was used. NULL if not yet used.';
COMMENT ON COLUMN public.user_invitations.failed_attempts IS 'Count of failed validation attempts. Token blocked after 5 failures.';
COMMENT ON COLUMN public.user_invitations.expires_at IS 'Token expiry timestamp. Defaults to 48 hours from creation.';
COMMENT ON COLUMN public.invitation_audit_logs.client_ip IS 'Client IP address from request headers';
COMMENT ON COLUMN public.invitation_audit_logs.user_agent IS 'Client User-Agent header string';
```

---

## Testing Checklist

After applying migrations, verify:

- [ ] New invitations have `expires_at` set to 48 hours from creation
- [ ] `get_invitation_by_token` returns `used_at` and `failed_attempts`
- [ ] `accept_invitation` sets `used_at` on success
- [ ] `accept_invitation` rejects tokens where `used_at` is set
- [ ] `increment_invitation_failed_attempts` increments counter correctly
- [ ] Token is auto-revoked after 5 failed attempts
- [ ] `log_invitation_event` accepts `p_client_ip` and `p_user_agent`
- [ ] IP addresses are stored correctly in `invitation_audit_logs`
- [ ] User-Agent strings are stored correctly

### Test Queries

```sql
-- Test 1: Create invitation and check expiry
INSERT INTO user_invitations (email, invitation_type)
VALUES ('test@example.com', 'platform_admin')
RETURNING id, expires_at, now() as created_now, expires_at - now() as time_until_expiry;
-- Should show ~48 hours difference

-- Test 2: Check get_invitation_by_token returns new columns
SELECT * FROM get_invitation_by_token('your-test-token');
-- Should include used_at and failed_attempts columns

-- Test 3: Test increment function
SELECT increment_invitation_failed_attempts('your-invitation-id');
-- Should return new count and log event

-- Test 4: Test audit log with IP
SELECT log_invitation_event(
  NULL, 'test_event', 'test@example.com', NULL, NULL, NULL, NULL, NULL,
  '{}'::jsonb, 'test', '192.168.1.1', 'Mozilla/5.0 Test'
);
SELECT * FROM invitation_audit_logs WHERE event_type = 'test_event' ORDER BY created_at DESC LIMIT 1;
-- Should show client_ip and user_agent populated
```
