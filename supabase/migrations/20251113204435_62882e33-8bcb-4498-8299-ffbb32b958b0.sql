-- Fix the login_history INSERT policy
DROP POLICY IF EXISTS "System can insert login history" ON public.login_history;

-- Only authenticated admins can create login history records
-- (The log_login_attempt function uses SECURITY DEFINER to insert records)
CREATE POLICY "Only system functions can insert login history"
ON public.login_history
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));