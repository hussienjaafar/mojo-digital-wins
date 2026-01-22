-- =============================================
-- SESSION TRACKING SYSTEM MIGRATION
-- =============================================

-- 1. Create user_sessions table
CREATE TABLE IF NOT EXISTS public.user_sessions (
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

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON public.user_sessions(expires_at) WHERE is_valid = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_active ON public.user_sessions(last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_valid ON public.user_sessions(user_id, is_valid) WHERE is_valid = TRUE;

-- 3. Enable RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own sessions
CREATE POLICY "Users can view own sessions"
    ON public.user_sessions
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can update their own sessions
CREATE POLICY "Users can update own sessions"
    ON public.user_sessions
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can insert their own sessions
CREATE POLICY "Users can insert own sessions"
    ON public.user_sessions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own sessions
CREATE POLICY "Users can delete own sessions"
    ON public.user_sessions
    FOR DELETE
    USING (auth.uid() = user_id);

-- Admins can view all sessions for auditing
CREATE POLICY "Admins can view all sessions"
    ON public.user_sessions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'
        )
    );

-- Trigger for updated_at
CREATE TRIGGER update_user_sessions_updated_at
    BEFORE UPDATE ON public.user_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- SESSION MANAGEMENT FUNCTIONS
-- =============================================

-- 4a. Create Session Function
CREATE OR REPLACE FUNCTION public.create_user_session(
    p_user_id UUID,
    p_device_info JSONB DEFAULT '{}',
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days')
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session_id UUID;
BEGIN
    -- Mark all other sessions for this user as not current
    UPDATE public.user_sessions
    SET is_current = FALSE, updated_at = NOW()
    WHERE user_id = p_user_id AND is_current = TRUE;

    -- Insert new session
    INSERT INTO public.user_sessions (
        user_id,
        device_info,
        ip_address,
        user_agent,
        expires_at,
        is_current
    )
    VALUES (
        p_user_id,
        COALESCE(p_device_info, '{}'),
        p_ip_address,
        p_user_agent,
        p_expires_at,
        TRUE
    )
    RETURNING id INTO v_session_id;

    RETURN v_session_id;
END;
$$;

-- 4b. Update Session Activity
CREATE OR REPLACE FUNCTION public.update_session_activity(
    p_session_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.user_sessions
    SET
        last_active_at = NOW(),
        updated_at = NOW()
    WHERE id = p_session_id
    AND is_valid = TRUE
    AND expires_at > NOW();

    RETURN FOUND;
END;
$$;

-- 4c. Refresh Session
CREATE OR REPLACE FUNCTION public.refresh_user_session(
    p_session_id UUID,
    p_new_expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days')
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.user_sessions
    SET
        expires_at = p_new_expires_at,
        last_refresh_at = NOW(),
        refresh_count = refresh_count + 1,
        last_active_at = NOW(),
        updated_at = NOW()
    WHERE id = p_session_id
    AND is_valid = TRUE
    AND user_id = auth.uid();

    RETURN FOUND;
END;
$$;

-- 4d. End Session (Logout)
CREATE OR REPLACE FUNCTION public.end_user_session(
    p_session_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.user_sessions
    SET
        is_valid = FALSE,
        is_current = FALSE,
        ended_at = NOW(),
        updated_at = NOW()
    WHERE id = p_session_id
    AND user_id = auth.uid();

    RETURN FOUND;
END;
$$;

-- 4e. End All Sessions (Security Action)
CREATE OR REPLACE FUNCTION public.end_all_user_sessions(
    p_except_current BOOLEAN DEFAULT TRUE
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    IF p_except_current THEN
        UPDATE public.user_sessions
        SET
            is_valid = FALSE,
            ended_at = NOW(),
            updated_at = NOW()
        WHERE user_id = auth.uid()
        AND is_valid = TRUE
        AND is_current = FALSE;
    ELSE
        UPDATE public.user_sessions
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

-- 4f. Get Active Sessions
CREATE OR REPLACE FUNCTION public.get_user_active_sessions()
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
SET search_path = public
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
    FROM public.user_sessions us
    WHERE us.user_id = auth.uid()
    AND us.is_valid = TRUE
    AND us.expires_at > NOW()
    ORDER BY us.is_current DESC, us.last_active_at DESC;
END;
$$;

-- 4g. Cleanup Expired Sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Mark expired sessions as invalid
    UPDATE public.user_sessions
    SET
        is_valid = FALSE,
        is_current = FALSE,
        ended_at = COALESCE(ended_at, expires_at),
        updated_at = NOW()
    WHERE is_valid = TRUE
    AND expires_at < NOW();

    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- Delete very old sessions (older than 90 days)
    DELETE FROM public.user_sessions
    WHERE ended_at < NOW() - INTERVAL '90 days';

    RETURN v_count;
END;
$$;

-- 5. Set up pg_cron job for cleanup (runs every hour)
-- Note: pg_cron must be enabled in your Supabase project
SELECT cron.schedule(
    'cleanup-expired-sessions',
    '0 * * * *',
    $$SELECT public.cleanup_expired_sessions();$$
);