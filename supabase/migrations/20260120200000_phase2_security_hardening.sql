-- Phase 2: Security Hardening Migration
-- Fixes race conditions, adds account lockout, and improves audit logging

-- ============================================
-- 2.1 Fix Race Condition in Invite Code Verification
-- ============================================

CREATE OR REPLACE FUNCTION public.verify_admin_invite_code(invite_code text, user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  code_record admin_invite_codes;
BEGIN
  -- Use FOR UPDATE SKIP LOCKED to prevent race conditions
  -- If another transaction has locked this row, skip it (return false)
  SELECT * INTO code_record
  FROM admin_invite_codes
  WHERE code = invite_code
    AND is_active = true
    AND used_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  FOR UPDATE SKIP LOCKED;

  -- If code doesn't exist, is already used, expired, or locked by another transaction
  IF code_record IS NULL THEN
    RETURN false;
  END IF;

  -- Atomically mark code as used
  UPDATE admin_invite_codes
  SET used_at = now(),
      used_by = user_id
  WHERE id = code_record.id
    AND used_at IS NULL;  -- Double-check it wasn't used

  -- Verify the update succeeded
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Add admin role to user
  INSERT INTO user_roles (user_id, role)
  VALUES (user_id, 'admin'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN true;
END;
$$;

-- ============================================
-- 2.2 Account Lockout System
-- ============================================

-- Table to track failed login attempts
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_created
ON public.login_attempts(email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_created
ON public.login_attempts(ip_address, created_at DESC);

-- Table to track account lockouts
CREATE TABLE IF NOT EXISTS public.account_lockouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  locked_at TIMESTAMPTZ DEFAULT now(),
  locked_until TIMESTAMPTZ NOT NULL,
  lock_reason TEXT DEFAULT 'too_many_failed_attempts',
  failed_attempt_count INTEGER DEFAULT 0,
  unlocked_at TIMESTAMPTZ,
  unlocked_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_lockouts_email
ON public.account_lockouts(email);

CREATE INDEX IF NOT EXISTS idx_account_lockouts_locked_until
ON public.account_lockouts(locked_until) WHERE unlocked_at IS NULL;

-- Function to record login attempt
CREATE OR REPLACE FUNCTION public.record_login_attempt(
  p_email TEXT,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_success BOOLEAN DEFAULT false,
  p_failure_reason TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_failed_count INTEGER;
  v_lockout_threshold INTEGER := 5;  -- Lock after 5 failed attempts
  v_lockout_window_minutes INTEGER := 15;  -- Within 15 minutes
  v_lockout_duration_minutes INTEGER := 30;  -- Lock for 30 minutes
  v_is_locked BOOLEAN := false;
  v_locked_until TIMESTAMPTZ;
BEGIN
  -- Check if account is already locked
  SELECT locked_until INTO v_locked_until
  FROM account_lockouts
  WHERE email = lower(p_email)
    AND unlocked_at IS NULL
    AND locked_until > now();

  IF v_locked_until IS NOT NULL THEN
    RETURN json_build_object(
      'success', false,
      'locked', true,
      'locked_until', v_locked_until,
      'message', 'Account is temporarily locked'
    );
  END IF;

  -- Record the attempt
  INSERT INTO login_attempts (email, ip_address, user_agent, success, failure_reason)
  VALUES (lower(p_email), p_ip_address, p_user_agent, p_success, p_failure_reason);

  -- If successful, clear any existing lockout
  IF p_success THEN
    UPDATE account_lockouts
    SET unlocked_at = now()
    WHERE email = lower(p_email)
      AND unlocked_at IS NULL;

    RETURN json_build_object('success', true, 'locked', false);
  END IF;

  -- Count recent failed attempts
  SELECT COUNT(*) INTO v_failed_count
  FROM login_attempts
  WHERE email = lower(p_email)
    AND success = false
    AND created_at > now() - (v_lockout_window_minutes || ' minutes')::interval;

  -- Check if we need to lock the account
  IF v_failed_count >= v_lockout_threshold THEN
    v_locked_until := now() + (v_lockout_duration_minutes || ' minutes')::interval;

    INSERT INTO account_lockouts (email, locked_until, failed_attempt_count)
    VALUES (lower(p_email), v_locked_until, v_failed_count)
    ON CONFLICT (email)
    DO UPDATE SET
      locked_at = now(),
      locked_until = EXCLUDED.locked_until,
      failed_attempt_count = EXCLUDED.failed_attempt_count,
      unlocked_at = NULL;

    v_is_locked := true;
  END IF;

  RETURN json_build_object(
    'success', false,
    'locked', v_is_locked,
    'locked_until', v_locked_until,
    'failed_attempts', v_failed_count,
    'remaining_attempts', GREATEST(0, v_lockout_threshold - v_failed_count)
  );
END;
$$;

-- Function to check if account is locked
CREATE OR REPLACE FUNCTION public.is_account_locked(p_email TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lockout RECORD;
BEGIN
  SELECT * INTO v_lockout
  FROM account_lockouts
  WHERE email = lower(p_email)
    AND unlocked_at IS NULL
    AND locked_until > now();

  IF v_lockout IS NULL THEN
    RETURN json_build_object('locked', false);
  END IF;

  RETURN json_build_object(
    'locked', true,
    'locked_until', v_lockout.locked_until,
    'reason', v_lockout.lock_reason
  );
END;
$$;

-- Function to manually unlock an account (admin only)
CREATE OR REPLACE FUNCTION public.unlock_account(p_email TEXT, p_admin_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verify admin has permission
  IF NOT public.has_role(p_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;

  UPDATE account_lockouts
  SET unlocked_at = now(),
      unlocked_by = p_admin_id
  WHERE email = lower(p_email)
    AND unlocked_at IS NULL;

  -- Log the action
  INSERT INTO admin_audit_logs (user_id, action_type, table_affected, new_value)
  VALUES (
    p_admin_id,
    'account_unlocked',
    'account_lockouts',
    json_build_object('email', p_email)
  );

  RETURN FOUND;
END;
$$;

-- ============================================
-- 2.3 Password Policy Enforcement
-- ============================================

-- Function to validate password strength (called from Edge Functions)
CREATE OR REPLACE FUNCTION public.validate_password_strength(p_password TEXT)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_errors TEXT[] := '{}';
  v_score INTEGER := 0;
BEGIN
  -- Minimum length (12 characters for enterprise)
  IF length(p_password) < 12 THEN
    v_errors := array_append(v_errors, 'Password must be at least 12 characters long');
  ELSE
    v_score := v_score + 1;
  END IF;

  -- Require uppercase
  IF p_password !~ '[A-Z]' THEN
    v_errors := array_append(v_errors, 'Password must contain at least one uppercase letter');
  ELSE
    v_score := v_score + 1;
  END IF;

  -- Require lowercase
  IF p_password !~ '[a-z]' THEN
    v_errors := array_append(v_errors, 'Password must contain at least one lowercase letter');
  ELSE
    v_score := v_score + 1;
  END IF;

  -- Require number
  IF p_password !~ '[0-9]' THEN
    v_errors := array_append(v_errors, 'Password must contain at least one number');
  ELSE
    v_score := v_score + 1;
  END IF;

  -- Require special character
  IF p_password !~ '[!@#$%^&*(),.?":{}|<>]' THEN
    v_errors := array_append(v_errors, 'Password must contain at least one special character');
  ELSE
    v_score := v_score + 1;
  END IF;

  -- Check for common patterns
  IF p_password ~* '(password|123456|qwerty|admin|letmein)' THEN
    v_errors := array_append(v_errors, 'Password contains common patterns that are not allowed');
  END IF;

  RETURN json_build_object(
    'valid', array_length(v_errors, 1) IS NULL,
    'errors', v_errors,
    'score', v_score,
    'strength', CASE
      WHEN v_score >= 5 THEN 'strong'
      WHEN v_score >= 3 THEN 'medium'
      ELSE 'weak'
    END
  );
END;
$$;

-- ============================================
-- 2.4 Session Management Improvements
-- ============================================

-- Table to track active sessions for audit
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token_hash TEXT NOT NULL,  -- Store hash, not actual token
  ip_address TEXT,
  user_agent TEXT,
  device_info JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_active_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  terminated_at TIMESTAMPTZ,
  terminated_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id
ON public.user_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_active
ON public.user_sessions(user_id, expires_at)
WHERE terminated_at IS NULL;

-- Function to terminate all sessions for a user
CREATE OR REPLACE FUNCTION public.terminate_user_sessions(
  p_user_id UUID,
  p_admin_id UUID,
  p_reason TEXT DEFAULT 'admin_action'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Verify admin has permission (or user is terminating own sessions)
  IF p_admin_id != p_user_id AND NOT public.has_role(p_admin_id, 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required to terminate other user sessions';
  END IF;

  UPDATE user_sessions
  SET terminated_at = now(),
      terminated_reason = p_reason
  WHERE user_id = p_user_id
    AND terminated_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Log the action
  INSERT INTO admin_audit_logs (user_id, action_type, table_affected, record_id, new_value)
  VALUES (
    p_admin_id,
    'sessions_terminated',
    'user_sessions',
    p_user_id,
    json_build_object('sessions_terminated', v_count, 'reason', p_reason)
  );

  RETURN v_count;
END;
$$;

-- ============================================
-- 2.5 Enhanced Audit Logging
-- ============================================

-- Add indexes for better audit log queries
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_user_action
ON public.admin_audit_logs(user_id, action_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_table_record
ON public.admin_audit_logs(table_affected, record_id);

-- ============================================
-- 2.6 RLS Policies for New Tables
-- ============================================

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_lockouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Login attempts: Admins can view all, service role can insert
CREATE POLICY "Admins can view login attempts"
ON public.login_attempts FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Account lockouts: Admins can manage
CREATE POLICY "Admins can view lockouts"
ON public.account_lockouts FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage lockouts"
ON public.account_lockouts FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- User sessions: Users can view own, admins can view all
CREATE POLICY "Users can view own sessions"
ON public.user_sessions FOR SELECT
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============================================
-- 2.7 Cleanup Job for Old Data
-- ============================================

-- Function to clean up old login attempts (keep 90 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_login_attempts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM login_attempts
  WHERE created_at < now() - interval '90 days';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
