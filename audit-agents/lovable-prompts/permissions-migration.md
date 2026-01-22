# Permissions System Migration - Lovable Prompt

## Overview

This prompt guides the implementation of a fine-grained permissions system to replace the current basic 3-role model (admin, manager, viewer) with a flexible, feature-level permission system.

## Current State Analysis

### Existing Role System

The current system uses a simple role-based access control with three roles defined in `client_users.role`:

```sql
-- From migration 20251113221031
role TEXT DEFAULT 'viewer' CHECK (role IN ('viewer', 'manager', 'admin'))
```

Additionally, there's a separate `user_roles` table for platform-level admin access:

```sql
-- From migration 20251112225539
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);
```

### Current Role Checking Functions

1. **Platform Admin Check** (`has_role`):
```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
```

2. **Organization Membership Check** (`user_belongs_to_organization`):
```sql
CREATE OR REPLACE FUNCTION public.user_belongs_to_organization(_organization_id uuid)
RETURNS boolean
-- Checks if auth.uid() belongs to the specified organization via client_users table
```

### Frontend Hooks

Currently, role checking is done via:
- `src/hooks/useIsAdmin.ts` - Checks for platform-level admin role using `has_role` RPC

---

## Migration Requirements

### Phase 1: Database Schema

Create the following new tables to support fine-grained permissions:

#### 1. `permissions` Table

```sql
-- Core permissions table
CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL, -- e.g., 'campaigns:create', 'analytics:view'
  description TEXT,
  category TEXT NOT NULL, -- 'campaigns', 'analytics', 'users', 'settings', 'billing'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for category lookups
CREATE INDEX idx_permissions_category ON public.permissions(category);

-- RLS: All authenticated users can read permissions (they define what's available)
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view permissions" ON public.permissions
  FOR SELECT TO authenticated
  USING (true);

-- Only platform admins can modify permissions
CREATE POLICY "Platform admins can manage permissions" ON public.permissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
```

#### 2. `role_permissions` Table

```sql
-- Maps roles to permissions (default and per-organization)
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL, -- 'owner', 'admin', 'member' or custom role name
  permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES public.client_organizations(id) ON DELETE CASCADE NULL, -- NULL = global default
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_role_permission_org UNIQUE(role, permission_id, organization_id)
);

-- Indexes for efficient lookups
CREATE INDEX idx_role_permissions_role ON public.role_permissions(role);
CREATE INDEX idx_role_permissions_org ON public.role_permissions(organization_id);
CREATE INDEX idx_role_permissions_permission ON public.role_permissions(permission_id);

-- RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Users can view role permissions for their org or global defaults
CREATE POLICY "Users can view role permissions" ON public.role_permissions
  FOR SELECT TO authenticated
  USING (
    organization_id IS NULL -- Global defaults visible to all
    OR public.user_belongs_to_organization(organization_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Only org admins or platform admins can modify
CREATE POLICY "Admins can manage role permissions" ON public.role_permissions
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (
      organization_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.client_users
        WHERE id = auth.uid()
        AND organization_id = role_permissions.organization_id
        AND role = 'admin'
      )
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (
      organization_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.client_users
        WHERE id = auth.uid()
        AND organization_id = role_permissions.organization_id
        AND role = 'admin'
      )
    )
  );
```

#### 3. `user_permission_overrides` Table

```sql
-- Individual user permission overrides (grant or deny)
CREATE TABLE public.user_permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES public.client_organizations(id) ON DELETE CASCADE NOT NULL,
  permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE NOT NULL,
  granted BOOLEAN NOT NULL, -- true = explicitly grant, false = explicitly deny
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NULL, -- NULL = permanent
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_user_permission_override UNIQUE(user_id, organization_id, permission_id)
);

-- Indexes
CREATE INDEX idx_user_permission_overrides_user ON public.user_permission_overrides(user_id);
CREATE INDEX idx_user_permission_overrides_org ON public.user_permission_overrides(organization_id);
CREATE INDEX idx_user_permission_overrides_expires ON public.user_permission_overrides(expires_at) WHERE expires_at IS NOT NULL;

-- RLS
ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;

-- Users can view their own overrides
CREATE POLICY "Users can view own overrides" ON public.user_permission_overrides
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.client_users
      WHERE id = auth.uid()
      AND organization_id = user_permission_overrides.organization_id
      AND role IN ('admin', 'manager')
    )
  );

-- Only org admins+ or platform admins can modify
CREATE POLICY "Admins can manage overrides" ON public.user_permission_overrides
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.client_users
      WHERE id = auth.uid()
      AND organization_id = user_permission_overrides.organization_id
      AND role = 'admin'
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.client_users
      WHERE id = auth.uid()
      AND organization_id = user_permission_overrides.organization_id
      AND role = 'admin'
    )
  );
```

