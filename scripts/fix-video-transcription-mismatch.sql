-- =============================================================================
-- FIX VIDEO TRANSCRIPTION MISMATCH
-- =============================================================================
-- This script cleans up incorrectly synced video data and prepares for re-sync.
--
-- THE PROBLEM:
-- The original sync-meta-ad-videos function independently resolved video_ids
-- from Meta API, which could differ from the video_ids stored in
-- meta_creative_insights by sync-meta-ads. This caused transcripts to be
-- attached to the wrong videos.
--
-- THE FIX:
-- sync-meta-ad-videos now uses meta_creative_insights.meta_video_id as the
-- source of truth, ensuring consistency.
--
-- RUN THESE STEPS:
-- 1. Run this cleanup script
-- 2. Re-run sync-meta-ad-videos function
-- 3. Re-run transcribe-meta-ad-video function
-- =============================================================================

-- Step 1: Check current state - see what videos exist and their sources
SELECT
  'meta_ad_videos records' as table_name,
  count(*) as total,
  count(*) FILTER (WHERE resolution_method = 'meta_creative_insights') as from_creative_insights,
  count(*) FILTER (WHERE resolution_method != 'meta_creative_insights' OR resolution_method IS NULL) as from_api_directly,
  count(*) FILTER (WHERE status = 'TRANSCRIBED') as transcribed
FROM meta_ad_videos;

-- Step 2: Compare video_ids between tables to see mismatches
SELECT
  'Mismatched video_ids' as check_type,
  count(*) as mismatch_count
FROM meta_ad_videos v
JOIN meta_creative_insights c ON v.ad_id = c.ad_id AND v.organization_id = c.organization_id
WHERE v.video_id != c.meta_video_id
  AND c.meta_video_id IS NOT NULL;

-- Step 3: Show specific mismatches (limit 20)
SELECT
  v.ad_id,
  v.video_id as videos_table_video_id,
  c.meta_video_id as creative_insights_video_id,
  v.status,
  v.resolution_method,
  CASE WHEN v.video_id = c.meta_video_id THEN 'MATCH' ELSE 'MISMATCH' END as status
FROM meta_ad_videos v
JOIN meta_creative_insights c ON v.ad_id = c.ad_id AND v.organization_id = c.organization_id
WHERE c.meta_video_id IS NOT NULL
ORDER BY (v.video_id != c.meta_video_id) DESC, v.created_at DESC
LIMIT 20;

-- =============================================================================
-- CLEANUP COMMANDS (UNCOMMENT TO RUN)
-- =============================================================================

-- Option A: Delete ALL videos and transcripts, then re-sync fresh
-- WARNING: This deletes all transcription data
/*
DELETE FROM meta_ad_transcripts;
DELETE FROM meta_ad_videos;
*/

-- Option B: Delete only mismatched videos (safer, preserves correct data)
-- This deletes videos where the video_id doesn't match meta_creative_insights
/*
DELETE FROM meta_ad_transcripts t
WHERE EXISTS (
  SELECT 1 FROM meta_ad_videos v
  JOIN meta_creative_insights c ON v.ad_id = c.ad_id AND v.organization_id = c.organization_id
  WHERE t.video_id = v.video_id
    AND t.ad_id = v.ad_id
    AND v.video_id != c.meta_video_id
    AND c.meta_video_id IS NOT NULL
);

DELETE FROM meta_ad_videos v
WHERE EXISTS (
  SELECT 1 FROM meta_creative_insights c
  WHERE c.ad_id = v.ad_id
    AND c.organization_id = v.organization_id
    AND v.video_id != c.meta_video_id
    AND c.meta_video_id IS NOT NULL
);
*/

-- Option C: Delete videos that were NOT sourced from meta_creative_insights
-- This keeps any correctly synced data
/*
DELETE FROM meta_ad_transcripts t
WHERE EXISTS (
  SELECT 1 FROM meta_ad_videos v
  WHERE t.video_id = v.video_id
    AND t.ad_id = v.ad_id
    AND (v.resolution_method != 'meta_creative_insights' OR v.resolution_method IS NULL)
);

DELETE FROM meta_ad_videos
WHERE resolution_method != 'meta_creative_insights'
   OR resolution_method IS NULL;
*/

-- =============================================================================
-- VERIFICATION AFTER CLEANUP & RE-SYNC
-- =============================================================================

-- Check that all videos now match
/*
SELECT
  v.organization_id,
  count(*) as total_videos,
  count(*) FILTER (WHERE v.video_id = c.meta_video_id) as matching,
  count(*) FILTER (WHERE v.video_id != c.meta_video_id) as mismatched
FROM meta_ad_videos v
JOIN meta_creative_insights c ON v.ad_id = c.ad_id AND v.organization_id = c.organization_id
WHERE c.meta_video_id IS NOT NULL
GROUP BY v.organization_id;
*/

-- Show transcription status after re-sync
/*
SELECT
  organization_id,
  status,
  count(*) as count
FROM meta_ad_videos
GROUP BY organization_id, status
ORDER BY organization_id, status;
*/
