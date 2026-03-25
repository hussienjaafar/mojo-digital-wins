-- Fix RLS recursion risk on user_roles
-- The policy `user_roles_admin_all` references `has_role()`, but `has_role()` reads from `user_roles`,
-- which can lead to recursive / inconsistent RLS evaluation.
DROP POLICY IF EXISTS user_roles_admin_all ON public.user_roles;

-- Admin-only video management (system admin feature for now)
-- Replace the previous org-membership-based policies with admin-only checks.
DROP POLICY IF EXISTS "Users can insert videos for their org" ON public.meta_ad_videos;
DROP POLICY IF EXISTS "Users can update videos for their org" ON public.meta_ad_videos;
DROP POLICY IF EXISTS "Users can delete videos for their org" ON public.meta_ad_videos;

CREATE POLICY "Admins can insert videos"
  ON public.meta_ad_videos
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update videos"
  ON public.meta_ad_videos
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete videos"
  ON public.meta_ad_videos
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Ensure admins can also read videos (needed for listing + returning insert results)
CREATE POLICY "Admins can view all videos"
  ON public.meta_ad_videos
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));