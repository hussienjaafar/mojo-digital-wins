-- =============================================================================
-- VIDEO TRANSCRIPTION PIPELINE VERIFICATION SCRIPT
-- =============================================================================
-- Run this script to verify the video transcription pipeline is working.
-- Replace <ORG_ID> with an actual organization UUID.
-- =============================================================================

-- =============================================================================
-- 1. CHECK IF TABLES EXIST
-- =============================================================================
SELECT 'Tables Check' as check_name,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meta_ad_videos') as meta_ad_videos_exists,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meta_ad_transcripts') as meta_ad_transcripts_exists;

-- =============================================================================
-- 2. VIDEO RESOLUTION STATS BY ORG
-- =============================================================================
SELECT
  'Video Resolution Stats' as check_name,
  organization_id,
  COUNT(*) as total_videos,
  COUNT(DISTINCT ad_id) as distinct_ads,
  COUNT(video_source_url) as with_source_url,
  ROUND(100.0 * COUNT(video_source_url) / NULLIF(COUNT(*), 0), 1) as url_success_rate,
  COUNT(*) FILTER (WHERE status = 'TRANSCRIBED') as transcribed,
  COUNT(*) FILTER (WHERE status IN ('PENDING', 'URL_FETCHED', 'DOWNLOADED')) as pending,
  COUNT(*) FILTER (WHERE status IN ('ERROR', 'URL_INACCESSIBLE', 'URL_EXPIRED', 'TRANSCRIPT_FAILED')) as errors
FROM meta_ad_videos
GROUP BY organization_id
ORDER BY total_videos DESC;

-- =============================================================================
-- 3. VIDEO RESOLUTION METHOD BREAKDOWN
-- =============================================================================
SELECT
  'Resolution Methods' as check_name,
  resolution_method,
  COUNT(*) as count,
  COUNT(video_source_url) as with_url,
  ROUND(100.0 * COUNT(video_source_url) / NULLIF(COUNT(*), 0), 1) as success_rate
FROM meta_ad_videos
GROUP BY resolution_method
ORDER BY count DESC;

-- =============================================================================
-- 4. STATUS DISTRIBUTION
-- =============================================================================
SELECT
  'Status Distribution' as check_name,
  status,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 1) as percentage
FROM meta_ad_videos
GROUP BY status
ORDER BY count DESC;

-- =============================================================================
-- 5. ERROR ANALYSIS
-- =============================================================================
SELECT
  'Common Errors' as check_name,
  error_code,
  error_message,
  COUNT(*) as occurrences
FROM meta_ad_videos
WHERE error_code IS NOT NULL OR error_message IS NOT NULL
GROUP BY error_code, error_message
ORDER BY occurrences DESC
LIMIT 10;

-- =============================================================================
-- 6. TRANSCRIPTION STATS BY ORG
-- =============================================================================
SELECT
  'Transcription Stats' as check_name,
  organization_id,
  COUNT(*) as total_transcripts,
  AVG(duration_seconds) as avg_duration_sec,
  AVG(words_per_minute) as avg_wpm,
  COUNT(DISTINCT language) as languages,
  COUNT(*) FILTER (WHERE topic_primary IS NOT NULL) as with_topic,
  COUNT(*) FILTER (WHERE tone_primary IS NOT NULL) as with_tone,
  COUNT(*) FILTER (WHERE cta_text IS NOT NULL) as with_cta
FROM meta_ad_transcripts
GROUP BY organization_id
ORDER BY total_transcripts DESC;

-- =============================================================================
-- 7. TOPIC DISTRIBUTION (for content analysis correlation)
-- =============================================================================
SELECT
  'Topic Distribution' as check_name,
  topic_primary,
  COUNT(*) as count,
  AVG(duration_seconds) as avg_duration,
  AVG(sentiment_score) as avg_sentiment
FROM meta_ad_transcripts
WHERE topic_primary IS NOT NULL
GROUP BY topic_primary
ORDER BY count DESC;

-- =============================================================================
-- 8. TONE DISTRIBUTION (for creative analysis)
-- =============================================================================
SELECT
  'Tone Distribution' as check_name,
  tone_primary,
  COUNT(*) as count,
  AVG(sentiment_score) as avg_sentiment,
  AVG(words_per_minute) as avg_wpm
FROM meta_ad_transcripts
WHERE tone_primary IS NOT NULL
GROUP BY tone_primary
ORDER BY count DESC;

-- =============================================================================
-- 9. URGENCY LEVEL DISTRIBUTION
-- =============================================================================
SELECT
  'Urgency Distribution' as check_name,
  urgency_level,
  COUNT(*) as count,
  AVG(duration_seconds) as avg_duration,
  AVG(words_per_minute) as avg_wpm
FROM meta_ad_transcripts
WHERE urgency_level IS NOT NULL
GROUP BY urgency_level
ORDER BY
  CASE urgency_level
    WHEN 'extreme' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END;

