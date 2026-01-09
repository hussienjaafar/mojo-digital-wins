-- Create integration summary view for efficient querying
CREATE OR REPLACE VIEW public.v_integration_summary AS
SELECT 
  co.id AS organization_id,
  co.name AS organization_name,
  co.slug AS organization_slug,
  co.is_active AS org_is_active,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', cac.id,
        'platform', cac.platform,
        'is_active', cac.is_active,
        'last_sync_at', cac.last_sync_at,
        'last_sync_status', cac.last_sync_status,
        'last_sync_error', cac.last_sync_error,
        'sync_error_count', cac.sync_error_count,
        'last_tested_at', cac.last_tested_at,
        'last_test_status', cac.last_test_status,
        'created_at', cac.created_at
      ) ORDER BY cac.platform
    ) FILTER (WHERE cac.id IS NOT NULL),
    '[]'::jsonb
  ) AS integrations,
  COUNT(cac.id)::int AS total_count,
  COUNT(CASE WHEN cac.is_active AND cac.last_sync_status = 'success' THEN 1 END)::int AS healthy_count,
  COUNT(CASE WHEN cac.last_sync_status IN ('error', 'failed') THEN 1 END)::int AS error_count,
  COUNT(CASE WHEN NOT cac.is_active THEN 1 END)::int AS disabled_count,
  COUNT(CASE WHEN cac.last_tested_at IS NULL THEN 1 END)::int AS untested_count,
  -- Derived health status
  CASE
    WHEN COUNT(cac.id) = 0 THEN 'no_setup'
    WHEN COUNT(CASE WHEN cac.last_sync_status IN ('error', 'failed') THEN 1 END) > 0 THEN 'needs_attention'
    WHEN COUNT(CASE WHEN NOT cac.is_active THEN 1 END) = COUNT(cac.id) THEN 'all_disabled'
    WHEN COUNT(CASE WHEN cac.last_tested_at IS NULL THEN 1 END) > 0 THEN 'untested'
    ELSE 'healthy'
  END AS health_status
FROM client_organizations co
LEFT JOIN client_api_credentials cac ON cac.organization_id = co.id
WHERE co.is_active = true
GROUP BY co.id, co.name, co.slug, co.is_active
ORDER BY 
  CASE 
    WHEN COUNT(CASE WHEN cac.last_sync_status IN ('error', 'failed') THEN 1 END) > 0 THEN 0
    WHEN COUNT(CASE WHEN cac.last_tested_at IS NULL AND cac.id IS NOT NULL THEN 1 END) > 0 THEN 1
    WHEN COUNT(cac.id) = 0 THEN 2
    ELSE 3
  END,
  co.name;