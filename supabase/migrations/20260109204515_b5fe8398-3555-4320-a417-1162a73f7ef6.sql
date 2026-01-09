-- =====================================================
-- PHASE 1: Enterprise Security Features Migration
-- =====================================================

-- 1. Session Revocation Log for Force Logout
CREATE TABLE public.session_revocation_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    revoked_by UUID NOT NULL REFERENCES auth.users(id),
    revoked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason TEXT,
    sessions_terminated INTEGER DEFAULT 0
);

ALTER TABLE public.session_revocation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view session revocations"
ON public.session_revocation_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert session revocations"
ON public.session_revocation_log
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add session_revoked_at to profiles for quick check
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS session_revoked_at TIMESTAMPTZ;

-- 2. Account Lockouts Table
CREATE TABLE public.account_lockouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    unlock_at TIMESTAMPTZ NOT NULL,
    reason TEXT NOT NULL DEFAULT 'Too many failed login attempts',
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    unlocked_by UUID REFERENCES auth.users(id),
    unlocked_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.account_lockouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage account lockouts"
ON public.account_lockouts
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own lockouts"
ON public.account_lockouts
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Index for quick lookups
CREATE INDEX idx_account_lockouts_user_active 
ON public.account_lockouts(user_id, is_active) 
WHERE is_active = true;

-- 3. Function to check if account is locked
CREATE OR REPLACE FUNCTION public.is_account_locked(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.account_lockouts
        WHERE user_id = _user_id
        AND is_active = true
        AND unlock_at > now()
    );
$$;

-- 4. Function to check recent failed attempts and auto-lock
CREATE OR REPLACE FUNCTION public.check_failed_attempts_and_lock(_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    failed_count INTEGER;
    existing_lock RECORD;
    lockout_minutes INTEGER := 30;
    max_attempts INTEGER := 5;
    window_minutes INTEGER := 15;
BEGIN
    -- Check if already locked
    SELECT * INTO existing_lock
    FROM public.account_lockouts
    WHERE user_id = _user_id
    AND is_active = true
    AND unlock_at > now()
    LIMIT 1;
    
    IF existing_lock IS NOT NULL THEN
        RETURN jsonb_build_object(
            'locked', true,
            'unlock_at', existing_lock.unlock_at,
            'reason', existing_lock.reason
        );
    END IF;
    
    -- Count failed attempts in window
    SELECT COUNT(*) INTO failed_count
    FROM public.login_history
    WHERE user_id = _user_id
    AND success = false
    AND created_at > now() - (window_minutes || ' minutes')::interval;
    
    -- If exceeded, create lockout
    IF failed_count >= max_attempts THEN
        INSERT INTO public.account_lockouts (user_id, unlock_at, failed_attempts, reason)
        VALUES (
            _user_id, 
            now() + (lockout_minutes || ' minutes')::interval,
            failed_count,
            'Account locked due to ' || failed_count || ' failed login attempts'
        );
        
        RETURN jsonb_build_object(
            'locked', true,
            'unlock_at', now() + (lockout_minutes || ' minutes')::interval,
            'reason', 'Account locked due to ' || failed_count || ' failed login attempts',
            'just_locked', true
        );
    END IF;
    
    RETURN jsonb_build_object(
        'locked', false,
        'attempts', failed_count,
        'remaining', max_attempts - failed_count
    );
END;
$$;

-- 5. Function to unlock account (admin only)
CREATE OR REPLACE FUNCTION public.unlock_account(_user_id UUID, _admin_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verify caller is admin
    IF NOT public.has_role(_admin_id, 'admin') THEN
        RAISE EXCEPTION 'Only admins can unlock accounts';
    END IF;
    
    UPDATE public.account_lockouts
    SET is_active = false,
        unlocked_by = _admin_id,
        unlocked_at = now()
    WHERE user_id = _user_id
    AND is_active = true;
    
    RETURN true;
END;
$$;

-- 6. MFA Configuration Columns
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS mfa_enabled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS mfa_method TEXT CHECK (mfa_method IN ('totp', 'phone', NULL));

-- 7. Organization-level MFA enforcement
ALTER TABLE public.client_organizations
ADD COLUMN IF NOT EXISTS mfa_required BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS mfa_grace_period_days INTEGER DEFAULT 7;

-- 8. MFA Enrollment Log for audit
CREATE TABLE public.mfa_enrollment_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('enrolled', 'unenrolled', 'verified', 'failed')),
    method TEXT NOT NULL,
    performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_address TEXT,
    user_agent TEXT
);

ALTER TABLE public.mfa_enrollment_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own MFA log"
ON public.mfa_enrollment_log
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all MFA logs"
ON public.mfa_enrollment_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert MFA logs"
ON public.mfa_enrollment_log
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- 9. Function to check if user needs MFA
CREATE OR REPLACE FUNCTION public.user_needs_mfa(_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    profile_rec RECORD;
    org_requires_mfa BOOLEAN := false;
    grace_period_end TIMESTAMPTZ;
BEGIN
    -- Get user profile
    SELECT mfa_enabled_at, mfa_method, created_at
    INTO profile_rec
    FROM public.profiles
    WHERE id = _user_id;
    
    -- If already has MFA, no action needed
    IF profile_rec.mfa_enabled_at IS NOT NULL THEN
        RETURN jsonb_build_object(
            'needs_mfa', false,
            'has_mfa', true,
            'method', profile_rec.mfa_method
        );
    END IF;
    
    -- Check if any org requires MFA
    SELECT 
        co.mfa_required,
        profile_rec.created_at + (co.mfa_grace_period_days || ' days')::interval
    INTO org_requires_mfa, grace_period_end
    FROM public.client_users cu
    JOIN public.client_organizations co ON cu.organization_id = co.id
    WHERE cu.id = _user_id
    AND co.mfa_required = true
    LIMIT 1;
    
    IF org_requires_mfa THEN
        RETURN jsonb_build_object(
            'needs_mfa', true,
            'has_mfa', false,
            'required_by_org', true,
            'grace_period_end', grace_period_end,
            'in_grace_period', grace_period_end > now()
        );
    END IF;
    
    RETURN jsonb_build_object(
        'needs_mfa', false,
        'has_mfa', false,
        'required_by_org', false
    );
END;
$$;