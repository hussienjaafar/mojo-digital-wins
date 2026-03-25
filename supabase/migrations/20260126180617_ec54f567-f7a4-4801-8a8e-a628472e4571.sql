-- Fix admin_user_overview view to use security invoker
DROP VIEW IF EXISTS public.admin_user_overview;

CREATE VIEW public.admin_user_overview
WITH (security_invoker=on)
AS
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