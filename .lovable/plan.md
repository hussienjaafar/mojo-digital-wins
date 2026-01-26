
# Fix Meta Ad Videos Table: Add Missing Columns

## Problem Summary

The `meta_ad_videos` table in the production database is **missing three columns** that the `sync-meta-ad-videos` edge function requires:

| Missing Column | Type | Purpose |
|---------------|------|---------|
| `creative_id` | TEXT | Links video to Meta creative |
| `resolution_method` | TEXT | Tracks how video_id was discovered |
| `url_fetched_at` | TIMESTAMPTZ | When source URL was fetched |

### Root Cause

Two different migrations attempted to create this table:

1. **`20260113200000_video_transcription_pipeline.sql`** - Comprehensive schema with all columns
2. **`20260123034910_0fb4089a-10b4-479e-b52c-2d9a21361c8e.sql`** - Simplified version missing the three columns

The database has the simplified version applied, causing the edge function to fail.

### Current vs Required Schema

```text
CURRENT TABLE (in database):
┌─────────────────────────────────────┐
│ id, organization_id, ad_id,         │
│ video_id, video_source_url,         │
│ thumbnail_url, duration_seconds,    │
│ status, error_code, error_message,  │
│ retry_count, last_error_at,         │
│ downloaded_at, transcribed_at,      │
│ created_at, updated_at              │
└─────────────────────────────────────┘

REQUIRED (by edge function):
┌─────────────────────────────────────┐
│ ... all of the above PLUS:          │
│ + creative_id           ← MISSING   │
│ + resolution_method     ← MISSING   │
│ + url_fetched_at        ← MISSING   │
│ + video_source_expires_at (optional)│
└─────────────────────────────────────┘
```

---

## Solution

Create a migration to add the missing columns to the existing `meta_ad_videos` table.

---

## Implementation Plan

### Step 1: Database Migration

Add the three missing columns plus the optional `video_source_expires_at` column:

```sql
-- Add missing columns to meta_ad_videos table for video sync pipeline

-- Add creative_id column for linking to Meta creatives
ALTER TABLE public.meta_ad_videos
ADD COLUMN IF NOT EXISTS creative_id TEXT;

-- Add resolution_method to track how video_id was discovered
-- Values: 'meta_creative_insights', 'creative.video_id', etc.
ALTER TABLE public.meta_ad_videos
ADD COLUMN IF NOT EXISTS resolution_method TEXT;

-- Add url_fetched_at timestamp for when source URL was successfully fetched
ALTER TABLE public.meta_ad_videos
ADD COLUMN IF NOT EXISTS url_fetched_at TIMESTAMPTZ;

-- Add video_source_expires_at for tracking URL expiration (optional but useful)
ALTER TABLE public.meta_ad_videos
ADD COLUMN IF NOT EXISTS video_source_expires_at TIMESTAMPTZ;

-- Update status values to match what edge function expects
-- Current: 'pending', 'downloading', 'transcribing', 'completed', 'error'
-- Required: 'PENDING', 'URL_FETCHED', 'URL_EXPIRED', 'URL_INACCESSIBLE', 
--           'DOWNLOADED', 'TRANSCRIBED', 'TRANSCRIPT_FAILED', 'ERROR'

-- Drop old check constraint if exists
ALTER TABLE public.meta_ad_videos 
DROP CONSTRAINT IF EXISTS meta_ad_videos_status_check;

-- Add new status values (case-insensitive to allow existing lowercase values to work)
ALTER TABLE public.meta_ad_videos
ADD CONSTRAINT meta_ad_videos_status_check 
CHECK (LOWER(status) IN (
  'pending', 'url_fetched', 'url_expired', 'url_inaccessible',
  'downloading', 'downloaded', 'transcribing', 'transcribed', 
  'transcript_failed', 'completed', 'error'
));

-- Create index on creative_id for efficient lookups
CREATE INDEX IF NOT EXISTS idx_meta_ad_videos_creative_id 
ON public.meta_ad_videos(creative_id);

-- Add comments for documentation
COMMENT ON COLUMN public.meta_ad_videos.creative_id IS 
  'Meta creative ID associated with this video';
COMMENT ON COLUMN public.meta_ad_videos.resolution_method IS 
  'How the video_id was resolved (meta_creative_insights, direct_api, etc)';
COMMENT ON COLUMN public.meta_ad_videos.url_fetched_at IS 
  'When the video source URL was successfully fetched from Meta API';
COMMENT ON COLUMN public.meta_ad_videos.video_source_expires_at IS 
  'When the video source URL expires (Meta URLs are temporary)';
```

### Step 2: Verify the Fix

After migration runs, trigger a test sync:

1. Call `sync-meta-ad-videos` edge function for the organization
2. Verify videos are created in `meta_ad_videos` with correct status
3. Check that `creative_id`, `resolution_method`, and `url_fetched_at` are populated

---

## Files to Modify

| File | Action | Description |
|------|--------|-------------|
| Database Migration | **CREATE** | Add missing columns to `meta_ad_videos` table |

No frontend or edge function code changes needed - they already expect these columns.

---

## Expected Results After Fix

| Step | Expected Outcome |
|------|-----------------|
| Migration applied | `meta_ad_videos` has all required columns |
| Sync function called | Videos created with `status: 'URL_FETCHED'` or `'URL_INACCESSIBLE'` |
| Column values | `creative_id`, `resolution_method`, `url_fetched_at` populated |
| Transcription | Can proceed for videos with `status: 'URL_FETCHED'` |

---

## Verification Query

After migration, run this to verify columns exist:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'meta_ad_videos'
  AND table_schema = 'public'
  AND column_name IN ('creative_id', 'resolution_method', 'url_fetched_at', 'video_source_expires_at')
ORDER BY column_name;
```

Expected result: 4 rows showing all new columns.
