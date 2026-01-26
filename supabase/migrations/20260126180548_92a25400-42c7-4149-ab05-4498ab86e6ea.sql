-- ============================================================
-- Enhanced User Management System - Phase 1: Database Schema
-- ============================================================

-- 1. Create user_activity_logs table for tracking in-app actions
CREATE TABLE IF NOT EXISTS public.user_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.client_organizations(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create user_locations table for caching IP geolocation
CREATE TABLE IF NOT EXISTS public.user_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address INET NOT NULL UNIQUE,
    city TEXT,
    region TEXT,
    country TEXT,
    country_name TEXT,
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    timezone TEXT,
    isp TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Add geolocation columns to user_sessions if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_sessions' AND column_name = 'location_id') THEN
        ALTER TABLE public.user_sessions ADD COLUMN location_id UUID REFERENCES public.user_locations(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_sessions' AND column_name = 'city') THEN
        ALTER TABLE public.user_sessions ADD COLUMN city TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_sessions' AND column_name = 'country') THEN
        ALTER TABLE public.user_sessions ADD COLUMN country TEXT;
    END IF;
END $$;

-- 4. Add organization_id to user_sessions if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_sessions' AND column_name = 'organization_id') THEN
        ALTER TABLE public.user_sessions ADD COLUMN organization_id UUID REFERENCES public.client_organizations(id);
    END IF;
END $$;

-- 5. Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_id ON public.user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_org_id ON public.user_activity_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_created_at ON public.user_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_action_type ON public.user_activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_created ON public.user_activity_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_locations_ip ON public.user_locations(ip_address);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON public.user_sessions(user_id, last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_org_id ON public.user_sessions(organization_id);

-- 6. Enable RLS on new tables
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

-- 7. RLS policies for user_activity_logs
-- Users can view their own activity
CREATE POLICY "Users can view own activity"
    ON public.user_activity_logs
    FOR SELECT
    USING (auth.uid() = user_id);

-- Admins can view all activity (using security definer function)
CREATE POLICY "Admins can view all activity"
    ON public.user_activity_logs
    FOR SELECT
    USING (public.has_role(auth.uid(), 'admin'));

-- Allow inserts through authenticated users for their own activity
CREATE POLICY "Users can log own activity"
    ON public.user_activity_logs
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 8. RLS policies for user_locations (cache table - service role only writes, admins read)
CREATE POLICY "Admins can read location cache"
    ON public.user_locations
    FOR SELECT
    USING (public.has_role(auth.uid(), 'admin'));

-- 9. Create admin view for user management with session data
CREATE OR REPLACE VIEW public.admin_user_overview AS
SELECT 
    cu.id,
    cu.full_name,
    cu.organization_id,
    cu.role,
    cu.status,
    cu.created_at,
    cu.last_login_at,
    p.email,
    p.mfa_enabled_at,
    co.name as organization_name,
    (
        SELECT json_build_object(
            'session_id', us.id,
            'last_active_at', us.last_active_at,
            'device_info', us.device_info,
            'ip_address', us.ip_address,
            'city', us.city,
            'country', us.country,
            'is_current', us.is_current
        )
        FROM public.user_sessions us
        WHERE us.user_id = cu.id 
        AND us.is_valid = TRUE
        ORDER BY us.last_active_at DESC
        LIMIT 1
    ) as latest_session,
    (
        SELECT COUNT(*)::INTEGER
        FROM public.user_sessions us
        WHERE us.user_id = cu.id 
        AND us.is_valid = TRUE
        AND us.last_active_at > NOW() - INTERVAL '30 days'
    ) as active_sessions_30d,
    (
        SELECT COUNT(*)::INTEGER
        FROM public.login_attempts la
        WHERE la.email = p.email
        AND la.success = FALSE
        AND la.attempted_at > NOW() - INTERVAL '24 hours'
    ) as failed_logins_24h,
    EXISTS (
        SELECT 1 FROM public.account_lockouts al
        WHERE al.user_id = cu.id
        AND al.is_active = TRUE
    ) as is_locked
FROM public.client_users cu
LEFT JOIN public.profiles p ON p.id = cu.id
LEFT JOIN public.client_organizations co ON co.id = cu.organization_id;

-- 10. Function to get user management data (for admin queries)
CREATE OR REPLACE FUNCTION public.get_user_management_data(
    p_search TEXT DEFAULT NULL,
    p_org_id UUID DEFAULT NULL,
    p_roles TEXT[] DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 25,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    email TEXT,
    organization_id UUID,
    organization_name TEXT,
    role TEXT,
    status TEXT,
    mfa_enabled BOOLEAN,
    created_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    latest_session JSONB,
    active_sessions_30d INTEGER,
    failed_logins_24h INTEGER,
    is_locked BOOLEAN,
    total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_count BIGINT;
BEGIN
    -- Verify caller is admin
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Access denied: Admin role required';
    END IF;

    -- Get total count first
    SELECT COUNT(*) INTO v_total_count
    FROM public.client_users cu
    LEFT JOIN public.profiles p ON p.id = cu.id
    WHERE (p_search IS NULL OR cu.full_name ILIKE '%' || p_search || '%' OR p.email ILIKE '%' || p_search || '%')
      AND (p_org_id IS NULL OR cu.organization_id = p_org_id)
      AND (p_roles IS NULL OR cu.role = ANY(p_roles))
      AND (p_status IS NULL OR cu.status = p_status);

    RETURN QUERY
    SELECT 
        cu.id,
        cu.full_name,
        p.email,
        cu.organization_id,
        co.name as organization_name,
        cu.role,
        cu.status,
        (p.mfa_enabled_at IS NOT NULL) as mfa_enabled,
        cu.created_at,
        cu.last_login_at,
        (
            SELECT json_build_object(
                'session_id', us.id,
                'last_active_at', us.last_active_at,
                'device_info', us.device_info,
                'ip_address', us.ip_address,
                'city', us.city,
                'country', us.country,
                'is_current', us.is_current
            )::jsonb
            FROM public.user_sessions us
            WHERE us.user_id = cu.id 
            AND us.is_valid = TRUE
            ORDER BY us.last_active_at DESC
            LIMIT 1
        ) as latest_session,
        (
            SELECT COUNT(*)::INTEGER
            FROM public.user_sessions us
            WHERE us.user_id = cu.id 
            AND us.is_valid = TRUE
            AND us.last_active_at > NOW() - INTERVAL '30 days'
        ) as active_sessions_30d,
        (
            SELECT COUNT(*)::INTEGER
            FROM public.login_attempts la
            WHERE la.email = p.email
            AND la.success = FALSE
            AND la.attempted_at > NOW() - INTERVAL '24 hours'
        ) as failed_logins_24h,
        EXISTS (
            SELECT 1 FROM public.account_lockouts al
            WHERE al.user_id = cu.id
            AND al.is_active = TRUE
        ) as is_locked,
        v_total_count
    FROM public.client_users cu
    LEFT JOIN public.profiles p ON p.id = cu.id
    LEFT JOIN public.client_organizations co ON co.id = cu.organization_id
    WHERE (p_search IS NULL OR cu.full_name ILIKE '%' || p_search || '%' OR p.email ILIKE '%' || p_search || '%')
      AND (p_org_id IS NULL OR cu.organization_id = p_org_id)
      AND (p_roles IS NULL OR cu.role = ANY(p_roles))
      AND (p_status IS NULL OR cu.status = p_status)
    ORDER BY cu.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- 11. Function to get user sessions with location data
CREATE OR REPLACE FUNCTION public.get_user_sessions_detailed(
    p_user_id UUID,
    p_include_expired BOOLEAN DEFAULT FALSE,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    session_id UUID,
    started_at TIMESTAMPTZ,
    last_active_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    is_valid BOOLEAN,
    is_current BOOLEAN,
    device_info JSONB,
    ip_address TEXT,
    user_agent TEXT,
    city TEXT,
    region TEXT,
    country TEXT,
    country_name TEXT,
    latitude DECIMAL,
    longitude DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Allow users to see their own sessions, or admins to see any
    IF auth.uid() != p_user_id AND NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    RETURN QUERY
    SELECT 
        us.id as session_id,
        us.started_at,
        us.last_active_at,
        us.expires_at,
        us.ended_at,
        us.is_valid,
        us.is_current,
        us.device_info,
        us.ip_address,
        us.user_agent,
        COALESCE(us.city, ul.city) as city,
        ul.region,
        COALESCE(us.country, ul.country) as country,
        ul.country_name,
        ul.latitude,
        ul.longitude
    FROM public.user_sessions us
    LEFT JOIN public.user_locations ul ON ul.ip_address = us.ip_address::inet
    WHERE us.user_id = p_user_id
      AND (p_include_expired OR us.is_valid = TRUE OR us.ended_at > NOW() - INTERVAL '30 days')
    ORDER BY us.last_active_at DESC
    LIMIT p_limit;
END;
$$;

-- 12. Function to get user login history
CREATE OR REPLACE FUNCTION public.get_user_login_history(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    attempt_id UUID,
    email TEXT,
    attempted_at TIMESTAMPTZ,
    success BOOLEAN,
    failure_reason TEXT,
    ip_address TEXT,
    user_agent TEXT,
    city TEXT,
    country TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_email TEXT;
BEGIN
    -- Allow users to see their own history, or admins to see any
    IF auth.uid() != p_user_id AND NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    -- Get user's email
    SELECT p.email INTO v_email
    FROM public.profiles p
    WHERE p.id = p_user_id;

    RETURN QUERY
    SELECT 
        la.id as attempt_id,
        la.email,
        la.attempted_at,
        la.success,
        la.failure_reason,
        la.ip_address,
        la.user_agent,
        ul.city,
        ul.country
    FROM public.login_attempts la
    LEFT JOIN public.user_locations ul ON ul.ip_address = la.ip_address::inet
    WHERE la.email = v_email
    ORDER BY la.attempted_at DESC
    LIMIT p_limit;
END;
$$;

-- 13. Function to get user activity logs
CREATE OR REPLACE FUNCTION public.get_user_activity_logs(
    p_user_id UUID,
    p_action_types TEXT[] DEFAULT NULL,
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    activity_id UUID,
    action_type TEXT,
    resource_type TEXT,
    resource_id TEXT,
    metadata JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Allow users to see their own activity, or admins to see any
    IF auth.uid() != p_user_id AND NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    RETURN QUERY
    SELECT 
        ual.id as activity_id,
        ual.action_type,
        ual.resource_type,
        ual.resource_id,
        ual.metadata,
        ual.ip_address,
        ual.created_at
    FROM public.user_activity_logs ual
    WHERE ual.user_id = p_user_id
      AND (p_action_types IS NULL OR ual.action_type = ANY(p_action_types))
    ORDER BY ual.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- 14. Auto-purge trigger for activity logs (90 days retention)
CREATE OR REPLACE FUNCTION public.purge_old_activity_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.user_activity_logs
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;

-- 15. Purge old location cache (30 days)
CREATE OR REPLACE FUNCTION public.purge_old_location_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.user_locations
    WHERE updated_at < NOW() - INTERVAL '30 days';
END;
$$;