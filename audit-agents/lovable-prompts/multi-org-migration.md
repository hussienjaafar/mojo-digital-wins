# Multi-Organization Membership Schema Migration

## Overview

This prompt guides the implementation of a multi-organization membership system that allows users to belong to multiple organizations simultaneously. The current system has a 1:1 relationship between users and organizations via `client_users`, which is a limitation for users who need access to multiple client organizations.

## Current State Analysis

### Existing Schema

**`client_organizations` table:**
```sql
CREATE TABLE public.client_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  primary_contact_email TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**`client_users` table (current limitation):**
```sql
CREATE TABLE public.client_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.client_organizations(id) ON DELETE CASCADE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT DEFAULT 'viewer' CHECK (role IN ('viewer', 'manager', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now(),
  last_login_at TIMESTAMPTZ
);
```

**Current Helper Function:**
```sql
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.client_users WHERE id = auth.uid()
$$;
```

### Current Limitations

1. **1:1 User-Organization Relationship**: Users can only belong to one organization
2. **No Role Differentiation Per Org**: Users have a single role across the platform
3. **No Invitation Tracking**: No audit trail for how users joined organizations
4. **No Active Organization Context**: No concept of which organization user is currently working in

---

## New Schema Design

### Phase 1: Create `organization_memberships` Table

Create a new junction table that enables many-to-many relationships between users and organizations:

```sql
-- =============================================================================
-- Create organization_memberships table for multi-org support
-- =============================================================================

CREATE TABLE public.organization_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core relationships
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,

  -- Role within this specific organization
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'manager', 'member', 'viewer')),

  -- Invitation tracking
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT now(),

  -- Membership status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'removed', 'pending_invite')),

  -- Primary organization flag (user's default org)
  is_primary BOOLEAN DEFAULT false,

  -- Extensible metadata
  metadata JSONB DEFAULT '{}',
  -- Example metadata: { "department": "Marketing", "permissions": ["read_reports", "edit_campaigns"] }

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Ensure one membership per user-org pair
  CONSTRAINT unique_user_organization UNIQUE (user_id, organization_id)
);

-- Ensure only one primary org per user
CREATE UNIQUE INDEX idx_organization_memberships_primary
  ON public.organization_memberships (user_id)
  WHERE is_primary = true;

-- Performance indexes
CREATE INDEX idx_organization_memberships_user ON public.organization_memberships(user_id);
CREATE INDEX idx_organization_memberships_org ON public.organization_memberships(organization_id);
CREATE INDEX idx_organization_memberships_status ON public.organization_memberships(status) WHERE status = 'active';
CREATE INDEX idx_organization_memberships_role ON public.organization_memberships(organization_id, role);

-- Add updated_at trigger
CREATE TRIGGER update_organization_memberships_updated_at
  BEFORE UPDATE ON public.organization_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
```

### Phase 2: Add Active Organization Tracking

Add a column to track the user's currently active organization context:

```sql
-- =============================================================================
-- Add active organization tracking to client_users
-- =============================================================================

ALTER TABLE public.client_users
  ADD COLUMN IF NOT EXISTS active_organization_id UUID REFERENCES public.client_organizations(id) ON DELETE SET NULL;

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_client_users_active_org ON public.client_users(active_organization_id);

COMMENT ON COLUMN public.client_users.active_organization_id IS
  'The organization the user is currently working in. Set via switch_organization function.';
```

---

## Migration Strategy

### Phase 3: Data Migration from `client_users`

Populate `organization_memberships` from existing `client_users` data:

```sql
-- =============================================================================
-- Migrate existing client_users to organization_memberships
-- =============================================================================

-- Insert existing relationships as memberships
INSERT INTO public.organization_memberships (
  user_id,
  organization_id,
  role,
  joined_at,
  status,
  is_primary,
  created_at
)
SELECT
  cu.id as user_id,
  cu.organization_id,
  -- Map existing roles to new role system
  CASE cu.role
    WHEN 'admin' THEN 'admin'
    WHEN 'manager' THEN 'manager'
    WHEN 'viewer' THEN 'viewer'
    ELSE 'member'
  END as role,
  cu.created_at as joined_at,
  'active' as status,
  true as is_primary,  -- Existing org is their primary
  cu.created_at
