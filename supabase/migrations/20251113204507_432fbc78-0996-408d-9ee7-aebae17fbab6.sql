-- Just update the audit logs policy without the contact_submissions changes (those succeeded)
DROP POLICY IF EXISTS "Only admins can insert audit logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs" ON public.admin_audit_logs;

-- Only authenticated admins can create audit logs
CREATE POLICY "Only admins can insert audit logs"
ON public.admin_audit_logs
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));