DROP VIEW IF EXISTS public.v_integration_summary;

CREATE VIEW public.v_integration_summary AS
SELECT
  o.id AS organization_id,
  o.name AS organization_name,
  o.slug AS organization_slug,
  o.is_active AS org_is_active,
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
        'created_at', cac.created_at,
        'sync_age_hours', CASE
          WHEN cac.last_sync_at IS NOT NULL THEN ROUND(EXTRACT(EPOCH FROM (NOW() - cac.last_sync_at)) / 3600.0, 1)
          ELSE NULL
        END,
        'is_sync_stale', CASE
          WHEN cac.last_sync_at IS NULL THEN false
          WHEN cac.platform = 'meta_ads' THEN EXTRACT(EPOCH FROM (NOW() - cac.last_sync_at)) / 3600.0 > 48
          WHEN cac.platform = 'switchboard' THEN EXTRACT(EPOCH FROM (NOW() - cac.last_sync_at)) / 3600.0 > 2
          WHEN cac.platform = 'actblue' THEN EXTRACT(EPOCH FROM (NOW() - cac.last_sync_at)) / 3600.0 > 24
          ELSE EXTRACT(EPOCH FROM (NOW() - cac.last_sync_at)) / 3600.0 > 48
        END,
        'test_passed', CASE
          WHEN cac.last_tested_at IS NOT NULL THEN cac.last_test_status = 'success'
          ELSE NULL
        END,
        'test_age_hours', CASE
          WHEN cac.last_tested_at IS NOT NULL THEN ROUND(EXTRACT(EPOCH FROM (NOW() - cac.last_tested_at)) / 3600.0, 1)
          ELSE NULL
        END,
        'computed_status', CASE
          WHEN NOT cac.is_active THEN 'disabled'
          WHEN cac.last_sync_status IN ('error', 'failed') THEN 'error'
          WHEN cac.last_tested_at IS NOT NULL AND cac.last_test_status != 'success' THEN 'credentials_invalid'
          WHEN cac.last_sync_at IS NULL AND (cac.last_tested_at IS NULL OR cac.last_test_status != 'success') THEN 'untested'
          WHEN cac.last_sync_at IS NULL AND cac.last_test_status = 'success' THEN 'healthy'
          WHEN cac.platform = 'meta_ads' AND EXTRACT(EPOCH FROM (NOW() - cac.last_sync_at)) / 3600.0 > 48 THEN 'stale'
          WHEN cac.platform = 'switchboard' AND EXTRACT(EPOCH FROM (NOW() - cac.last_sync_at)) / 3600.0 > 2 THEN 'stale'
          WHEN cac.platform = 'actblue' AND EXTRACT(EPOCH FROM (NOW() - cac.last_sync_at)) / 3600.0 > 24 THEN 'stale'
          ELSE 'healthy'
        END
      )
    ) FILTER (WHERE cac.id IS NOT NULL),
    '[]'::jsonb
  ) AS integrations,
  COUNT(cac.id)::int AS total_count,
  COUNT(CASE WHEN cac.is_active
    AND COALESCE(cac.last_sync_status, '') != 'error'
    AND COALESCE(cac.last_sync_status, '') != 'failed'
    AND (cac.last_tested_at IS NULL OR cac.last_test_status = 'success')
    AND (
      (cac.last_sync_at IS NULL AND cac.last_test_status = 'success')
      OR
      (cac.last_sync_at IS NOT NULL AND CASE
        WHEN cac.platform = 'meta_ads' THEN EXTRACT(EPOCH FROM (NOW() - cac.last_sync_at)) / 3600.0 <= 48
        WHEN cac.platform = 'switchboard' THEN EXTRACT(EPOCH FROM (NOW() - cac.last_sync_at)) / 3600.0 <= 2
        WHEN cac.platform = 'actblue' THEN EXTRACT(EPOCH FROM (NOW() - cac.last_sync_at)) / 3600.0 <= 24
        ELSE EXTRACT(EPOCH FROM (NOW() - cac.last_sync_at)) / 3600.0 <= 48
      END)
    )
    THEN 1 END)::int AS healthy_count,
  COUNT(CASE WHEN cac.last_sync_status IN ('error', 'failed') THEN 1 END)::int AS error_count,
  COUNT(CASE WHEN NOT cac.is_active THEN 1 END)::int AS disabled_count,
  COUNT(CASE WHEN cac.is_active
    AND cac.last_sync_at IS NULL
    AND (cac.last_tested_at IS NULL OR cac.last_test_status != 'success')
    THEN 1 END)::int AS untested_count,
  COUNT(CASE WHEN cac.is_active
    AND cac.last_sync_at IS NOT NULL
    AND CASE
      WHEN cac.platform = 'meta_ads' THEN EXTRACT(EPOCH FROM (NOW() - cac.last_sync_at)) / 3600.0 > 48
      WHEN cac.platform = 'switchboard' THEN EXTRACT(EPOCH FROM (NOW() - cac.last_sync_at)) / 3600.0 > 2
      WHEN cac.platform = 'actblue' THEN EXTRACT(EPOCH FROM (NOW() - cac.last_sync_at)) / 3600.0 > 24
      ELSE EXTRACT(EPOCH FROM (NOW() - cac.last_sync_at)) / 3600.0 > 48
    END
    THEN 1 END)::int AS stale_count,
  CASE
    WHEN COUNT(cac.id) = 0 THEN 'no_setup'
    WHEN COUNT(CASE WHEN NOT cac.is_active THEN 1 END) = COUNT(cac.id) THEN 'all_disabled'
    WHEN COUNT(CASE WHEN cac.is_active
      AND cac.last_sync_at IS NULL
      AND (cac.last_tested_at IS NULL OR cac.last_test_status != 'success')
      THEN 1 END) = COUNT(CASE WHEN cac.is_active THEN 1 END) THEN 'untested'
    WHEN COUNT(CASE WHEN cac.last_sync_status IN ('error', 'failed') THEN 1 END) > 0 THEN 'needs_attention'
    ELSE 'healthy'
  END AS health_status
FROM public.client_organizations o
LEFT JOIN public.client_api_credentials cac ON cac.organization_id = o.id
GROUP BY o.id, o.name, o.slug, o.is_active;