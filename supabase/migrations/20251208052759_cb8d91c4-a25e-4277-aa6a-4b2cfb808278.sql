-- Phase 2 & 3 & 4: Additional tables and policies

-- Organization quotas table for rate limiting (if not exists)
CREATE TABLE IF NOT EXISTS public.organization_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.client_organizations(id) ON DELETE CASCADE NOT NULL,
  quota_type TEXT NOT NULL,
  max_per_hour INTEGER DEFAULT 100,
  max_per_day INTEGER DEFAULT 1000,
  current_hour_count INTEGER DEFAULT 0,
  current_day_count INTEGER DEFAULT 0,
  hour_reset_at TIMESTAMPTZ DEFAULT date_trunc('hour', now()) + interval '1 hour',
  day_reset_at TIMESTAMPTZ DEFAULT date_trunc('day', now()) + interval '1 day',
  is_unlimited BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, quota_type)
);

ALTER TABLE public.organization_quotas ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view own org quotas" ON public.organization_quotas;
  DROP POLICY IF EXISTS "Admins can manage quotas" ON public.organization_quotas;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE POLICY "Users can view own org quotas"
  ON public.organization_quotas FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_organization(organization_id));

CREATE POLICY "Admins can manage quotas"
  ON public.organization_quotas FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Processing checkpoints table
CREATE TABLE IF NOT EXISTS public.processing_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL UNIQUE,
  last_processed_at TIMESTAMPTZ,
  last_processed_id TEXT,
  records_processed BIGINT DEFAULT 0,
  checkpoint_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.processing_checkpoints ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins can manage checkpoints" ON public.processing_checkpoints;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE POLICY "Admins can manage checkpoints"
  ON public.processing_checkpoints FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Phase 3: PII Protection
ALTER TABLE public.client_users 
ADD COLUMN IF NOT EXISTS mask_pii BOOLEAN DEFAULT TRUE;

UPDATE public.client_users 
SET mask_pii = FALSE 
WHERE role IN ('admin', 'manager') AND mask_pii IS NULL;

CREATE OR REPLACE FUNCTION public.set_mask_pii_on_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IN ('admin', 'manager') THEN
    NEW.mask_pii := FALSE;
  ELSE
    NEW.mask_pii := TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_set_mask_pii ON public.client_users;
CREATE TRIGGER trigger_set_mask_pii
  BEFORE INSERT OR UPDATE OF role ON public.client_users
  FOR EACH ROW
  EXECUTE FUNCTION public.set_mask_pii_on_role_change();

-- Phase 4: Data export logs
CREATE TABLE IF NOT EXISTS public.data_export_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  organization_id UUID REFERENCES public.client_organizations(id),
  export_type TEXT NOT NULL,
  record_count INTEGER,
  filters_applied JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_export_logs_user ON public.data_export_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_export_logs_org ON public.data_export_logs(organization_id, created_at DESC);

ALTER TABLE public.data_export_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins can view all export logs" ON public.data_export_logs;
  DROP POLICY IF EXISTS "Org admins can view org export logs" ON public.data_export_logs;
  DROP POLICY IF EXISTS "Users can log their own exports" ON public.data_export_logs;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE POLICY "Admins can view all export logs"
  ON public.data_export_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Org admins can view org export logs"
  ON public.data_export_logs FOR SELECT
  TO authenticated
  USING (
    public.user_belongs_to_organization(organization_id) 
    AND public.is_org_admin_or_manager()
  );

CREATE POLICY "Users can log their own exports"
  ON public.data_export_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);