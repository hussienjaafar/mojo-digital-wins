-- =============================================================================
-- TIERED META SYNC PRIORITY SYSTEM
-- =============================================================================

-- 1. Add sync priority and tracking fields to client_api_credentials
ALTER TABLE public.client_api_credentials
ADD COLUMN IF NOT EXISTS meta_sync_priority TEXT DEFAULT 'medium' CHECK (meta_sync_priority IN ('high', 'medium', 'low')),
ADD COLUMN IF NOT EXISTS last_meta_sync_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS latest_meta_data_date DATE,
ADD COLUMN IF NOT EXISTS sync_error_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_sync_error TEXT,
ADD COLUMN IF NOT EXISTS rate_limit_backoff_until TIMESTAMPTZ;

-- Add comment explaining the priority levels
COMMENT ON COLUMN public.client_api_credentials.meta_sync_priority IS 
'Sync frequency tier: high=1hr, medium=2hrs, low=4hrs';

-- 2. Create a meta_sync_config table for centralized configuration
CREATE TABLE IF NOT EXISTS public.meta_sync_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier TEXT NOT NULL UNIQUE CHECK (tier IN ('high', 'medium', 'low')),
  interval_minutes INTEGER NOT NULL,
  date_range_days INTEGER NOT NULL DEFAULT 2,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default tier configurations
INSERT INTO public.meta_sync_config (tier, interval_minutes, date_range_days, description)
VALUES 
  ('high', 60, 2, 'High-priority accounts: sync every hour, fetch last 2 days'),
  ('medium', 120, 3, 'Medium-priority accounts: sync every 2 hours, fetch last 3 days'),
  ('low', 240, 7, 'Low-priority accounts: sync every 4 hours, fetch last 7 days')
ON CONFLICT (tier) DO UPDATE SET
  interval_minutes = EXCLUDED.interval_minutes,
  date_range_days = EXCLUDED.date_range_days,
  description = EXCLUDED.description,
  updated_at = now();

-- Enable RLS
ALTER TABLE public.meta_sync_config ENABLE ROW LEVEL SECURITY;

-- Admin-only access for config
CREATE POLICY "Admins can read sync config"
ON public.meta_sync_config FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins can modify sync config"
ON public.meta_sync_config FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 3. Create a view for easy sync status monitoring
CREATE OR REPLACE VIEW public.meta_sync_status AS
SELECT 
  c.id AS credential_id,
  c.organization_id,
  o.name AS organization_name,
  c.meta_sync_priority,
  c.is_active,
  c.last_meta_sync_at,
  c.latest_meta_data_date,
  c.last_sync_status,
  c.sync_error_count,
  c.last_sync_error,
  c.rate_limit_backoff_until,
  cfg.interval_minutes,
  cfg.date_range_days,
  -- Calculate if sync is due
  CASE 
    WHEN c.rate_limit_backoff_until > now() THEN FALSE
    WHEN c.last_meta_sync_at IS NULL THEN TRUE
    WHEN EXTRACT(EPOCH FROM (now() - c.last_meta_sync_at)) / 60 >= cfg.interval_minutes THEN TRUE
    ELSE FALSE
  END AS sync_due,
  -- Minutes until next sync
  GREATEST(0, cfg.interval_minutes - EXTRACT(EPOCH FROM (now() - COALESCE(c.last_meta_sync_at, now() - INTERVAL '1 day'))) / 60)::INTEGER AS minutes_until_sync,
  -- Data freshness (days behind)
  CASE 
    WHEN c.latest_meta_data_date IS NULL THEN NULL
    ELSE CURRENT_DATE - c.latest_meta_data_date
  END AS data_lag_days
FROM public.client_api_credentials c
JOIN public.client_organizations o ON c.organization_id = o.id
LEFT JOIN public.meta_sync_config cfg ON c.meta_sync_priority = cfg.tier
WHERE c.platform = 'meta';

-- Grant access to the view
GRANT SELECT ON public.meta_sync_status TO authenticated;

-- 4. Create a function to get accounts due for sync
CREATE OR REPLACE FUNCTION public.get_meta_accounts_due_for_sync(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  credential_id UUID,
  organization_id UUID,
  organization_name TEXT,
  sync_priority TEXT,
  interval_minutes INTEGER,
  date_range_days INTEGER,
  last_sync_at TIMESTAMPTZ,
  minutes_overdue INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id AS credential_id,
    c.organization_id,
    o.name AS organization_name,
    c.meta_sync_priority AS sync_priority,
    cfg.interval_minutes,
    cfg.date_range_days,
    c.last_meta_sync_at AS last_sync_at,
    GREATEST(0, 
      (EXTRACT(EPOCH FROM (now() - COALESCE(c.last_meta_sync_at, now() - INTERVAL '1 day'))) / 60 - cfg.interval_minutes)
    )::INTEGER AS minutes_overdue
  FROM public.client_api_credentials c
  JOIN public.client_organizations o ON c.organization_id = o.id
  JOIN public.meta_sync_config cfg ON c.meta_sync_priority = cfg.tier
  WHERE c.platform = 'meta'
    AND c.is_active = TRUE
    AND (c.rate_limit_backoff_until IS NULL OR c.rate_limit_backoff_until <= now())
    AND (
      c.last_meta_sync_at IS NULL
      OR EXTRACT(EPOCH FROM (now() - c.last_meta_sync_at)) / 60 >= cfg.interval_minutes
    )
  ORDER BY 
    -- Priority order: high first, then medium, then low
    CASE c.meta_sync_priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
    -- Then by how overdue they are
    minutes_overdue DESC
  LIMIT p_limit;
END;
$$;

-- 5. Create a function to update sync status after completion
CREATE OR REPLACE FUNCTION public.update_meta_sync_status(
  p_organization_id UUID,
  p_status TEXT,
  p_latest_data_date DATE DEFAULT NULL,
  p_error TEXT DEFAULT NULL,
  p_is_rate_limited BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.client_api_credentials
  SET 
    last_meta_sync_at = CASE WHEN p_status IN ('success', 'success_no_data') THEN now() ELSE last_meta_sync_at END,
    last_sync_at = now(),
    last_sync_status = p_status,
    latest_meta_data_date = COALESCE(p_latest_data_date, latest_meta_data_date),
    sync_error_count = CASE WHEN p_status = 'success' THEN 0 ELSE sync_error_count + 1 END,
    last_sync_error = p_error,
    rate_limit_backoff_until = CASE 
      WHEN p_is_rate_limited THEN now() + INTERVAL '15 minutes'
      ELSE NULL 
    END,
    updated_at = now()
  WHERE organization_id = p_organization_id
    AND platform = 'meta';
END;
$$;

-- 6. Update the scheduled_jobs table to have the tiered scheduler run every 15 minutes
UPDATE public.scheduled_jobs 
SET 
  schedule = '*/15 * * * *',
  job_name = 'Meta Ads Tiered Sync',
  updated_at = now()
WHERE job_type = 'sync_meta_ads' AND job_name = 'Sync Meta Ads Data';

-- Set default priority for existing credentials
UPDATE public.client_api_credentials 
SET meta_sync_priority = 'medium'
WHERE platform = 'meta' AND meta_sync_priority IS NULL;