FROM public.client_users cu
WHERE cu.organization_id IS NOT NULL
ON CONFLICT (user_id, organization_id) DO NOTHING;

-- Set active_organization_id to current organization
UPDATE public.client_users
SET active_organization_id = organization_id
WHERE active_organization_id IS NULL AND organization_id IS NOT NULL;
```

### Phase 4: Sync Trigger for Backwards Compatibility

Create a trigger to keep `client_users.organization_id` in sync during transition:

```sql
-- =============================================================================
-- Sync trigger for backwards compatibility
-- =============================================================================

-- When a new membership is created and marked as primary, update client_users
CREATE OR REPLACE FUNCTION public.sync_membership_to_client_users()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- On INSERT: If this is marked as primary, update client_users
  IF TG_OP = 'INSERT' AND NEW.is_primary = true AND NEW.status = 'active' THEN
    UPDATE public.client_users
    SET
      organization_id = NEW.organization_id,
      active_organization_id = NEW.organization_id,
      role = CASE NEW.role
        WHEN 'owner' THEN 'admin'
        WHEN 'admin' THEN 'admin'
        WHEN 'manager' THEN 'manager'
        ELSE 'viewer'
      END
    WHERE id = NEW.user_id;
  END IF;

  -- On UPDATE: If primary status changed
  IF TG_OP = 'UPDATE' THEN
    -- If becoming primary
    IF NEW.is_primary = true AND (OLD.is_primary = false OR OLD.is_primary IS NULL) THEN
      UPDATE public.client_users
      SET
        organization_id = NEW.organization_id,
        active_organization_id = COALESCE(active_organization_id, NEW.organization_id)
      WHERE id = NEW.user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_membership_to_client_users_trigger
  AFTER INSERT OR UPDATE ON public.organization_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_membership_to_client_users();

-- Reverse sync: When client_users is updated, sync to memberships
CREATE OR REPLACE FUNCTION public.sync_client_users_to_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If organization_id changed, update or create membership
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id AND NEW.organization_id IS NOT NULL THEN
    INSERT INTO public.organization_memberships (
      user_id,
      organization_id,
      role,
      status,
      is_primary,
      joined_at
    )
    VALUES (
      NEW.id,
      NEW.organization_id,
      CASE NEW.role
        WHEN 'admin' THEN 'admin'
        WHEN 'manager' THEN 'manager'
        ELSE 'viewer'
      END,
      'active',
      true,
      now()
    )
    ON CONFLICT (user_id, organization_id) DO UPDATE
    SET
      is_primary = true,
      status = 'active',
      updated_at = now();

    -- Unset previous primary
    UPDATE public.organization_memberships
    SET is_primary = false, updated_at = now()
    WHERE user_id = NEW.id
      AND organization_id != NEW.organization_id
      AND is_primary = true;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_client_users_to_membership_trigger
  AFTER UPDATE ON public.client_users
  FOR EACH ROW
  WHEN (OLD.organization_id IS DISTINCT FROM NEW.organization_id)
  EXECUTE FUNCTION public.sync_client_users_to_membership();
```

---

## RLS Policies

### Phase 5: Row-Level Security for `organization_memberships`

```sql
-- =============================================================================
-- RLS Policies for organization_memberships
-- =============================================================================

ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;

-- Users can view their own memberships
CREATE POLICY "Users can view own memberships"
  ON public.organization_memberships FOR SELECT
  USING (user_id = auth.uid());

-- Users can view memberships in orgs they belong to
CREATE POLICY "Users can view memberships in their orgs"
  ON public.organization_memberships FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_memberships om
      WHERE om.user_id = auth.uid() AND om.status = 'active'
    )
  );

-- Admins/Owners can add members to their organizations
CREATE POLICY "Admins can add members to their orgs"
  ON public.organization_memberships FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_memberships om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = organization_memberships.organization_id
        AND om.role IN ('owner', 'admin')
        AND om.status = 'active'
    )
  );

-- Admins can update memberships in their organizations (except owners)
CREATE POLICY "Admins can update memberships in their orgs"
  ON public.organization_memberships FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_memberships om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = organization_memberships.organization_id
        AND om.role IN ('owner', 'admin')
        AND om.status = 'active'
    )
    -- Cannot demote/modify owners unless you are the owner
    AND (
      organization_memberships.role != 'owner'
      OR EXISTS (
        SELECT 1 FROM public.organization_memberships om
        WHERE om.user_id = auth.uid()
          AND om.organization_id = organization_memberships.organization_id
          AND om.role = 'owner'
          AND om.status = 'active'
      )
    )
  );

