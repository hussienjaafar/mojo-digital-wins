

## Fix: RLS Policies for Admin-Only Video Management

### Problem

The new RLS policies for `meta_ad_videos` query `organization_memberships` to check access, but admin users:
- Access organizations via the org selector (not membership)
- Have no records in `organization_memberships` for the orgs they select
- Only have a record in `user_roles` with role = 'admin'

This causes the INSERT to fail with a 403 error.

### Current State

| Table | User Record |
|-------|-------------|
| `user_roles` | `6037a48d...` has role `admin` |
| `organization_memberships` | No record for this user in org `346d6aaf...` |

The current policies check:
```sql
organization_id IN (
  SELECT organization_id FROM organization_memberships 
  WHERE user_id = auth.uid() AND status = 'active'
)
```

This returns an empty set for admin users, blocking all operations.

### Solution

Update the three new RLS policies to also allow access when the user has the `admin` role. This uses the existing `has_role()` security definer function.

### Database Migration

```sql
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
```

### How the Updated Policies Work

| User Type | Access Logic |
|-----------|--------------|
| **Admin** | `has_role(auth.uid(), 'admin')` returns TRUE - full access to any org |
| **Org Member** | Falls through to `organization_memberships` check - only their orgs |
| **Neither** | Both conditions FALSE - access denied |

### Files to Change

- **Database migration only** - No code changes needed

### Expected Result After Fix

1. Admin selects organization "A New Policy" from selector
2. User uploads video file
3. FFmpeg extracts audio (working)
4. Audio uploads to storage (working)
5. Database INSERT succeeds (the `has_role()` check passes)
6. Video appears in the Ad Copy Studio

### Security Considerations

This is appropriate because:
- The `has_role()` function is a `SECURITY DEFINER` function that safely queries `user_roles`
- Admin users are already trusted with full system access
- The `service_role` policy already grants similar access for backend operations
- Organization-level access control remains intact for non-admin users

