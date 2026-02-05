

## Fix: Add Missing RLS Policies for `meta_ad_videos` Table

### Problem

The `meta_ad_videos` table is missing INSERT, UPDATE, and DELETE policies for authenticated users. Currently it only has:

| Policy | Command | What it does |
|--------|---------|--------------|
| Users can view their org videos | SELECT | Allows viewing videos for active org members |
| Service role full access | ALL | Allows backend/edge functions to manage videos |

When a user tries to upload a video, the INSERT fails with a 403 error because there's no policy allowing authenticated users to insert records.

### Solution

Add three new RLS policies that allow authenticated users with active organization membership to:

1. **INSERT** - Create new video records for their organization
2. **UPDATE** - Modify video records for their organization  
3. **DELETE** - Remove video records for their organization

### Database Migration

```sql
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
```

### How the policies work

- **INSERT (WITH CHECK)**: Verifies the user has an active membership in the organization they're trying to create a video for
- **UPDATE (USING + WITH CHECK)**: Verifies the user can only modify videos in their organization and can't move them to another org
- **DELETE (USING)**: Verifies the user can only delete videos from their own organization

### Files to Change

- **Database migration only** - No code changes needed

### Expected Result After Fix

1. User uploads video file
2. FFmpeg extracts audio (working)
3. Audio uploads to storage (working)
4. Database INSERT succeeds (currently failing - will be fixed)
5. Video appears in the Ad Copy Studio

