-- Fix profiles table INSERT security vulnerability
-- Drop the overly permissive INSERT policy
DROP POLICY IF EXISTS "System can insert profiles" ON public.profiles;

-- The handle_new_user() SECURITY DEFINER function will still be able to insert
-- profiles when users sign up via the trigger, as SECURITY DEFINER functions
-- bypass RLS policies

-- Add a comment to document this security design
COMMENT ON TABLE public.profiles IS 'User profiles are automatically created via the handle_new_user() SECURITY DEFINER trigger function when users sign up. Direct inserts are not allowed.';