---

### Phase 2: Seed Default Permissions

```sql
-- Insert all permission definitions
INSERT INTO public.permissions (name, description, category) VALUES
  -- Campaigns
  ('campaigns:view', 'View campaign data and performance', 'campaigns'),
  ('campaigns:create', 'Create new campaigns', 'campaigns'),
  ('campaigns:edit', 'Edit existing campaigns', 'campaigns'),
  ('campaigns:delete', 'Delete campaigns', 'campaigns'),
  ('campaigns:send', 'Send/launch campaigns', 'campaigns'),

  -- Analytics
  ('analytics:view', 'View analytics dashboards and reports', 'analytics'),
  ('analytics:export', 'Export analytics data', 'analytics'),

  -- Users
  ('users:view', 'View team members', 'users'),
  ('users:invite', 'Invite new team members', 'users'),
  ('users:manage', 'Manage team member roles and permissions', 'users'),
  ('users:remove', 'Remove team members', 'users'),

  -- Settings
  ('settings:view', 'View organization settings', 'settings'),
  ('settings:edit', 'Edit organization settings', 'settings'),

  -- Billing
  ('billing:view', 'View billing information', 'billing'),
  ('billing:manage', 'Manage billing and subscriptions', 'billing'),

  -- Integrations
  ('integrations:view', 'View connected integrations', 'integrations'),
  ('integrations:manage', 'Connect and configure integrations', 'integrations'),

  -- Intelligence/News
  ('intelligence:view', 'View news and intelligence feeds', 'intelligence'),
  ('intelligence:configure', 'Configure intelligence settings and alerts', 'intelligence'),

  -- Donations/ActBlue
  ('donations:view', 'View donation data', 'donations'),
  ('donations:export', 'Export donation data', 'donations'),
  ('donations:view_pii', 'View donor personal information', 'donations')
ON CONFLICT (name) DO NOTHING;

-- Seed default role permissions (organization_id = NULL for global defaults)

-- Owner role: ALL permissions
INSERT INTO public.role_permissions (role, permission_id, organization_id)
SELECT 'owner', id, NULL FROM public.permissions
ON CONFLICT DO NOTHING;

-- Admin role: All except billing:manage and ownership transfer
INSERT INTO public.role_permissions (role, permission_id, organization_id)
SELECT 'admin', id, NULL FROM public.permissions
WHERE name NOT IN ('billing:manage')
ON CONFLICT DO NOTHING;

-- Member role: View permissions + basic actions
INSERT INTO public.role_permissions (role, permission_id, organization_id)
SELECT 'member', id, NULL FROM public.permissions
WHERE name IN (
  'campaigns:view',
  'analytics:view',
  'users:view',
  'settings:view',
  'integrations:view',
  'intelligence:view',
  'donations:view'
)
ON CONFLICT DO NOTHING;
```

---

### Phase 3: Permission Checking Function

