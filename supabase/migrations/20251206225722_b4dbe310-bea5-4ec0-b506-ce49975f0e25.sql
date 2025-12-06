-- ============================================
-- DATA FRESHNESS TRACKING SYSTEM
-- Unified freshness monitoring for all data sources
-- ============================================

-- Create the main data_freshness tracking table
CREATE TABLE IF NOT EXISTS public.data_freshness (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL, -- 'meta', 'actblue_webhook', 'actblue_csv', 'switchboard'
  scope text NOT NULL DEFAULT 'global', -- 'global' or organization_id
  organization_id uuid REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  
  -- Sync status
  last_synced_at timestamptz,
  last_sync_status text DEFAULT 'pending', -- 'success', 'error', 'pending', 'stale'
  last_error text,
  
  -- Data currency
  latest_data_timestamp timestamptz, -- Latest date of underlying data
  data_lag_hours numeric DEFAULT 0,
  
  -- SLA tracking
  freshness_sla_hours integer NOT NULL DEFAULT 24, -- Target freshness
  is_within_sla boolean DEFAULT true,
  sla_breach_count integer DEFAULT 0,
  
  -- Metadata
  records_synced integer DEFAULT 0,
  sync_duration_ms integer,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Unique constraint per source/scope/org combination
  UNIQUE(source, scope, organization_id)
);

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_data_freshness_source ON public.data_freshness(source);
CREATE INDEX IF NOT EXISTS idx_data_freshness_org ON public.data_freshness(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_data_freshness_sla ON public.data_freshness(is_within_sla) WHERE is_within_sla = false;

-- Enable RLS
ALTER TABLE public.data_freshness ENABLE ROW LEVEL SECURITY;

-- RLS policies - admins full access, clients can see their org's freshness
CREATE POLICY "data_freshness_admin_all" ON public.data_freshness
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "data_freshness_client_select" ON public.data_freshness
  FOR SELECT TO authenticated
  USING (
    scope = 'global' 
    OR organization_id IN (
      SELECT organization_id FROM public.client_users WHERE id = auth.uid()
    )
  );

-- ============================================
-- FRESHNESS SLA CONFIGURATION
-- ============================================
CREATE TABLE IF NOT EXISTS public.freshness_sla_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL UNIQUE,
  target_freshness_hours integer NOT NULL,
  sync_interval_minutes integer NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert SLA configurations
INSERT INTO public.freshness_sla_config (source, target_freshness_hours, sync_interval_minutes, description)
VALUES 
  ('meta', 24, 240, 'Meta Marketing API - data no more than 24 hours old, sync every 4 hours'),
  ('actblue_webhook', 1, 0, 'ActBlue webhooks - near real-time, processed immediately'),
  ('actblue_csv', 24, 360, 'ActBlue CSV reconciliation - nightly backup, sync every 6 hours'),
  ('switchboard', 4, 60, 'Switchboard/OneSwitchboard - sync every 60 minutes for fresh SMS data')
ON CONFLICT (source) DO UPDATE SET
  target_freshness_hours = EXCLUDED.target_freshness_hours,
  sync_interval_minutes = EXCLUDED.sync_interval_minutes,
  description = EXCLUDED.description,
  updated_at = now();

-- Enable RLS for config table
ALTER TABLE public.freshness_sla_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "freshness_config_select_auth" ON public.freshness_sla_config
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "freshness_config_admin_all" ON public.freshness_sla_config
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- ============================================
-- FUNCTION: Update data freshness record
-- ============================================
CREATE OR REPLACE FUNCTION public.update_data_freshness(
  p_source text,
  p_organization_id uuid DEFAULT NULL,
  p_latest_data_timestamp timestamptz DEFAULT NULL,
  p_sync_status text DEFAULT 'success',
  p_error text DEFAULT NULL,
  p_records_synced integer DEFAULT 0,
  p_duration_ms integer DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_scope text;
  v_freshness_id uuid;
  v_sla_hours integer;
  v_data_lag_hours numeric;
  v_is_within_sla boolean;
BEGIN
  -- Determine scope
  v_scope := CASE WHEN p_organization_id IS NULL THEN 'global' ELSE p_organization_id::text END;
  
  -- Get SLA config
  SELECT target_freshness_hours INTO v_sla_hours
  FROM public.freshness_sla_config WHERE source = p_source;
  
  IF v_sla_hours IS NULL THEN
    v_sla_hours := 24; -- Default to 24 hours
  END IF;
  
  -- Calculate data lag
  IF p_latest_data_timestamp IS NOT NULL THEN
    v_data_lag_hours := EXTRACT(EPOCH FROM (now() - p_latest_data_timestamp)) / 3600;
  ELSE
    v_data_lag_hours := NULL;
  END IF;
  
  -- Check SLA compliance
  v_is_within_sla := COALESCE(v_data_lag_hours, 0) <= v_sla_hours;
  
  -- Upsert freshness record
  INSERT INTO public.data_freshness (
    source, scope, organization_id, last_synced_at, last_sync_status, last_error,
    latest_data_timestamp, data_lag_hours, freshness_sla_hours, is_within_sla,
    sla_breach_count, records_synced, sync_duration_ms, updated_at
  ) VALUES (
    p_source, v_scope, p_organization_id, now(), p_sync_status, p_error,
    p_latest_data_timestamp, v_data_lag_hours, v_sla_hours, v_is_within_sla,
    CASE WHEN v_is_within_sla THEN 0 ELSE 1 END, p_records_synced, p_duration_ms, now()
  )
  ON CONFLICT (source, scope, organization_id) DO UPDATE SET
    last_synced_at = now(),
    last_sync_status = p_sync_status,
    last_error = CASE WHEN p_sync_status = 'success' THEN NULL ELSE COALESCE(p_error, data_freshness.last_error) END,
    latest_data_timestamp = COALESCE(p_latest_data_timestamp, data_freshness.latest_data_timestamp),
    data_lag_hours = COALESCE(v_data_lag_hours, data_freshness.data_lag_hours),
    is_within_sla = v_is_within_sla,
    sla_breach_count = CASE 
      WHEN v_is_within_sla THEN 0 
      ELSE data_freshness.sla_breach_count + 1 
    END,
    records_synced = CASE 
      WHEN p_records_synced > 0 THEN p_records_synced 
      ELSE data_freshness.records_synced 
    END,
    sync_duration_ms = COALESCE(p_duration_ms, data_freshness.sync_duration_ms),
    updated_at = now()
  RETURNING id INTO v_freshness_id;
  
  RETURN v_freshness_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- VIEW: Data freshness summary for dashboards
-- ============================================
CREATE OR REPLACE VIEW public.data_freshness_summary AS
SELECT 
  df.source,
  df.organization_id,
  co.name as organization_name,
  df.last_synced_at,
  df.last_sync_status,
  df.latest_data_timestamp,
  ROUND(df.data_lag_hours::numeric, 1) as data_lag_hours,
  df.freshness_sla_hours,
  df.is_within_sla,
  CASE 
    WHEN df.last_synced_at IS NULL THEN 'Never synced'
    WHEN df.is_within_sla THEN 'Fresh'
    WHEN df.data_lag_hours <= df.freshness_sla_hours * 1.5 THEN 'Slightly stale'
    ELSE 'Stale'
  END as freshness_status,
  CASE 
    WHEN df.source = 'meta' THEN 'Meta Ads'
    WHEN df.source = 'actblue_webhook' THEN 'ActBlue (Real-time)'
    WHEN df.source = 'actblue_csv' THEN 'ActBlue (CSV)'
    WHEN df.source = 'switchboard' THEN 'Switchboard SMS'
    ELSE df.source
  END as source_display_name,
  df.records_synced,
  df.last_error,
  df.updated_at
FROM public.data_freshness df
LEFT JOIN public.client_organizations co ON df.organization_id = co.id;

-- Grant access to view
GRANT SELECT ON public.data_freshness_summary TO authenticated;