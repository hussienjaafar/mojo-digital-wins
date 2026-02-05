
# Fix: Transcription Analysis Not Showing Due to Missing RLS Policy

## Problem Identified

The video uploads and transcriptions complete successfully (confirmed in database), but the Review step shows "No analysis available" because the frontend cannot read the transcript records.

**Root Cause:** The `meta_ad_transcripts` table is missing admin-level RLS policies that exist on `meta_ad_videos`.

### Current RLS Policies Comparison

| Table | Policy | Who Can Access |
|-------|--------|---------------|
| `meta_ad_videos` | `Admins can view all videos` | Users with admin role |
| `meta_ad_videos` | `Users can view their org videos` | Users in organization |
| `meta_ad_transcripts` | *(missing)* | No admin policy |
| `meta_ad_transcripts` | `Users can view their org transcripts` | Users in organization |

Since the current user is an admin but not in `organization_memberships`, they can view videos but cannot read the corresponding transcripts.

## Solution

Add matching admin RLS policies to `meta_ad_transcripts` for consistency with `meta_ad_videos`.

## Implementation Plan

### Step 1: Database Migration

Create a new migration to add admin policies to `meta_ad_transcripts`:

```sql
-- Add admin SELECT policy (matching meta_ad_videos pattern)
CREATE POLICY "Admins can view all transcripts"
ON public.meta_ad_transcripts
FOR SELECT
TO public
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add admin INSERT policy
CREATE POLICY "Admins can insert transcripts"
ON public.meta_ad_transcripts
FOR INSERT
TO public
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add admin UPDATE policy
CREATE POLICY "Admins can update transcripts"
ON public.meta_ad_transcripts
FOR UPDATE
TO public
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add admin DELETE policy  
CREATE POLICY "Admins can delete transcripts"
ON public.meta_ad_transcripts
FOR DELETE
TO public
USING (has_role(auth.uid(), 'admin'::app_role));
```

### Step 2: Verification

After migration, verify:
1. Admin users can query `meta_ad_transcripts` directly
2. The Review step loads transcript analysis correctly
3. Non-admin users still only see their organization's transcripts

## Files Changed

1. `supabase/migrations/[timestamp]_add_admin_policies_to_transcripts.sql` (new)

## Technical Notes

- The existing `has_role()` function is already defined and working (used by `meta_ad_videos` policies)
- The `app_role` type includes 'admin' value
- Service role access remains unchanged (edge functions will continue to work)
- Organization-based access for regular users remains unchanged

## Testing

After applying the migration:
1. Refresh the page on the Review Transcripts step
2. The transcript and analysis should now display correctly
3. Verify the "0/1 videos reviewed" counter works

## Expected Outcome

The transcript data stored in the database will be accessible to admin users through the frontend, and the Review step will display the AI-generated analysis instead of "No analysis available."
