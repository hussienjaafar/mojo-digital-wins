-- =====================================================
-- PHASE 1: Admin Onboarding & Security Hardening
-- =====================================================

-- 1. Create org_onboarding_state table for wizard progress
CREATE TABLE IF NOT EXISTS public.org_onboarding_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  current_step INTEGER NOT NULL DEFAULT 1,
  completed_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  step_data JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'blocked')),
  blocking_reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  last_updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- Enable RLS
ALTER TABLE public.org_onboarding_state ENABLE ROW LEVEL SECURITY;

-- Admin-only access
CREATE POLICY "Admins can manage onboarding state"
ON public.org_onboarding_state FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Add credential metadata columns to client_api_credentials
ALTER TABLE public.client_api_credentials 
ADD COLUMN IF NOT EXISTS credential_mask JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS credential_version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS rotated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rotated_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS last_tested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_test_status TEXT,
ADD COLUMN IF NOT EXISTS last_test_error TEXT;

-- 3. Create trigger to auto-update last_updated_at
CREATE OR REPLACE FUNCTION public.update_org_onboarding_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS update_org_onboarding_state_timestamp ON public.org_onboarding_state;
CREATE TRIGGER update_org_onboarding_state_timestamp
BEFORE UPDATE ON public.org_onboarding_state
FOR EACH ROW
EXECUTE FUNCTION public.update_org_onboarding_timestamp();

-- 4. Create function to log admin actions for onboarding (extends existing log_admin_action)
CREATE OR REPLACE FUNCTION public.log_onboarding_action(
  _organization_id UUID,
  _action_type TEXT,
  _step INTEGER DEFAULT NULL,
  _details JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _log_id UUID;
BEGIN
  INSERT INTO public.admin_audit_logs (
    user_id,
    action_type,
    table_affected,
    record_id,
    new_value
  ) VALUES (
    auth.uid(),
    'onboarding_' || _action_type,
    'org_onboarding_state',
    _organization_id::text,
    jsonb_build_object(
      'step', _step,
      'details', _details
    )
  )
  RETURNING id INTO _log_id;
  
  RETURN _log_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.log_onboarding_action(UUID, TEXT, INTEGER, JSONB) TO authenticated;

-- 5. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_org_onboarding_state_org_id 
ON public.org_onboarding_state(organization_id);

CREATE INDEX IF NOT EXISTS idx_org_onboarding_state_status 
ON public.org_onboarding_state(status);

-- 6. Create view for onboarding progress with org details
CREATE OR REPLACE VIEW public.org_onboarding_summary
WITH (security_invoker = true)
AS
SELECT 
  o.id as organization_id,
  o.name as organization_name,
  o.slug,
  o.is_active,
  o.created_at as org_created_at,
  COALESCE(s.current_step, 0) as current_step,
  COALESCE(s.completed_steps, '[]'::jsonb) as completed_steps,
  COALESCE(s.status, 'not_started') as onboarding_status,
  s.blocking_reason,
  s.last_updated_at as onboarding_updated_at,
  (SELECT COUNT(*) FROM public.client_users cu WHERE cu.organization_id = o.id) as user_count,
  (SELECT COUNT(*) FROM public.client_api_credentials cac WHERE cac.organization_id = o.id AND cac.is_active = true) as integration_count,
  EXISTS(SELECT 1 FROM public.organization_profiles op WHERE op.organization_id = o.id) as has_profile
FROM public.client_organizations o
LEFT JOIN public.org_onboarding_state s ON s.organization_id = o.id;

GRANT SELECT ON public.org_onboarding_summary TO authenticated;

-- 7. Add comment for documentation
COMMENT ON TABLE public.org_onboarding_state IS 'Tracks wizard progress for new client onboarding. Each org has at most one onboarding state record.';
COMMENT ON COLUMN public.org_onboarding_state.current_step IS 'Current wizard step (1-6): 1=Create, 2=Profile, 3=Users, 4=Integrations, 5=Watchlists, 6=Activate';
COMMENT ON COLUMN public.org_onboarding_state.completed_steps IS 'Array of step numbers that have been completed';
COMMENT ON COLUMN public.org_onboarding_state.step_data IS 'Temporary data for in-progress steps';
COMMENT ON COLUMN public.client_api_credentials.credential_mask IS 'Safe-to-display masked version of credentials (e.g., last 4 chars)';