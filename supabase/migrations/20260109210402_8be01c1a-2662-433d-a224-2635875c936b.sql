-- Drop and recreate the onboarding summary view with enhanced status inference
DROP VIEW IF EXISTS public.org_onboarding_summary;

CREATE OR REPLACE VIEW public.org_onboarding_summary AS
SELECT 
  co.id as organization_id,
  co.name as organization_name,
  co.slug,
  co.is_active,
  co.created_at as org_created_at,
  COALESCE(oos.current_step, 1) as current_step,
  COALESCE(oos.completed_steps, '[]'::jsonb) as completed_steps,
  COALESCE(oos.status, 'not_started'::text) as onboarding_status,
  oos.blocking_reason,
  oos.last_updated_at as onboarding_updated_at,
  (SELECT COUNT(*)::integer FROM client_users cu WHERE cu.organization_id = co.id) as user_count,
  (SELECT COUNT(*)::integer FROM client_api_credentials cac WHERE cac.organization_id = co.id AND cac.is_active = true) as integration_count,
  (SELECT COUNT(*)::integer FROM client_api_credentials cac WHERE cac.organization_id = co.id AND cac.last_sync_status = 'error') as error_count,
  EXISTS(SELECT 1 FROM organization_profiles op WHERE op.organization_id = co.id) as has_profile,
  -- Effective status with smart inference for orgs without explicit state
  CASE
    WHEN oos.status = 'completed' THEN 'completed'
    WHEN oos.status = 'blocked' THEN 'blocked'
    WHEN oos.status = 'in_progress' THEN 'in_progress'
    WHEN oos.current_step > 1 THEN 'in_progress'
    WHEN EXISTS(SELECT 1 FROM organization_profiles op WHERE op.organization_id = co.id) THEN 'in_progress'
    WHEN (SELECT COUNT(*) FROM client_users cu WHERE cu.organization_id = co.id) > 0 THEN 'in_progress'
    WHEN (SELECT COUNT(*) FROM client_api_credentials cac WHERE cac.organization_id = co.id) > 0 THEN 'in_progress'
    ELSE 'not_started'
  END as effective_status,
  -- Progress percentage calculation
  CASE
    WHEN oos.status = 'completed' THEN 100
    WHEN jsonb_array_length(COALESCE(oos.completed_steps, '[]'::jsonb)) > 0 THEN 
      ROUND((jsonb_array_length(oos.completed_steps)::numeric / 6.0) * 100)::integer
    ELSE 0
  END as progress_percentage
FROM client_organizations co
LEFT JOIN org_onboarding_state oos ON oos.organization_id = co.id
ORDER BY 
  CASE 
    WHEN oos.status = 'blocked' THEN 1
    WHEN oos.status IS NULL OR oos.status = 'not_started' THEN 2
    WHEN oos.status = 'in_progress' THEN 3
    ELSE 4
  END,
  co.created_at DESC;

-- Grant access to the view
GRANT SELECT ON public.org_onboarding_summary TO authenticated;
GRANT SELECT ON public.org_onboarding_summary TO anon;