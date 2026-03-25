-- Phase 3: GDPR/CCPA Compliance Migration
-- Implements user data export, account deletion, consent management, and data retention

-- ============================================
-- 3.1 Consent Records Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN (
    'terms_of_service',
    'privacy_policy',
    'marketing_emails',
    'analytics_tracking',
    'data_processing',
    'third_party_sharing'
  )),
  granted BOOLEAN NOT NULL,
  policy_version TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  granted_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT unique_user_consent UNIQUE (user_id, consent_type)
);

CREATE INDEX IF NOT EXISTS idx_consent_records_user
ON public.consent_records(user_id);

CREATE INDEX IF NOT EXISTS idx_consent_records_type
ON public.consent_records(consent_type, granted);

-- Enable RLS
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

-- Users can view and manage their own consent
CREATE POLICY "Users can view own consent"
ON public.consent_records FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can manage own consent"
ON public.consent_records FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Admins can view all consent records
CREATE POLICY "Admins can view all consent"
ON public.consent_records FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- ============================================
-- 3.2 Data Export Requests Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.data_export_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'processing',
    'completed',
    'failed',
    'expired'
  )),
  format TEXT NOT NULL DEFAULT 'json' CHECK (format IN ('json', 'csv')),
  requested_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  download_url TEXT,
  file_size_bytes BIGINT,
  error_message TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_export_user
ON public.data_export_requests(user_id, status);

CREATE INDEX IF NOT EXISTS idx_data_export_status
ON public.data_export_requests(status, requested_at);

-- Enable RLS
ALTER TABLE public.data_export_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own export requests
CREATE POLICY "Users can view own exports"
ON public.data_export_requests FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can create export requests
CREATE POLICY "Users can create exports"
ON public.data_export_requests FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Admins can view all export requests
CREATE POLICY "Admins can view all exports"
ON public.data_export_requests FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- ============================================
-- 3.3 Data Deletion Requests Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.data_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'confirmed',
    'processing',
    'completed',
    'cancelled'
  )),
  reason TEXT,
  requested_at TIMESTAMPTZ DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,  -- GDPR allows up to 30 days
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES auth.users(id),
  cancellation_reason TEXT,
  retained_data_types TEXT[],  -- Data types retained for legal reasons
  retention_reason TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deletion_user
ON public.data_deletion_requests(user_id, status);

CREATE INDEX IF NOT EXISTS idx_deletion_scheduled
ON public.data_deletion_requests(scheduled_for)
WHERE status = 'confirmed';

-- Enable RLS
ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own deletion requests
CREATE POLICY "Users can view own deletion requests"
ON public.data_deletion_requests FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can create deletion requests
CREATE POLICY "Users can create deletion requests"
ON public.data_deletion_requests FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can cancel their own pending requests
CREATE POLICY "Users can cancel own requests"
ON public.data_deletion_requests FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND status IN ('pending', 'confirmed'))
WITH CHECK (user_id = auth.uid());

-- Admins can manage all deletion requests
CREATE POLICY "Admins can manage deletions"
ON public.data_deletion_requests FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- ============================================
-- 3.4 Privacy Settings Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.privacy_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Communication preferences
  marketing_emails BOOLEAN DEFAULT false,
  product_updates BOOLEAN DEFAULT true,
  security_alerts BOOLEAN DEFAULT true,

  -- Data usage preferences
  analytics_enabled BOOLEAN DEFAULT true,
  personalization_enabled BOOLEAN DEFAULT true,
  third_party_sharing BOOLEAN DEFAULT false,

  -- Visibility settings
  profile_visible BOOLEAN DEFAULT true,
  activity_visible BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.privacy_settings ENABLE ROW LEVEL SECURITY;

-- Users can manage their own privacy settings
CREATE POLICY "Users can manage own privacy"
ON public.privacy_settings FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ============================================
-- 3.5 Functions for Consent Management
-- ============================================

