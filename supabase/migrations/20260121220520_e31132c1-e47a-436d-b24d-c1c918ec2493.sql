-- ============================================
-- Complete Seat-Based Billing System Enhancement
-- ============================================

-- 1. Add bonus_seats and bonus_reason columns to client_organizations
ALTER TABLE public.client_organizations
ADD COLUMN IF NOT EXISTS bonus_seats integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS bonus_reason text,
ADD COLUMN IF NOT EXISTS max_concurrent_sessions integer NOT NULL DEFAULT 1;

-- 2. Change default seat_limit to 2 for new organizations
ALTER TABLE public.client_organizations
ALTER COLUMN seat_limit SET DEFAULT 2;

-- 3. Update ALL existing organizations from 5 to 2
UPDATE public.client_organizations 
SET seat_limit = 2 
WHERE seat_limit = 5;

-- 4. Create seat_change_log table for audit trail
CREATE TABLE IF NOT EXISTS public.seat_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  changed_by uuid NOT NULL,
  change_type text NOT NULL CHECK (change_type IN ('limit_update', 'bonus_added', 'bonus_removed', 'bonus_updated')),
  old_limit integer,
  new_limit integer,
  old_bonus integer,
  new_bonus integer,
  reason text,
  created_at timestamptz DEFAULT now()
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_seat_change_log_org ON public.seat_change_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_seat_change_log_created ON public.seat_change_log(created_at DESC);

-- Enable RLS on seat_change_log
ALTER TABLE public.seat_change_log ENABLE ROW LEVEL SECURITY;

-- RLS: Only platform admins can view and insert
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'seat_change_log' AND policyname = 'Admins can read seat changes') THEN
    CREATE POLICY "Admins can read seat changes"
    ON public.seat_change_log FOR SELECT
    USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'seat_change_log' AND policyname = 'Admins can insert seat changes') THEN
    CREATE POLICY "Admins can insert seat changes"
    ON public.seat_change_log FOR INSERT
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- 5. DROP the existing function first, then recreate with new return type
DROP FUNCTION IF EXISTS public.get_org_seat_usage(uuid);

CREATE FUNCTION public.get_org_seat_usage(org_id uuid)
RETURNS TABLE(
  seat_limit integer, 
  bonus_seats integer,
  total_entitled integer,
  members_count bigint, 
  pending_invites_count bigint, 
  pending_requests_count bigint, 
  total_used bigint, 
  available_seats bigint
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    co.seat_limit,
    co.bonus_seats,
    (co.seat_limit + co.bonus_seats)::integer as total_entitled,
    (SELECT COUNT(*) FROM public.client_users cu 
     WHERE cu.organization_id = org_id 
     AND cu.status = 'active') as members_count,
    (SELECT COUNT(*) FROM public.user_invitations ui 
     WHERE ui.organization_id = org_id 
     AND ui.status = 'pending' 
     AND ui.invitation_type = 'organization_member') as pending_invites_count,
    (SELECT COUNT(*) FROM public.pending_member_requests pmr 
     WHERE pmr.organization_id = org_id 
     AND pmr.status = 'pending') as pending_requests_count,
    -- Total used = active members + pending invites (not pending requests as they aren't approved yet)
    (SELECT COUNT(*) FROM public.client_users cu 
     WHERE cu.organization_id = org_id 
     AND cu.status = 'active') +
    (SELECT COUNT(*) FROM public.user_invitations ui 
     WHERE ui.organization_id = org_id 
     AND ui.status = 'pending' 
     AND ui.invitation_type = 'organization_member') as total_used,
    -- Available = (limit + bonus) - total_used
    (co.seat_limit + co.bonus_seats) - (
      (SELECT COUNT(*) FROM public.client_users cu 
       WHERE cu.organization_id = org_id 
       AND cu.status = 'active') +
      (SELECT COUNT(*) FROM public.user_invitations ui 
       WHERE ui.organization_id = org_id 
       AND ui.status = 'pending' 
       AND ui.invitation_type = 'organization_member')
    ) as available_seats
  FROM public.client_organizations co
  WHERE co.id = org_id;
END;
$$;

-- 6. Create function to log seat changes automatically
CREATE OR REPLACE FUNCTION public.log_seat_change(
  p_org_id uuid,
  p_changed_by uuid,
  p_change_type text,
  p_old_limit integer DEFAULT NULL,
  p_new_limit integer DEFAULT NULL,
  p_old_bonus integer DEFAULT NULL,
  p_new_bonus integer DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO public.seat_change_log (
    organization_id,
    changed_by,
    change_type,
    old_limit,
    new_limit,
    old_bonus,
    new_bonus,
    reason
  ) VALUES (
    p_org_id,
    p_changed_by,
    p_change_type,
    p_old_limit,
    p_new_limit,
    p_old_bonus,
    p_new_bonus,
    p_reason
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- 7. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_org_seat_usage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_seat_change(uuid, uuid, text, integer, integer, integer, integer, text) TO authenticated;