```sql
-- Main permission checking function
CREATE OR REPLACE FUNCTION public.user_has_permission(
  _user_id UUID,
  _organization_id UUID,
  _permission_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role TEXT;
  v_permission_id UUID;
  v_override_granted BOOLEAN;
  v_has_role_permission BOOLEAN;
BEGIN
  -- Platform admins have all permissions
  IF public.has_role(_user_id, 'admin'::app_role) THEN
    RETURN TRUE;
  END IF;

  -- Get the permission ID
  SELECT id INTO v_permission_id
  FROM public.permissions
  WHERE name = _permission_name;

  IF v_permission_id IS NULL THEN
    RETURN FALSE; -- Unknown permission = denied
  END IF;

  -- Get user's role in the organization
  SELECT role INTO v_user_role
  FROM public.client_users
  WHERE id = _user_id AND organization_id = _organization_id;

  IF v_user_role IS NULL THEN
    RETURN FALSE; -- Not a member of the org
  END IF;

  -- Check for explicit user override (not expired)
  SELECT granted INTO v_override_granted
  FROM public.user_permission_overrides
  WHERE user_id = _user_id
    AND organization_id = _organization_id
    AND permission_id = v_permission_id
    AND (expires_at IS NULL OR expires_at > now());

  -- If there's an explicit override, use it
  IF v_override_granted IS NOT NULL THEN
    RETURN v_override_granted;
  END IF;

  -- Check role permissions (org-specific first, then global defaults)
  SELECT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role = v_user_role
      AND rp.permission_id = v_permission_id
      AND (
        rp.organization_id = _organization_id -- Org-specific
        OR (
          rp.organization_id IS NULL -- Global default
          AND NOT EXISTS ( -- Not overridden by org-specific
            SELECT 1 FROM public.role_permissions rp2
            WHERE rp2.role = v_user_role
              AND rp2.permission_id = v_permission_id
              AND rp2.organization_id = _organization_id
          )
        )
      )
  ) INTO v_has_role_permission;

  RETURN COALESCE(v_has_role_permission, FALSE);
END;
$$;

-- Convenience RPC for frontend
CREATE OR REPLACE FUNCTION public.check_permission(_permission_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Get current user's organization
  SELECT organization_id INTO v_org_id
  FROM public.client_users
  WHERE id = auth.uid();

  IF v_org_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN public.user_has_permission(auth.uid(), v_org_id, _permission_name);
END;
$$;

-- Get all permissions for current user
CREATE OR REPLACE FUNCTION public.get_user_permissions()
RETURNS TABLE(permission_name TEXT, granted BOOLEAN)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT organization_id INTO v_org_id
  FROM public.client_users
  WHERE id = auth.uid();

  RETURN QUERY
  SELECT
    p.name,
    public.user_has_permission(auth.uid(), v_org_id, p.name)
  FROM public.permissions p
  ORDER BY p.category, p.name;
END;
$$;
```

---

### Phase 4: Update Existing RLS Policies

Example of updating an existing RLS policy to use the new permission system:

```sql
-- Before (role-based):
CREATE POLICY "Admins and managers can manage campaigns" ON campaigns
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.client_users
      WHERE id = auth.uid()
      AND organization_id = campaigns.organization_id
      AND role IN ('admin', 'manager')
    )
  );

-- After (permission-based):
CREATE POLICY "Users with campaigns:edit can manage campaigns" ON campaigns
  FOR UPDATE TO authenticated
  USING (
    public.user_has_permission(auth.uid(), organization_id, 'campaigns:edit')
  );

CREATE POLICY "Users with campaigns:delete can delete campaigns" ON campaigns
  FOR DELETE TO authenticated
  USING (
    public.user_has_permission(auth.uid(), organization_id, 'campaigns:delete')
  );
```

---

### Phase 5: Migration of Existing Roles

Map existing roles to new permission model:

```sql
-- For existing client_users, ensure they get appropriate permissions
-- The role column remains but now maps to role_permissions

-- Add 'owner' as a valid role option
ALTER TABLE public.client_users
  DROP CONSTRAINT IF EXISTS client_users_role_check;

ALTER TABLE public.client_users
  ADD CONSTRAINT client_users_role_check
  CHECK (role IN ('viewer', 'member', 'manager', 'admin', 'owner'));

-- Migrate 'viewer' role to 'member' (optional - depends on business logic)
-- UPDATE public.client_users SET role = 'member' WHERE role = 'viewer';
```

---

## Frontend Implementation

See `src/utils/permissionChecker.ts` for the frontend implementation including:
- `hasPermission(user, org, permission)` - Direct permission check
- `usePermission(permission)` - React hook for permission checking
- `usePermissions()` - Hook to get all user permissions
- `PermissionGate` - Component for conditional rendering

---

## Testing Checklist

1. [ ] Create new tables with proper RLS
2. [ ] Seed default permissions
3. [ ] Seed default role_permissions
4. [ ] Test `user_has_permission` function
5. [ ] Test permission overrides (grant and deny)
6. [ ] Test expiring overrides
7. [ ] Update frontend hooks
8. [ ] Update existing RLS policies (incremental)
9. [ ] Test migration from old role system
10. [ ] Verify platform admin bypass works

---

## Rollback Plan

If issues arise, the migration can be rolled back by:

1. Dropping the new tables:
```sql
DROP TABLE IF EXISTS public.user_permission_overrides;
DROP TABLE IF EXISTS public.role_permissions;
DROP TABLE IF EXISTS public.permissions;
```

2. Reverting any modified RLS policies to use the old role-based checks

3. The `client_users.role` column remains unchanged throughout migration for backward compatibility

---

## Notes

- Keep the existing `role` column in `client_users` for backward compatibility
- New permission checks should use `user_has_permission` function
- Platform-level `has_role` function continues to work for admin checks
- Organization-specific permission customization is optional (uses global defaults if not set)
