-- Phase 2 Security Hardening Migration (Corrected)
-- Uses user_roles table for admin check

-- =============================================
-- 1. Login Attempts Tracking Table
-- =============================================
CREATE TABLE IF NOT EXISTS public.login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN NOT NULL DEFAULT false,
    failure_reason TEXT,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time 
ON public.login_attempts(email, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time 
ON public.login_attempts(ip_address, attempted_at DESC);

-- Enable RLS
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if exists
DROP POLICY IF EXISTS "Platform admins can view login attempts" ON public.login_attempts;

-- Only platform admins can view login attempts
CREATE POLICY "Platform admins can view login attempts"
ON public.login_attempts FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
);

-- =============================================
-- 2. Account Lockouts - Update RLS
-- =============================================
DROP POLICY IF EXISTS "Platform admins can manage lockouts" ON public.account_lockouts;

CREATE POLICY "Platform admins can manage lockouts"
ON public.account_lockouts FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
);

-- =============================================
-- 3. Fix Invite Code Race Condition
-- =============================================
CREATE OR REPLACE FUNCTION public.verify_and_use_admin_invite(
    p_code TEXT,
    p_user_id UUID
)
RETURNS TABLE (
    is_valid BOOLEAN,
    error_message TEXT,
    invite_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_invite RECORD;
BEGIN
    -- Lock the row to prevent race conditions
    SELECT * INTO v_invite
    FROM public.admin_invite_codes
    WHERE code = p_code
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND used_at IS NULL
    FOR UPDATE SKIP LOCKED;
    
    IF v_invite IS NULL THEN
        SELECT * INTO v_invite
        FROM public.admin_invite_codes
        WHERE code = p_code;
        
        IF v_invite IS NULL THEN
            RETURN QUERY SELECT false, 'Invalid invite code'::TEXT, NULL::UUID;
            RETURN;
        ELSIF v_invite.used_at IS NOT NULL THEN
            RETURN QUERY SELECT false, 'Invite code has already been used'::TEXT, NULL::UUID;
            RETURN;
        ELSIF v_invite.expires_at IS NOT NULL AND v_invite.expires_at <= now() THEN
            RETURN QUERY SELECT false, 'Invite code has expired'::TEXT, NULL::UUID;
            RETURN;
        ELSIF NOT v_invite.is_active THEN
            RETURN QUERY SELECT false, 'Invite code is no longer active'::TEXT, NULL::UUID;
            RETURN;
        ELSE
            RETURN QUERY SELECT false, 'Invite code is being processed, please try again'::TEXT, NULL::UUID;
            RETURN;
        END IF;
    END IF;
    
    UPDATE public.admin_invite_codes
    SET used_at = now(),
        used_by = p_user_id,
        is_active = false
    WHERE id = v_invite.id;
    
    RETURN QUERY SELECT true, NULL::TEXT, v_invite.id;
END;
$$;

-- =============================================
-- 4. Password Strength Validation Function
-- =============================================
CREATE OR REPLACE FUNCTION public.validate_password_strength(
    p_password TEXT
)
RETURNS TABLE (
    is_valid BOOLEAN,
    score INTEGER,
    issues TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_issues TEXT[] := '{}';
    v_score INTEGER := 0;
BEGIN
    IF length(p_password) < 12 THEN
        v_issues := array_append(v_issues, 'Password must be at least 12 characters');
    ELSE
        v_score := v_score + 20;
    END IF;
    
    IF length(p_password) > 128 THEN
        v_issues := array_append(v_issues, 'Password must be less than 128 characters');
    END IF;
    
    IF p_password ~ '[a-z]' THEN
        v_score := v_score + 20;
    ELSE
        v_issues := array_append(v_issues, 'Password must contain at least one lowercase letter');
    END IF;
    
    IF p_password ~ '[A-Z]' THEN
        v_score := v_score + 20;
    ELSE
        v_issues := array_append(v_issues, 'Password must contain at least one uppercase letter');
    END IF;
    
    IF p_password ~ '[0-9]' THEN
        v_score := v_score + 20;
    ELSE
        v_issues := array_append(v_issues, 'Password must contain at least one number');
    END IF;
    
    IF p_password ~ '[!@#$%^&*(),.?":{}|<>]' THEN
        v_score := v_score + 20;
    ELSE
        v_issues := array_append(v_issues, 'Password must contain at least one special character');
    END IF;
    
    IF lower(p_password) ~ '(password|123456|qwerty|admin|letmein|welcome|monkey|dragon)' THEN
        v_issues := array_append(v_issues, 'Password contains a common pattern');
        v_score := v_score - 20;
    END IF;
    
    RETURN QUERY SELECT array_length(v_issues, 1) IS NULL OR array_length(v_issues, 1) = 0, 
                        GREATEST(0, v_score), 
                        v_issues;
END;
$$;

-- =============================================
-- 5. Check Account Lockout Status Function
-- =============================================
CREATE OR REPLACE FUNCTION public.check_account_lockout(
    p_email TEXT
)
RETURNS TABLE (
    is_locked BOOLEAN,
    unlock_at TIMESTAMPTZ,
    reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_lockout RECORD;
BEGIN
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = lower(p_email);
    
    IF v_user_id IS NULL THEN
        RETURN QUERY SELECT false, NULL::TIMESTAMPTZ, NULL::TEXT;
        RETURN;
    END IF;
    
    SELECT * INTO v_lockout
    FROM public.account_lockouts
    WHERE user_id = v_user_id
    AND is_active = true
    AND account_lockouts.unlock_at > now()
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_lockout IS NOT NULL THEN
        RETURN QUERY SELECT true, v_lockout.unlock_at, v_lockout.reason;
    ELSE
        RETURN QUERY SELECT false, NULL::TIMESTAMPTZ, NULL::TEXT;
    END IF;
END;
$$;

-- =============================================
-- 6. Record Login Attempt Function
-- =============================================
CREATE OR REPLACE FUNCTION public.record_login_attempt(
    p_email TEXT,
    p_ip_address INET,
    p_user_agent TEXT,
    p_success BOOLEAN,
    p_failure_reason TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_failed_count INTEGER;
    v_lockout_threshold INTEGER := 5;
    v_lockout_duration INTERVAL := '30 minutes';
BEGIN
    INSERT INTO public.login_attempts (email, ip_address, user_agent, success, failure_reason)
    VALUES (lower(p_email), p_ip_address, p_user_agent, p_success, p_failure_reason);
    
    IF p_success THEN
        RETURN;
    END IF;
    
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = lower(p_email);
    
    IF v_user_id IS NULL THEN
        RETURN;
    END IF;
    
    SELECT COUNT(*) INTO v_failed_count
    FROM public.login_attempts
    WHERE email = lower(p_email)
    AND success = false
    AND attempted_at > now() - INTERVAL '1 hour';
    
    IF v_failed_count >= v_lockout_threshold THEN
        UPDATE public.account_lockouts
        SET is_active = false
        WHERE user_id = v_user_id AND is_active = true;
        
        INSERT INTO public.account_lockouts (user_id, failed_attempts, unlock_at, reason)
        VALUES (v_user_id, v_failed_count, now() + v_lockout_duration, 'Too many failed login attempts');
    END IF;
END;
$$;