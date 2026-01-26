

# Fix Organization Members Display

## Problem

The organization members list is empty because the `get_user_management_data` RPC function has a type mismatch error:

```
"operator does not exist: user_status = text"
```

**Root Cause**: The `client_users.status` column uses a PostgreSQL enum type (`user_status`), but the function parameter `p_status` is defined as `text`. PostgreSQL cannot compare these types directly.

---

## Solution

Update the `get_user_management_data` function to explicitly cast the `p_status` parameter to the `user_status` enum type before comparison.

### Database Migration

Create a migration to fix the RPC function:

```sql
-- Fix the type mismatch by casting p_status to user_status enum
CREATE OR REPLACE FUNCTION public.get_user_management_data(
    p_search text DEFAULT NULL,
    p_org_id uuid DEFAULT NULL,
    p_roles text[] DEFAULT NULL,
    p_status text DEFAULT NULL,
    p_limit integer DEFAULT 25,
    p_offset integer DEFAULT 0
)
RETURNS TABLE (
    id uuid,
    full_name text,
    email text,
    organization_id uuid,
    organization_name text,
    role text,
    status user_status,
    mfa_enabled boolean,
    created_at timestamptz,
    last_login_at timestamptz,
    latest_session jsonb,
    active_sessions_30d integer,
    failed_logins_24h integer,
    is_locked boolean,
    total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_count BIGINT;
    v_status user_status;
BEGIN
    -- Verify caller is admin
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Access denied: Admin role required';
    END IF;

    -- Cast p_status to enum if provided
    IF p_status IS NOT NULL THEN
        v_status := p_status::user_status;
    END IF;

    -- Get total count first
    SELECT COUNT(*) INTO v_total_count
    FROM public.client_users cu
    LEFT JOIN public.profiles p ON p.id = cu.id
    WHERE (p_search IS NULL OR cu.full_name ILIKE '%' || p_search || '%' OR p.email ILIKE '%' || p_search || '%')
      AND (p_org_id IS NULL OR cu.organization_id = p_org_id)
      AND (p_roles IS NULL OR cu.role = ANY(p_roles))
      AND (p_status IS NULL OR cu.status = v_status);

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
      AND (p_status IS NULL OR cu.status = v_status)
    ORDER BY cu.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;
```

---

## Key Change

The fix introduces a local variable `v_status` of type `user_status` and casts the text parameter to this enum type before comparison:

```sql
-- Before (broken):
AND (p_status IS NULL OR cu.status = p_status)

-- After (fixed):
IF p_status IS NOT NULL THEN
    v_status := p_status::user_status;
END IF;
-- Then use v_status in the query
AND (p_status IS NULL OR cu.status = v_status)
```

---

## Implementation

1. **Create database migration** - Single SQL file to replace the broken function
2. **No frontend changes required** - The component is already set up correctly

---

## Expected Result

After applying the fix, the Organization Members table will:
- Display all members with their full data
- Support filtering by status (pending, active, inactive, suspended)
- Show email, MFA status, last session, and security indicators

