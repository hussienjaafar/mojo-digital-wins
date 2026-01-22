-- ============================================================================
-- Multi-Organization Membership Support Migration (Complete)
-- ============================================================================

-- 1. Create organization_memberships table
CREATE TABLE IF NOT EXISTS public.organization_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'manager', 'member', 'viewer')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'removed', 'pending_invite')),
  is_primary BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_user_organization UNIQUE (user_id, organization_id)
);

-- 2. Add active_organization_id column to client_users
ALTER TABLE public.client_users 
ADD COLUMN IF NOT EXISTS active_organization_id UUID REFERENCES public.client_organizations(id) ON DELETE SET NULL;

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_org_memberships_user_id ON public.organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org_id ON public.organization_memberships(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_status ON public.organization_memberships(status);
CREATE INDEX IF NOT EXISTS idx_org_memberships_user_org_status ON public.organization_memberships(user_id, organization_id, status);
CREATE INDEX IF NOT EXISTS idx_org_memberships_is_primary ON public.organization_memberships(user_id, is_primary) WHERE is_primary = true;
CREATE INDEX IF NOT EXISTS idx_client_users_active_org ON public.client_users(active_organization_id);

-- Enable RLS
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;

-- 4. Migrate existing client_users data
INSERT INTO public.organization_memberships (user_id, organization_id, role, joined_at, status, is_primary, created_at)
SELECT 
  cu.id,
  cu.organization_id,
  CASE 
    WHEN cu.role = 'owner' THEN 'owner'
    WHEN cu.role = 'admin' THEN 'admin'
    WHEN cu.role = 'manager' THEN 'manager'
    ELSE 'member'
  END,
  cu.created_at,
  'active',
  true,
  cu.created_at
FROM public.client_users cu
WHERE cu.id IS NOT NULL 
  AND cu.organization_id IS NOT NULL
ON CONFLICT (user_id, organization_id) DO NOTHING;

-- Update active_organization_id
UPDATE public.client_users
SET active_organization_id = organization_id
WHERE active_organization_id IS NULL;

-- 5. Create sync trigger functions

CREATE OR REPLACE FUNCTION public.sync_membership_to_client_users()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_primary_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_primary = true THEN
      UPDATE public.client_users
      SET organization_id = NEW.organization_id, role = NEW.role
      WHERE id = NEW.user_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_primary = true AND (OLD.is_primary = false OR OLD.is_primary IS NULL) THEN
      UPDATE public.organization_memberships
      SET is_primary = false
      WHERE user_id = NEW.user_id AND id != NEW.id AND is_primary = true;
      
      UPDATE public.client_users
      SET organization_id = NEW.organization_id, role = NEW.role, active_organization_id = NEW.organization_id
      WHERE id = NEW.user_id;
    END IF;
    
    IF NEW.is_primary = true AND NEW.role != OLD.role THEN
      UPDATE public.client_users SET role = NEW.role WHERE id = NEW.user_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.is_primary = true THEN
      SELECT id INTO v_next_primary_id
      FROM public.organization_memberships
      WHERE user_id = OLD.user_id AND id != OLD.id AND status = 'active'
      ORDER BY joined_at ASC LIMIT 1;
      
      IF v_next_primary_id IS NOT NULL THEN
        UPDATE public.organization_memberships SET is_primary = true WHERE id = v_next_primary_id;
      END IF;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_client_users_to_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.organization_memberships (user_id, organization_id, role, is_primary, status)
    VALUES (NEW.id, NEW.organization_id, COALESCE(NEW.role, 'member'), true, 'active')
    ON CONFLICT (user_id, organization_id) DO UPDATE
    SET role = EXCLUDED.role, is_primary = true, status = 'active', updated_at = now();
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
      UPDATE public.organization_memberships
      SET is_primary = false, updated_at = now()
      WHERE user_id = NEW.id AND organization_id = OLD.organization_id;
      
      INSERT INTO public.organization_memberships (user_id, organization_id, role, is_primary, status)
      VALUES (NEW.id, NEW.organization_id, COALESCE(NEW.role, 'member'), true, 'active')
      ON CONFLICT (user_id, organization_id) DO UPDATE
      SET role = EXCLUDED.role, is_primary = true, status = 'active', updated_at = now();
    ELSIF NEW.role IS DISTINCT FROM OLD.role THEN
      UPDATE public.organization_memberships
      SET role = NEW.role, updated_at = now()
      WHERE user_id = NEW.id AND organization_id = NEW.organization_id AND is_primary = true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS trg_sync_membership_to_client_users ON public.organization_memberships;
CREATE TRIGGER trg_sync_membership_to_client_users
AFTER INSERT OR UPDATE OR DELETE ON public.organization_memberships
FOR EACH ROW EXECUTE FUNCTION public.sync_membership_to_client_users();

DROP TRIGGER IF EXISTS trg_sync_client_users_to_membership ON public.client_users;
CREATE TRIGGER trg_sync_client_users_to_membership
AFTER INSERT OR UPDATE ON public.client_users
FOR EACH ROW EXECUTE FUNCTION public.sync_client_users_to_membership();

DROP TRIGGER IF EXISTS update_organization_memberships_updated_at ON public.organization_memberships;
CREATE TRIGGER update_organization_memberships_updated_at
BEFORE UPDATE ON public.organization_memberships
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Create helper functions

CREATE OR REPLACE FUNCTION public.get_user_organizations(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (membership_id UUID, organization_id UUID, organization_name TEXT, role TEXT, status TEXT, is_primary BOOLEAN, joined_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id UUID;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  RETURN QUERY
  SELECT om.id, om.organization_id, co.name, om.role, om.status, om.is_primary, om.joined_at
  FROM public.organization_memberships om
  JOIN public.client_organizations co ON om.organization_id = co.id
  WHERE om.user_id = v_user_id AND om.status = 'active'
  ORDER BY om.is_primary DESC, om.joined_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_organization_members(p_organization_id UUID)
RETURNS TABLE (membership_id UUID, user_id UUID, email TEXT, full_name TEXT, role TEXT, status TEXT, joined_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organization_memberships WHERE organization_id = p_organization_id AND user_id = auth.uid() AND status = 'active') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  RETURN QUERY
  SELECT om.id, om.user_id, p.email, cu.full_name, om.role, om.status, om.joined_at
  FROM public.organization_memberships om
  LEFT JOIN public.client_users cu ON om.user_id = cu.id
  LEFT JOIN public.profiles p ON om.user_id = p.id
  WHERE om.organization_id = p_organization_id AND om.status IN ('active', 'pending_invite')
  ORDER BY CASE om.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'manager' THEN 3 WHEN 'member' THEN 4 ELSE 5 END, om.joined_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.switch_organization(p_organization_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id UUID; v_membership RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not authenticated'); END IF;
  SELECT * INTO v_membership FROM public.organization_memberships WHERE user_id = v_user_id AND organization_id = p_organization_id AND status = 'active';
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Not a member'); END IF;
  UPDATE public.organization_memberships SET is_primary = false, updated_at = now() WHERE user_id = v_user_id AND is_primary = true;
  UPDATE public.organization_memberships SET is_primary = true, updated_at = now() WHERE user_id = v_user_id AND organization_id = p_organization_id;
  UPDATE public.client_users SET active_organization_id = p_organization_id, organization_id = p_organization_id, role = v_membership.role WHERE id = v_user_id;
  RETURN jsonb_build_object('success', true, 'organization_id', p_organization_id, 'role', v_membership.role);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_active_organization_id()
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE v_org_id UUID;
BEGIN
  SELECT active_organization_id INTO v_org_id FROM public.client_users WHERE id = auth.uid();
  IF v_org_id IS NOT NULL THEN RETURN v_org_id; END IF;
  SELECT organization_id INTO v_org_id FROM public.organization_memberships WHERE user_id = auth.uid() AND is_primary = true AND status = 'active';
  IF v_org_id IS NOT NULL THEN RETURN v_org_id; END IF;
  SELECT organization_id INTO v_org_id FROM public.organization_memberships WHERE user_id = auth.uid() AND status = 'active' ORDER BY joined_at ASC LIMIT 1;
  RETURN v_org_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(p_organization_id UUID, p_roles TEXT[])
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.organization_memberships WHERE user_id = auth.uid() AND organization_id = p_organization_id AND role = ANY(p_roles) AND status = 'active');
END;
$$;

CREATE OR REPLACE FUNCTION public.transfer_organization_ownership(p_organization_id UUID, p_new_owner_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_current_user_id UUID; v_current_owner_id UUID;
BEGIN
  v_current_user_id := auth.uid();
  SELECT user_id INTO v_current_owner_id FROM public.organization_memberships WHERE organization_id = p_organization_id AND role = 'owner' AND status = 'active';
  IF v_current_owner_id != v_current_user_id THEN RETURN jsonb_build_object('success', false, 'error', 'Only owner can transfer'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organization_memberships WHERE organization_id = p_organization_id AND user_id = p_new_owner_id AND status = 'active') THEN
    RETURN jsonb_build_object('success', false, 'error', 'New owner must be active member');
  END IF;
  UPDATE public.organization_memberships SET role = 'admin', updated_at = now() WHERE organization_id = p_organization_id AND user_id = v_current_user_id;
  UPDATE public.organization_memberships SET role = 'owner', updated_at = now() WHERE organization_id = p_organization_id AND user_id = p_new_owner_id;
  RETURN jsonb_build_object('success', true, 'new_owner_id', p_new_owner_id, 'previous_owner_id', v_current_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.invite_to_organization(p_organization_id UUID, p_user_id UUID, p_role TEXT DEFAULT 'member')
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inviter_id UUID;
BEGIN
  v_inviter_id := auth.uid();
  IF NOT public.has_org_role(p_organization_id, ARRAY['owner', 'admin', 'manager']) THEN RETURN jsonb_build_object('success', false, 'error', 'No permission'); END IF;
  IF p_role NOT IN ('admin', 'manager', 'member', 'viewer') THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid role'); END IF;
  IF p_role = 'admin' AND NOT public.has_org_role(p_organization_id, ARRAY['owner']) THEN RETURN jsonb_build_object('success', false, 'error', 'Only owners can invite admins'); END IF;
  INSERT INTO public.organization_memberships (user_id, organization_id, role, invited_by, invited_at, status, is_primary)
  VALUES (p_user_id, p_organization_id, p_role, v_inviter_id, now(), 'pending_invite', false)
  ON CONFLICT (user_id, organization_id) DO UPDATE SET role = EXCLUDED.role, invited_by = EXCLUDED.invited_by, invited_at = EXCLUDED.invited_at, status = 'pending_invite', updated_at = now()
  WHERE organization_memberships.status != 'active';
  RETURN jsonb_build_object('success', true, 'user_id', p_user_id, 'organization_id', p_organization_id, 'role', p_role);
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_organization_invitation(p_organization_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id UUID; v_membership RECORD; v_has_other_orgs BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  SELECT * INTO v_membership FROM public.organization_memberships WHERE user_id = v_user_id AND organization_id = p_organization_id AND status = 'pending_invite';
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'No pending invitation'); END IF;
  SELECT EXISTS (SELECT 1 FROM public.organization_memberships WHERE user_id = v_user_id AND status = 'active') INTO v_has_other_orgs;
  UPDATE public.organization_memberships SET status = 'active', joined_at = now(), is_primary = NOT v_has_other_orgs, updated_at = now() WHERE id = v_membership.id;
  RETURN jsonb_build_object('success', true, 'organization_id', p_organization_id, 'role', v_membership.role, 'is_primary', NOT v_has_other_orgs);
END;
$$;

-- 7. RLS Policies
CREATE POLICY "Users can view their own memberships" ON public.organization_memberships FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Org admins can view all org members" ON public.organization_memberships FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.organization_memberships om WHERE om.organization_id = organization_memberships.organization_id AND om.user_id = auth.uid() AND om.role IN ('owner', 'admin', 'manager') AND om.status = 'active')
);

CREATE POLICY "Org admins can invite members" ON public.organization_memberships FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.organization_memberships om WHERE om.organization_id = organization_memberships.organization_id AND om.user_id = auth.uid() AND om.role IN ('owner', 'admin', 'manager') AND om.status = 'active')
  OR user_id = auth.uid()
);

CREATE POLICY "Org admins can update memberships" ON public.organization_memberships FOR UPDATE USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.organization_memberships om WHERE om.organization_id = organization_memberships.organization_id AND om.user_id = auth.uid() AND om.role IN ('owner', 'admin') AND om.status = 'active')
);

CREATE POLICY "Org owners can remove members" ON public.organization_memberships FOR DELETE USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.organization_memberships om WHERE om.organization_id = organization_memberships.organization_id AND om.user_id = auth.uid() AND om.role = 'owner' AND om.status = 'active')
);