-- Drop the existing policies that don't account for admin access
DROP POLICY IF EXISTS "Users can insert videos for their org" ON public.meta_ad_videos;
DROP POLICY IF EXISTS "Users can update videos for their org" ON public.meta_ad_videos;
DROP POLICY IF EXISTS "Users can delete videos for their org" ON public.meta_ad_videos;

-- Recreate with admin access included
CREATE POLICY "Users can insert videos for their org"
  ON public.meta_ad_videos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin') 
    OR organization_id IN (
      SELECT organization_id 
      FROM organization_memberships 
      WHERE user_id = auth.uid() 
      AND status = 'active'
    )
  );

CREATE POLICY "Users can update videos for their org"
  ON public.meta_ad_videos
  FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin') 
    OR organization_id IN (
      SELECT organization_id 
      FROM organization_memberships 
      WHERE user_id = auth.uid() 
      AND status = 'active'
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin') 
    OR organization_id IN (
      SELECT organization_id 
      FROM organization_memberships 
      WHERE user_id = auth.uid() 
      AND status = 'active'
    )
  );

CREATE POLICY "Users can delete videos for their org"
  ON public.meta_ad_videos
  FOR DELETE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin') 
    OR organization_id IN (
      SELECT organization_id 
      FROM organization_memberships 
      WHERE user_id = auth.uid() 
      AND status = 'active'
    )
  );