-- Users can update their own membership (limited fields via check)
CREATE POLICY "Users can update own membership"
  ON public.organization_memberships FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    -- Can only change is_primary, not role/status
    user_id = auth.uid()
    AND OLD.role = NEW.role
    AND OLD.status = NEW.status
  );

-- Admins can remove members from their organizations (soft delete via status)
CREATE POLICY "Admins can remove members from their orgs"
  ON public.organization_memberships FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_memberships om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = organization_memberships.organization_id
        AND om.role IN ('owner', 'admin')
        AND om.status = 'active'
    )
    -- Cannot delete owner memberships
    AND organization_memberships.role != 'owner'
  );

-- Users can remove themselves from organizations (except if owner)
CREATE POLICY "Users can leave organizations"
  ON public.organization_memberships FOR DELETE
  USING (
    user_id = auth.uid()
    AND role != 'owner'
  );

-- Platform admins can manage all memberships
CREATE POLICY "Platform admins can manage all memberships"
  ON public.organization_memberships FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));
```

---

## Helper Functions

### Phase 6: Create Helper Functions

```sql
-- =============================================================================
-- Helper Functions for Multi-Org Support
-- =============================================================================

-- Get all organizations for a user
CREATE OR REPLACE FUNCTION public.get_user_organizations(p_user_id UUID DEFAULT auth.uid())
RETURNS TABLE (
  organization_id UUID,
  organization_name TEXT,
  organization_slug TEXT,
  role TEXT,
  is_primary BOOLEAN,
  is_active BOOLEAN,
  joined_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    co.id as organization_id,
    co.name as organization_name,
    co.slug as organization_slug,
    om.role,
    om.is_primary,
    om.status = 'active' as is_active,
    om.joined_at
  FROM public.organization_memberships om
  JOIN public.client_organizations co ON co.id = om.organization_id
  WHERE om.user_id = p_user_id
    AND om.status IN ('active', 'pending_invite')
    AND co.is_active = true
  ORDER BY om.is_primary DESC, co.name ASC;
$$;

-- Get all members of an organization
CREATE OR REPLACE FUNCTION public.get_organization_members(p_organization_id UUID)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  email TEXT,
  role TEXT,
  status TEXT,
  joined_at TIMESTAMPTZ,
  invited_by_name TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    om.user_id,
    cu.full_name,
    au.email,
    om.role,
    om.status,
    om.joined_at,
    inviter.full_name as invited_by_name
  FROM public.organization_memberships om
  JOIN public.client_users cu ON cu.id = om.user_id
  JOIN auth.users au ON au.id = om.user_id
  LEFT JOIN public.client_users inviter ON inviter.id = om.invited_by
  WHERE om.organization_id = p_organization_id
    -- Only return if caller has access to this org
    AND EXISTS (
      SELECT 1 FROM public.organization_memberships caller_om
      WHERE caller_om.user_id = auth.uid()
        AND caller_om.organization_id = p_organization_id
        AND caller_om.status = 'active'
    )
  ORDER BY
    CASE om.role
      WHEN 'owner' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'manager' THEN 3
      WHEN 'member' THEN 4
      ELSE 5
    END,
    cu.full_name ASC;
$$;

-- Switch active organization
CREATE OR REPLACE FUNCTION public.switch_organization(p_organization_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_access BOOLEAN;
BEGIN
  -- Check if user has active membership in target org
  SELECT EXISTS (
    SELECT 1 FROM public.organization_memberships
    WHERE user_id = auth.uid()
      AND organization_id = p_organization_id
      AND status = 'active'
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'User does not have access to organization %', p_organization_id;
  END IF;

  -- Update active organization
  UPDATE public.client_users
  SET active_organization_id = p_organization_id
  WHERE id = auth.uid();

  RETURN true;
END;
$$;

-- Get active organization (replaces get_user_organization_id for new queries)
CREATE OR REPLACE FUNCTION public.get_active_organization_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    active_organization_id,
    organization_id  -- Fallback to legacy field
  )
  FROM public.client_users
  WHERE id = auth.uid()
$$;

-- Check if user has specific role in organization
CREATE OR REPLACE FUNCTION public.has_org_role(
  p_organization_id UUID,
  p_roles TEXT[]
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_memberships
    WHERE user_id = auth.uid()
      AND organization_id = p_organization_id
      AND role = ANY(p_roles)
      AND status = 'active'
  )
$$;

-- Transfer organization ownership
CREATE OR REPLACE FUNCTION public.transfer_organization_ownership(
  p_organization_id UUID,
  p_new_owner_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_current_owner BOOLEAN;
BEGIN
  -- Verify caller is current owner
  SELECT EXISTS (
    SELECT 1 FROM public.organization_memberships
    WHERE user_id = auth.uid()
      AND organization_id = p_organization_id
      AND role = 'owner'
      AND status = 'active'
  ) INTO v_is_current_owner;

  IF NOT v_is_current_owner THEN
    RAISE EXCEPTION 'Only the current owner can transfer ownership';
  END IF;

  -- Verify new owner has active membership
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_memberships
    WHERE user_id = p_new_owner_id
      AND organization_id = p_organization_id
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'New owner must be an active member of the organization';
  END IF;

  -- Demote current owner to admin
  UPDATE public.organization_memberships
  SET role = 'admin', updated_at = now()
  WHERE user_id = auth.uid()
    AND organization_id = p_organization_id;

  -- Promote new owner
  UPDATE public.organization_memberships
  SET role = 'owner', updated_at = now()
  WHERE user_id = p_new_owner_id
    AND organization_id = p_organization_id;

  RETURN true;
END;
$$;

-- Invite user to organization
CREATE OR REPLACE FUNCTION public.invite_to_organization(
  p_organization_id UUID,
  p_user_id UUID,
  p_role TEXT DEFAULT 'member'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_membership_id UUID;
  v_can_invite BOOLEAN;
BEGIN
  -- Check if caller can invite (admin or owner)
  SELECT EXISTS (
    SELECT 1 FROM public.organization_memberships
    WHERE user_id = auth.uid()
      AND organization_id = p_organization_id
      AND role IN ('owner', 'admin')
      AND status = 'active'
  ) INTO v_can_invite;

  IF NOT v_can_invite THEN
    RAISE EXCEPTION 'Only admins and owners can invite users';
  END IF;

  -- Validate role (cannot invite as owner)
  IF p_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot invite users as owner. Use transfer_organization_ownership instead.';
  END IF;

  -- Create or update membership
  INSERT INTO public.organization_memberships (
    user_id,
    organization_id,
    role,
    invited_by,
    invited_at,
    status
  )
  VALUES (
    p_user_id,
    p_organization_id,
    p_role,
    auth.uid(),
    now(),
    'pending_invite'
  )
  ON CONFLICT (user_id, organization_id) DO UPDATE
  SET
    role = EXCLUDED.role,
    invited_by = EXCLUDED.invited_by,
    invited_at = EXCLUDED.invited_at,
    status = CASE
      WHEN organization_memberships.status = 'removed' THEN 'pending_invite'
      ELSE organization_memberships.status
    END,
    updated_at = now()
  RETURNING id INTO v_membership_id;

  RETURN v_membership_id;
END;
$$;

-- Accept organization invitation
CREATE OR REPLACE FUNCTION public.accept_organization_invitation(p_organization_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.organization_memberships
  SET
    status = 'active',
    joined_at = now(),
    updated_at = now()
  WHERE user_id = auth.uid()
    AND organization_id = p_organization_id
    AND status = 'pending_invite';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No pending invitation found for this organization';
  END IF;

  -- Set as primary if user has no other primary org
  UPDATE public.organization_memberships
  SET is_primary = true, updated_at = now()
  WHERE user_id = auth.uid()
    AND organization_id = p_organization_id
    AND NOT EXISTS (
      SELECT 1 FROM public.organization_memberships
      WHERE user_id = auth.uid()
        AND is_primary = true
        AND status = 'active'
    );

  RETURN true;
END;
$$;
```

---

## Updated RLS Policies for Existing Tables

### Phase 7: Update Existing RLS to Support Multi-Org

After migration, update existing table policies to use the new `get_active_organization_id()` function:

```sql
-- =============================================================================
-- Update existing RLS policies to support multi-org context
-- =============================================================================

-- Example: Update meta_campaigns policy
DROP POLICY IF EXISTS "Users can view own org campaigns" ON public.meta_campaigns;
CREATE POLICY "Users can view active org campaigns"
  ON public.meta_campaigns FOR SELECT
  USING (
    organization_id = public.get_active_organization_id()
    OR organization_id IN (
      SELECT om.organization_id
      FROM public.organization_memberships om
      WHERE om.user_id = auth.uid() AND om.status = 'active'
    )
  );

-- Similar updates needed for:
-- - meta_ad_metrics
-- - sms_campaign_metrics
-- - actblue_transactions
-- - daily_aggregated_metrics
-- - campaign_attribution
-- - client_api_credentials (admin only)
-- - meta_capi_config
-- - polling_alert_configs
-- And all other org-scoped tables

-- Note: During transition period, keep both get_user_organization_id() and
-- get_active_organization_id() functional. After full migration, deprecate
-- get_user_organization_id().
```

---

## Frontend Integration Notes

### Organization Switcher Component

The frontend should implement an organization switcher that:

1. **Fetches user's organizations** via `get_user_organizations()`
2. **Displays current active org** in header/sidebar
3. **Allows switching** via `switch_organization()` RPC call
4. **Persists selection** - active org is stored in database, not just client state

### API Calls

All data-fetching queries should automatically scope to the active organization via RLS. The frontend doesn't need to pass `organization_id` explicitly - RLS handles it.

```typescript
// Example: Fetching campaigns scopes to active org automatically
const { data: campaigns } = await supabase
  .from('meta_campaigns')
  .select('*');

// To switch org context:
const { error } = await supabase.rpc('switch_organization', {
  p_organization_id: newOrgId
});

// To get all user's orgs:
const { data: orgs } = await supabase.rpc('get_user_organizations');
```

---

## Testing Checklist

1. [ ] Create user with membership in multiple orgs
2. [ ] Verify user can switch between orgs
3. [ ] Verify data isolation - each org only sees its own data
4. [ ] Test invitation flow - invite, accept, verify access
5. [ ] Test ownership transfer
6. [ ] Verify sync triggers keep `client_users` up to date
7. [ ] Test RLS policies prevent unauthorized access
8. [ ] Verify existing functionality works during transition
9. [ ] Test edge cases: user removed from primary org, last member leaving org

---

## Rollback Plan

If issues arise, the rollback is straightforward:

1. Drop sync triggers
2. Drop `organization_memberships` table
3. Remove `active_organization_id` column from `client_users`
4. The original `client_users.organization_id` field remains intact

```sql
-- Rollback script (if needed)
DROP TRIGGER IF EXISTS sync_membership_to_client_users_trigger ON public.organization_memberships;
DROP TRIGGER IF EXISTS sync_client_users_to_membership_trigger ON public.client_users;
DROP FUNCTION IF EXISTS public.sync_membership_to_client_users();
DROP FUNCTION IF EXISTS public.sync_client_users_to_membership();
DROP FUNCTION IF EXISTS public.get_user_organizations(UUID);
DROP FUNCTION IF EXISTS public.get_organization_members(UUID);
DROP FUNCTION IF EXISTS public.switch_organization(UUID);
DROP FUNCTION IF EXISTS public.get_active_organization_id();
DROP FUNCTION IF EXISTS public.has_org_role(UUID, TEXT[]);
DROP FUNCTION IF EXISTS public.transfer_organization_ownership(UUID, UUID);
DROP FUNCTION IF EXISTS public.invite_to_organization(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.accept_organization_invitation(UUID);
DROP TABLE IF EXISTS public.organization_memberships;
ALTER TABLE public.client_users DROP COLUMN IF EXISTS active_organization_id;
```

---

## Summary

This migration transforms the user-organization relationship from 1:1 to many-to-many while:

1. **Maintaining backwards compatibility** via sync triggers
2. **Preserving existing data** through migration from `client_users`
3. **Adding comprehensive RLS** for security
4. **Providing helper functions** for common operations
5. **Enabling gradual rollout** with clear rollback path

The schema supports:
- Users belonging to multiple organizations
- Role-based access per organization
- Organization ownership with transfer capability
- Invitation workflow with audit trail
- Active organization context switching
