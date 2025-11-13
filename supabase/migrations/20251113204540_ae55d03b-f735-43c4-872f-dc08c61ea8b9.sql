-- Ensure RLS is enabled on contact_submissions
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them with proper security
DROP POLICY IF EXISTS "Anyone can submit contact forms" ON public.contact_submissions;
DROP POLICY IF EXISTS "Only admins can view submissions" ON public.contact_submissions;
DROP POLICY IF EXISTS "Only admins can update submissions" ON public.contact_submissions;
DROP POLICY IF EXISTS "Only admins can delete submissions" ON public.contact_submissions;

-- Recreate INSERT policy - anyone can submit (this is intentional for public contact forms)
CREATE POLICY "Anyone can submit contact forms"
ON public.contact_submissions
FOR INSERT
TO public
WITH CHECK (true);

-- Recreate SELECT policy - ONLY admins can view submissions
CREATE POLICY "Only admins can view submissions"
ON public.contact_submissions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Recreate UPDATE policy - ONLY admins can update submissions
CREATE POLICY "Only admins can update submissions"
ON public.contact_submissions
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Recreate DELETE policy - ONLY admins can delete submissions
CREATE POLICY "Only admins can delete submissions"
ON public.contact_submissions
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Fix the audit logs INSERT policy
DROP POLICY IF EXISTS "System can insert audit logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Only admins can insert audit logs" ON public.admin_audit_logs;

-- Only authenticated admins can create audit logs
CREATE POLICY "Only admins can insert audit logs"
ON public.admin_audit_logs
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));