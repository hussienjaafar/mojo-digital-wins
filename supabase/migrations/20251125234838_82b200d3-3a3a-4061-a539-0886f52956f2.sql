-- Add service role policies to allow edge functions to query user data
-- This allows edge functions using service_role key to read profiles and user_roles

-- Policy for profiles table to allow service role read access
CREATE POLICY "Service role can view all profiles"
ON public.profiles
FOR SELECT
TO service_role
USING (true);

-- Policy for user_roles table to allow service role read access  
CREATE POLICY "Service role can view all roles"
ON public.user_roles
FOR SELECT
TO service_role
USING (true);