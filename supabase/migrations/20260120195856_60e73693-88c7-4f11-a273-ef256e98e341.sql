-- =====================================================
-- Phase 3: GDPR/CCPA Compliance Tables
-- Date: 2026-01-20
-- Addresses: GDPR-001, GDPR-002, GDPR-003, GDPR-005
-- =====================================================

-- 1. Consent Records Table (GDPR Art. 6-7)
CREATE TABLE IF NOT EXISTS public.consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  consent_type TEXT NOT NULL, -- 'marketing', 'analytics', 'essential', 'third_party'
  granted BOOLEAN NOT NULL DEFAULT false,
  granted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  ip_address INET,
  user_agent TEXT,
  consent_version TEXT NOT NULL DEFAULT '1.0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_consent_type UNIQUE (user_id, consent_type)
);

-- 2. Data Export Requests Table (GDPR Art. 15, 20)
CREATE TABLE IF NOT EXISTS public.data_export_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'expired'
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  download_url TEXT,
  download_expires_at TIMESTAMPTZ,
  error_message TEXT,
  format TEXT NOT NULL DEFAULT 'json', -- 'json', 'csv'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Data Deletion Requests Table (GDPR Art. 17 - Right to Erasure)
CREATE TABLE IF NOT EXISTS public.data_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'cancelled'
  reason TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_at TIMESTAMPTZ, -- Grace period before deletion
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  deleted_tables JSONB, -- Track what was deleted
  error_message TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Privacy Settings Table
CREATE TABLE IF NOT EXISTS public.privacy_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  do_not_sell BOOLEAN NOT NULL DEFAULT false, -- CCPA
  marketing_emails BOOLEAN NOT NULL DEFAULT true,
  product_updates BOOLEAN NOT NULL DEFAULT true,
  third_party_sharing BOOLEAN NOT NULL DEFAULT false,
  analytics_tracking BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Data Retention Policies Table
CREATE TABLE IF NOT EXISTS public.data_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL UNIQUE,
  retention_days INTEGER NOT NULL DEFAULT 365,
  archive_before_delete BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_cleanup_at TIMESTAMPTZ,
  next_cleanup_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_export_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;

-- Consent Records Policies
CREATE POLICY "Users can view their own consent records"
  ON public.consent_records FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own consent"
  ON public.consent_records FOR ALL
  USING (auth.uid() = user_id);

-- Data Export Requests Policies
CREATE POLICY "Users can view their own export requests"
  ON public.data_export_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create export requests"
  ON public.data_export_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Data Deletion Requests Policies
CREATE POLICY "Users can view their own deletion requests"
  ON public.data_deletion_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create deletion requests"
  ON public.data_deletion_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can cancel their own pending deletion requests"
  ON public.data_deletion_requests FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending');

-- Privacy Settings Policies
CREATE POLICY "Users can view their own privacy settings"
  ON public.privacy_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own privacy settings"
  ON public.privacy_settings FOR ALL
  USING (auth.uid() = user_id);

-- Data Retention Policies - Admin only via service role
CREATE POLICY "Admins can manage retention policies"
  ON public.data_retention_policies FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Function: Update user consent
CREATE OR REPLACE FUNCTION public.update_user_consent(
  p_consent_type TEXT,
  p_granted BOOLEAN,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record_id UUID;
BEGIN
  INSERT INTO public.consent_records (
    user_id, consent_type, granted, granted_at, revoked_at, ip_address, user_agent
  )
  VALUES (
    auth.uid(),
    p_consent_type,
    p_granted,
    CASE WHEN p_granted THEN now() ELSE NULL END,
    CASE WHEN NOT p_granted THEN now() ELSE NULL END,
    p_ip_address,
    p_user_agent
  )
  ON CONFLICT (user_id, consent_type) DO UPDATE SET
    granted = EXCLUDED.granted,
    granted_at = CASE WHEN EXCLUDED.granted THEN now() ELSE consent_records.granted_at END,
    revoked_at = CASE WHEN NOT EXCLUDED.granted THEN now() ELSE NULL END,
    ip_address = COALESCE(EXCLUDED.ip_address, consent_records.ip_address),
    user_agent = COALESCE(EXCLUDED.user_agent, consent_records.user_agent),
    updated_at = now()
  RETURNING id INTO v_record_id;
  
  RETURN v_record_id;
END;
$$;

-- Function: Request data export
CREATE OR REPLACE FUNCTION public.request_data_export(
  p_format TEXT DEFAULT 'json'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id UUID;
  v_pending_count INTEGER;
BEGIN
  -- Check for existing pending requests (rate limiting)
  SELECT COUNT(*) INTO v_pending_count
  FROM public.data_export_requests
  WHERE user_id = auth.uid()
    AND status IN ('pending', 'processing')
    AND requested_at > now() - INTERVAL '24 hours';
  
  IF v_pending_count > 0 THEN
    RAISE EXCEPTION 'You already have a pending export request. Please wait for it to complete.';
  END IF;
  
  INSERT INTO public.data_export_requests (user_id, format)
  VALUES (auth.uid(), p_format)
  RETURNING id INTO v_request_id;
  
  RETURN v_request_id;
END;
$$;

-- Function: Request account deletion
CREATE OR REPLACE FUNCTION public.request_account_deletion(
  p_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id UUID;
  v_pending_count INTEGER;
BEGIN
  -- Check for existing pending requests
  SELECT COUNT(*) INTO v_pending_count
  FROM public.data_deletion_requests
  WHERE user_id = auth.uid()
    AND status = 'pending';
  
  IF v_pending_count > 0 THEN
    RAISE EXCEPTION 'You already have a pending deletion request.';
  END IF;
  
  -- Schedule deletion for 14 days from now (grace period)
  INSERT INTO public.data_deletion_requests (user_id, reason, scheduled_at)
  VALUES (auth.uid(), p_reason, now() + INTERVAL '14 days')
  RETURNING id INTO v_request_id;
  
  RETURN v_request_id;
END;
$$;

-- Function: Cancel deletion request
CREATE OR REPLACE FUNCTION public.cancel_deletion_request(
  p_request_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.data_deletion_requests
  SET 
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = auth.uid()
  WHERE id = p_request_id
    AND user_id = auth.uid()
    AND status = 'pending';
  
  RETURN FOUND;
END;
$$;

-- Insert default retention policies
INSERT INTO public.data_retention_policies (table_name, retention_days, archive_before_delete)
VALUES
  ('bluesky_posts', 90, true),
  ('articles', 365, true),
  ('admin_audit_logs', 730, true), -- 2 years for audit logs
  ('login_attempts', 90, false),
  ('ai_analysis_cache', 30, false)
ON CONFLICT (table_name) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_consent_records_user_id ON public.consent_records(user_id);
CREATE INDEX IF NOT EXISTS idx_data_export_requests_user_status ON public.data_export_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_user_status ON public.data_deletion_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_scheduled ON public.data_deletion_requests(scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_privacy_settings_user_id ON public.privacy_settings(user_id);