-- Record or update consent
CREATE OR REPLACE FUNCTION public.record_consent(
  p_consent_type TEXT,
  p_granted BOOLEAN,
  p_policy_version TEXT,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_consent_id UUID;
BEGIN
  INSERT INTO consent_records (
    user_id,
    consent_type,
    granted,
    policy_version,
    ip_address,
    user_agent,
    granted_at,
    withdrawn_at
  )
  VALUES (
    auth.uid(),
    p_consent_type,
    p_granted,
    p_policy_version,
    p_ip_address,
    p_user_agent,
    CASE WHEN p_granted THEN now() ELSE NULL END,
    CASE WHEN NOT p_granted THEN now() ELSE NULL END
  )
  ON CONFLICT (user_id, consent_type)
  DO UPDATE SET
    granted = EXCLUDED.granted,
    policy_version = EXCLUDED.policy_version,
    ip_address = EXCLUDED.ip_address,
    user_agent = EXCLUDED.user_agent,
    granted_at = CASE WHEN EXCLUDED.granted THEN now() ELSE consent_records.granted_at END,
    withdrawn_at = CASE WHEN NOT EXCLUDED.granted THEN now() ELSE NULL END,
    updated_at = now()
  RETURNING id INTO v_consent_id;

  RETURN v_consent_id;
END;
$$;

-- Get user's current consent status
CREATE OR REPLACE FUNCTION public.get_user_consents(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  consent_type TEXT,
  granted BOOLEAN,
  policy_version TEXT,
  last_updated TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cr.consent_type,
    cr.granted,
    cr.policy_version,
    cr.updated_at
  FROM consent_records cr
  WHERE cr.user_id = COALESCE(p_user_id, auth.uid());
END;
$$;

-- ============================================
-- 3.6 Functions for Data Export
-- ============================================

-- Request data export
CREATE OR REPLACE FUNCTION public.request_data_export(
  p_format TEXT DEFAULT 'json',
  p_ip_address INET DEFAULT NULL
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
  FROM data_export_requests
  WHERE user_id = auth.uid()
  AND status IN ('pending', 'processing')
  AND requested_at > now() - INTERVAL '24 hours';

  IF v_pending_count > 0 THEN
    RAISE EXCEPTION 'You already have a pending export request. Please wait for it to complete.';
  END IF;

  -- Create new request
  INSERT INTO data_export_requests (user_id, format, ip_address)
  VALUES (auth.uid(), p_format, p_ip_address)
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- ============================================
-- 3.7 Functions for Account Deletion
-- ============================================

-- Request account deletion
CREATE OR REPLACE FUNCTION public.request_account_deletion(
  p_reason TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id UUID;
  v_existing_request UUID;
BEGIN
  -- Check for existing pending request
  SELECT id INTO v_existing_request
  FROM data_deletion_requests
  WHERE user_id = auth.uid()
  AND status IN ('pending', 'confirmed', 'processing');

  IF v_existing_request IS NOT NULL THEN
    RAISE EXCEPTION 'You already have a pending deletion request.';
  END IF;

  -- Create deletion request (scheduled for 30 days per GDPR)
  INSERT INTO data_deletion_requests (
    user_id,
    reason,
    scheduled_for,
    ip_address
  )
  VALUES (
    auth.uid(),
    p_reason,
    now() + INTERVAL '30 days',
    p_ip_address
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- Confirm account deletion (user must confirm)
CREATE OR REPLACE FUNCTION public.confirm_account_deletion(
  p_request_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE data_deletion_requests
  SET
    status = 'confirmed',
    confirmed_at = now()
  WHERE id = p_request_id
  AND user_id = auth.uid()
  AND status = 'pending';

  RETURN FOUND;
END;
$$;

-- Cancel account deletion
CREATE OR REPLACE FUNCTION public.cancel_account_deletion(
  p_request_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE data_deletion_requests
  SET
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = auth.uid(),
    cancellation_reason = p_reason
  WHERE id = p_request_id
  AND user_id = auth.uid()
  AND status IN ('pending', 'confirmed');

  RETURN FOUND;
END;
$$;

-- ============================================
-- 3.8 Data Retention Configuration
-- ============================================

CREATE TABLE IF NOT EXISTS public.data_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL UNIQUE,
  retention_days INTEGER NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  last_cleanup_at TIMESTAMPTZ,
  records_deleted_last_run INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default retention policies
INSERT INTO data_retention_policies (table_name, retention_days, description) VALUES
  ('login_attempts', 90, 'Login attempt records for security auditing'),
  ('admin_audit_logs', 1095, 'Admin audit logs (3 years for compliance)'),
  ('data_export_requests', 30, 'Completed export request records'),
  ('contact_submissions', 730, 'Contact form submissions (2 years)')
ON CONFLICT (table_name) DO NOTHING;

-- Enable RLS
ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;

-- Only admins can manage retention policies
CREATE POLICY "Admins can manage retention policies"
ON public.data_retention_policies FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- ============================================
-- 3.9 Cleanup Function for Cron Jobs
-- ============================================

CREATE OR REPLACE FUNCTION public.run_data_retention_cleanup()
RETURNS TABLE (
  table_name TEXT,
  records_deleted INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy RECORD;
  v_deleted INTEGER;
  v_cutoff TIMESTAMPTZ;
BEGIN
  FOR v_policy IN
    SELECT * FROM data_retention_policies WHERE is_active = true
  LOOP
    v_cutoff := now() - (v_policy.retention_days || ' days')::INTERVAL;
    v_deleted := 0;

    -- Handle each table
    CASE v_policy.table_name
      WHEN 'login_attempts' THEN
        DELETE FROM login_attempts WHERE created_at < v_cutoff;
        GET DIAGNOSTICS v_deleted = ROW_COUNT;

      WHEN 'admin_audit_logs' THEN
        DELETE FROM admin_audit_logs WHERE created_at < v_cutoff;
        GET DIAGNOSTICS v_deleted = ROW_COUNT;

      WHEN 'data_export_requests' THEN
        DELETE FROM data_export_requests
        WHERE status IN ('completed', 'failed', 'expired')
        AND created_at < v_cutoff;
        GET DIAGNOSTICS v_deleted = ROW_COUNT;

      WHEN 'contact_submissions' THEN
        DELETE FROM contact_submissions WHERE created_at < v_cutoff;
        GET DIAGNOSTICS v_deleted = ROW_COUNT;

      ELSE
        -- Unknown table, skip
        CONTINUE;
    END CASE;

    -- Update policy record
    UPDATE data_retention_policies
    SET
      last_cleanup_at = now(),
      records_deleted_last_run = v_deleted,
      updated_at = now()
    WHERE id = v_policy.id;

    RETURN QUERY SELECT v_policy.table_name, v_deleted;
  END LOOP;
END;
$$;

-- ============================================
-- 3.10 Audit trigger for consent changes
-- ============================================

CREATE OR REPLACE FUNCTION public.audit_consent_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO admin_audit_logs (
    user_id,
    action_type,
    table_affected,
    record_id,
    old_value,
    new_value
  ) VALUES (
    COALESCE(NEW.user_id, OLD.user_id),
    CASE
      WHEN TG_OP = 'INSERT' THEN 'consent_granted'
      WHEN TG_OP = 'UPDATE' AND NEW.granted != OLD.granted THEN
        CASE WHEN NEW.granted THEN 'consent_granted' ELSE 'consent_withdrawn' END
      ELSE 'consent_updated'
    END,
    'consent_records',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END,
    row_to_json(NEW)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS consent_audit_trigger ON consent_records;
CREATE TRIGGER consent_audit_trigger
AFTER INSERT OR UPDATE ON consent_records
FOR EACH ROW
EXECUTE FUNCTION audit_consent_change();
