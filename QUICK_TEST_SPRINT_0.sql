-- ============================================================================
-- QUICK SPRINT 0 TEST - Run this in Supabase SQL Editor
-- ============================================================================

-- 1. CHECK IF MIGRATIONS ARE APPLIED
SELECT
    '🔍 MIGRATION CHECK' as test,
    CASE
        WHEN EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'update_bluesky_trends')
        THEN '✅ Sprint 0 migrations APPLIED'
        ELSE '❌ Sprint 0 migrations NOT APPLIED - Deploy first!'
    END as status;

-- 2. CHECK VELOCITY ALGORITHM
SELECT
    '📊 VELOCITY CHECK' as test,
    COUNT(*) FILTER (WHERE velocity > 0) || ' topics with velocity > 0' as working_velocities,
    COUNT(*) || ' total topics' as total,
    CASE
        WHEN COUNT(*) FILTER (WHERE velocity > 0) > 0 THEN '✅ WORKING'
        WHEN COUNT(*) = 0 THEN '⚠️ No topics to test'
        ELSE '❌ BROKEN - All velocities are 0'
    END as status
FROM bluesky_trends
WHERE mentions_last_24_hours > 0;

-- 3. CHECK PROCESSING ACTIVITY
SELECT
    '⚡ PROCESSING CHECK' as test,
    COUNT(*) || ' posts processed in last hour' as recent_activity,
    CASE
        WHEN COUNT(*) > 0 THEN '✅ ACTIVE'
        ELSE '❌ STOPPED - No recent processing'
    END as status
FROM bluesky_posts
WHERE ai_processed = true
AND ai_processed_at >= now() - interval '1 hour';

-- 4. CHECK BACKLOG
SELECT
    '📈 BACKLOG STATUS' as test,
    COUNT(*) FILTER (WHERE ai_processed = false AND ai_relevance_score >= 0.1) || ' posts remaining' as unprocessed,
    COUNT(*) FILTER (WHERE ai_processed = true) || ' posts completed' as processed,
    ROUND((COUNT(*) FILTER (WHERE ai_processed = true)::numeric /
           NULLIF(COUNT(*), 0)) * 100, 2) || '%' as completion
FROM bluesky_posts;

-- 5. SHOW SAMPLE TRENDING TOPICS
SELECT
    '' as blank,
    '🔥 TOP 3 TRENDING TOPICS (if working):' as header;

SELECT
    topic,
    velocity || '%' as velocity,
    mentions_last_24_hours as "24hr_mentions",
    CASE WHEN is_trending THEN '🔥' ELSE '' END as trending
FROM bluesky_trends
WHERE mentions_last_24_hours > 0
ORDER BY velocity DESC
LIMIT 3;

-- FINAL VERDICT
WITH checks AS (
    SELECT
        EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'update_bluesky_trends') as migrations_applied,
        EXISTS(SELECT 1 FROM bluesky_trends WHERE velocity > 0) as velocity_working,
        EXISTS(SELECT 1 FROM bluesky_posts WHERE ai_processed = true
               AND ai_processed_at >= now() - interval '1 hour') as processing_active
)
SELECT
    '' as blank,
    '=============================' as separator,
    'SPRINT 0 STATUS: ' ||
    CASE
        WHEN migrations_applied AND velocity_working AND processing_active THEN
            '🎉 FULLY OPERATIONAL'
        WHEN migrations_applied AND (velocity_working OR processing_active) THEN
            '⚠️ PARTIALLY WORKING'
        WHEN migrations_applied THEN
            '📦 DEPLOYED BUT NOT RUNNING'
        ELSE
            '❌ NOT DEPLOYED'
    END as final_status,
    '=============================' as separator2
FROM checks;