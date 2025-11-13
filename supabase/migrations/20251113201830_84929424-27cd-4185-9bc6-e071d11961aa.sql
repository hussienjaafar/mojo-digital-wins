-- Create audit logging table
CREATE TABLE public.admin_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  table_affected TEXT,
  record_id TEXT,
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on audit logs
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Only admins can view audit logs"
  ON public.admin_audit_logs
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- System can insert audit logs (security definer function will handle this)
CREATE POLICY "System can insert audit logs"
  ON public.admin_audit_logs
  FOR INSERT
  WITH CHECK (true);

-- Create index for better query performance
CREATE INDEX idx_audit_logs_user_id ON public.admin_audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.admin_audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action_type ON public.admin_audit_logs(action_type);

-- Create login history table
CREATE TABLE public.login_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  login_successful BOOLEAN NOT NULL DEFAULT true,
  failure_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on login history
ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;

-- Only admins can view login history
CREATE POLICY "Only admins can view login history"
  ON public.login_history
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- System can insert login history
CREATE POLICY "System can insert login history"
  ON public.login_history
  FOR INSERT
  WITH CHECK (true);

-- Create indexes for better query performance
CREATE INDEX idx_login_history_user_id ON public.login_history(user_id);
CREATE INDEX idx_login_history_created_at ON public.login_history(created_at DESC);
CREATE INDEX idx_login_history_successful ON public.login_history(login_successful);

-- Create function to log admin actions
CREATE OR REPLACE FUNCTION public.log_admin_action(
  _action_type TEXT,
  _table_affected TEXT DEFAULT NULL,
  _record_id TEXT DEFAULT NULL,
  _old_value JSONB DEFAULT NULL,
  _new_value JSONB DEFAULT NULL
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
    old_value,
    new_value
  ) VALUES (
    auth.uid(),
    _action_type,
    _table_affected,
    _record_id,
    _old_value,
    _new_value
  )
  RETURNING id INTO _log_id;
  
  RETURN _log_id;
END;
$$;

-- Create function to log login attempts
CREATE OR REPLACE FUNCTION public.log_login_attempt(
  _user_id UUID,
  _email TEXT,
  _successful BOOLEAN,
  _failure_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _log_id UUID;
BEGIN
  INSERT INTO public.login_history (
    user_id,
    email,
    login_successful,
    failure_reason
  ) VALUES (
    _user_id,
    _email,
    _successful,
    _failure_reason
  )
  RETURNING id INTO _log_id;
  
  RETURN _log_id;
END;
$$;