-- Policy 1: Allow users to insert videos for their organizations
CREATE POLICY "Users can insert videos for their org"
  ON public.meta_ad_videos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM organization_memberships 
      WHERE user_id = auth.uid() 
      AND status = 'active'
    )
  );

-- Policy 2: Allow users to update videos for their organizations
CREATE POLICY "Users can update videos for their org"
  ON public.meta_ad_videos
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_memberships 
      WHERE user_id = auth.uid() 
      AND status = 'active'
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM organization_memberships 
      WHERE user_id = auth.uid() 
      AND status = 'active'
    )
  );

-- Policy 3: Allow users to delete videos for their organizations
CREATE POLICY "Users can delete videos for their org"
  ON public.meta_ad_videos
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_memberships 
      WHERE user_id = auth.uid() 
      AND status = 'active'
    )
  );