-- =============================================================================
-- 10. CRITICAL: VIDEO_ID CONSISTENCY CHECK
-- This checks if the video_id in meta_ad_videos matches meta_creative_insights
-- =============================================================================
SELECT
  '*** VIDEO_ID CONSISTENCY ***' as check_name,
  v.organization_id,
  COUNT(*) as total_checked,
  COUNT(*) FILTER (WHERE v.video_id = c.meta_video_id) as matching,
  COUNT(*) FILTER (WHERE v.video_id != c.meta_video_id) as MISMATCHED,
  COUNT(*) FILTER (WHERE v.resolution_method = 'meta_creative_insights') as from_creative_insights,
  COUNT(*) FILTER (WHERE v.resolution_method IS NULL OR v.resolution_method != 'meta_creative_insights') as from_api_directly
FROM meta_ad_videos v
JOIN meta_creative_insights c ON v.ad_id = c.ad_id AND v.organization_id = c.organization_id
WHERE c.meta_video_id IS NOT NULL
GROUP BY v.organization_id;

-- Show specific mismatches (these are the BAD ones that need re-sync)
SELECT
  'MISMATCHED VIDEO_IDs (NEED RE-SYNC)' as check_name,
  v.ad_id,
  v.video_id as video_table_id,
  c.meta_video_id as creative_insights_id,
  v.resolution_method,
  v.status
FROM meta_ad_videos v
JOIN meta_creative_insights c ON v.ad_id = c.ad_id AND v.organization_id = c.organization_id
WHERE v.video_id != c.meta_video_id
  AND c.meta_video_id IS NOT NULL
LIMIT 20;

-- =============================================================================
-- 11. COMPARE VIDEO CREATIVES IN meta_creative_insights vs meta_ad_videos
-- =============================================================================
WITH creative_videos AS (
  SELECT DISTINCT organization_id, ad_id, meta_video_id
  FROM meta_creative_insights
  WHERE creative_type = 'video' AND meta_video_id IS NOT NULL
),
synced_videos AS (
  SELECT DISTINCT organization_id, ad_id, video_id
  FROM meta_ad_videos
)
SELECT
  'Video Coverage' as check_name,
  c.organization_id,
  COUNT(DISTINCT c.ad_id) as video_creatives,
  COUNT(DISTINCT s.ad_id) as synced_to_pipeline,
  COUNT(DISTINCT c.ad_id) - COUNT(DISTINCT s.ad_id) as not_synced,
  ROUND(100.0 * COUNT(DISTINCT s.ad_id) / NULLIF(COUNT(DISTINCT c.ad_id), 0), 1) as coverage_percent
FROM creative_videos c
LEFT JOIN synced_videos s ON c.organization_id = s.organization_id AND c.ad_id = s.ad_id
GROUP BY c.organization_id;

-- =============================================================================
-- 11. SAMPLE TRANSCRIPTS (for quality check)
-- =============================================================================
SELECT
  'Sample Transcripts' as check_name,
  ad_id,
  video_id,
  duration_seconds,
  language,
  speaker_count,
  words_per_minute,
  hook_text,
  topic_primary,
  tone_primary,
  urgency_level,
  cta_type,
  LEFT(transcript_text, 200) as transcript_preview
FROM meta_ad_transcripts
ORDER BY transcribed_at DESC
LIMIT 5;

-- =============================================================================
-- 12. MISMATCH: Videos in Ads Manager but API can't fetch
-- These are videos where we have video_id but couldn't get source URL
-- =============================================================================
SELECT
  'Inaccessible Videos' as check_name,
  v.organization_id,
  v.ad_id,
  v.video_id,
  v.resolution_method,
  v.status,
  v.error_code,
  v.error_message,
  c.primary_text as ad_text_preview
FROM meta_ad_videos v
LEFT JOIN meta_creative_insights c ON v.organization_id = c.organization_id AND v.ad_id = c.ad_id
WHERE v.status IN ('URL_INACCESSIBLE', 'URL_EXPIRED', 'ERROR')
ORDER BY v.updated_at DESC
LIMIT 20;

-- =============================================================================
-- 13. OVERALL PIPELINE HEALTH
-- =============================================================================
SELECT
  'Pipeline Health' as check_name,
  (SELECT COUNT(*) FROM meta_creative_insights WHERE creative_type = 'video') as total_video_creatives,
  (SELECT COUNT(*) FROM meta_ad_videos) as videos_in_pipeline,
  (SELECT COUNT(*) FROM meta_ad_videos WHERE video_source_url IS NOT NULL) as with_source_url,
  (SELECT COUNT(*) FROM meta_ad_videos WHERE status = 'TRANSCRIBED') as transcribed,
  (SELECT COUNT(*) FROM meta_ad_transcripts) as total_transcripts,
  ROUND(100.0 * (SELECT COUNT(*) FROM meta_ad_videos WHERE status = 'TRANSCRIBED') /
    NULLIF((SELECT COUNT(*) FROM meta_ad_videos), 0), 1) as transcription_rate_pct;
