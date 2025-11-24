-- ============================================================================
-- SPRINT 0 TESTING SCRIPT
-- Run this in Supabase SQL Editor to test if Sprint 0 is deployed
-- ============================================================================

-- Test 1: Check if velocity functions exist
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'TEST 1: CHECKING VELOCITY FUNCTIONS';
    RAISE NOTICE '========================================';

    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'count_posts_with_topic') THEN
        RAISE NOTICE '✅ count_posts_with_topic function EXISTS';
    ELSE
        RAISE NOTICE '❌ count_posts_with_topic function MISSING - Migration not applied!';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_topic_velocity') THEN
        RAISE NOTICE '✅ calculate_topic_velocity function EXISTS';
    ELSE
        RAISE NOTICE '❌ calculate_topic_velocity function MISSING - Migration not applied!';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_bluesky_trends') THEN
        RAISE NOTICE '✅ update_bluesky_trends function EXISTS';
    ELSE
        RAISE NOTICE '❌ update_bluesky_trends function MISSING - Migration not applied!';
    END IF;
END $$;

-- Test 2: Check if backfill tables exist
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'TEST 2: CHECKING BACKFILL INFRASTRUCTURE';
    RAISE NOTICE '========================================';

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'backfill_status') THEN
        RAISE NOTICE '✅ backfill_status table EXISTS';
    ELSE
        RAISE NOTICE '❌ backfill_status table MISSING - Backfill migration not applied!';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'backfill_monitoring') THEN
        RAISE NOTICE '✅ backfill_monitoring view EXISTS';
    ELSE
        RAISE NOTICE '❌ backfill_monitoring view MISSING - Backfill migration not applied!';
    END IF;
END $$;

-- Test 3: Check actual velocity calculations
WITH velocity_test AS (
    SELECT
        COUNT(*) as total_trends,
        COUNT(*) FILTER (WHERE velocity > 0) as non_zero_velocities,
        MAX(velocity) as max_velocity,
        MIN(velocity) as min_velocity
    FROM bluesky_trends
    WHERE mentions_last_24_hours > 0
)
SELECT
    '========================================' as separator,
    'TEST 3: VELOCITY ALGORITHM' as test_name,
    '========================================' as separator2,
    CASE
        WHEN non_zero_velocities = 0 AND total_trends > 0 THEN '❌ FAILED - All velocities are 0!'
        WHEN total_trends = 0 THEN '⚠️ NO DATA - No trending topics to test'
        WHEN non_zero_velocities > 0 THEN '✅ WORKING - Found ' || non_zero_velocities || ' topics with velocity > 0'
        ELSE '❓ UNKNOWN STATUS'
    END as result,
    'Total topics: ' || total_trends as total,
    'Non-zero velocities: ' || non_zero_velocities as working,
    'Max velocity: ' || COALESCE(max_velocity::text, 'N/A') || '%' as max_vel,
    'Min velocity: ' || COALESCE(min_velocity::text, 'N/A') || '%' as min_vel
FROM velocity_test;

-- Test 4: Check if posts are being processed
WITH processing_test AS (
    SELECT
        COUNT(*) FILTER (WHERE ai_processed = true) as processed_count,
        COUNT(*) FILTER (WHERE ai_processed = false AND ai_relevance_score >= 0.1) as unprocessed_count,
        COUNT(*) FILTER (WHERE ai_processed = true AND ai_processed_at >= now() - interval '1 hour') as processed_last_hour,
        MAX(ai_processed_at) as last_processed_time
    FROM bluesky_posts
)
SELECT
    '' as blank,
    '========================================' as separator,
    'TEST 4: POST PROCESSING' as test_name,
    '========================================' as separator2,
    CASE
        WHEN processed_last_hour > 0 THEN '✅ ACTIVE - Processed ' || processed_last_hour || ' posts in last hour'
        WHEN processed_count > 0 THEN '⚠️ STALLED - Last processed: ' || COALESCE(last_processed_time::text, 'never')
        ELSE '❌ NOT WORKING - No posts have been processed'
    END as result,
    'Total processed: ' || processed_count as total_processed,
    'Remaining unprocessed: ' || unprocessed_count as remaining,
    'Completion: ' || ROUND((processed_count::numeric / NULLIF(processed_count + unprocessed_count, 0)) * 100, 2) || '%' as completion
FROM processing_test;

-- Test 5: Check trending topics with actual data
SELECT
    '' as blank,
    '========================================' as separator,
    'TEST 5: TOP TRENDING TOPICS' as test_name,
    '========================================' as separator2;

SELECT
    topic,
    velocity || '%' as velocity,
    mentions_last_hour as "1hr",
    mentions_last_6_hours as "6hr",
    mentions_last_24_hours as "24hr",
    CASE WHEN is_trending THEN '🔥 TRENDING' ELSE '---' END as status,
    calculated_at
FROM bluesky_trends
WHERE mentions_last_24_hours > 0
ORDER BY velocity DESC
LIMIT 5;

-- Test 6: Check scheduled jobs
SELECT
    '' as blank,
    '========================================' as separator,
    'TEST 6: SCHEDULED JOBS' as test_name,
    '========================================' as separator2;

SELECT
    jobname,
    schedule,
    CASE WHEN active THEN '✅ Active' ELSE '❌ Inactive' END as status
FROM cron.job
WHERE jobname LIKE '%bluesky%'
   OR jobname LIKE '%trend%'
ORDER BY jobname;

-- Test 7: Check for recent errors
SELECT
    '' as blank,
    '========================================' as separator,
    'TEST 7: RECENT ERRORS (Last 2 Hours)' as test_name,
    '========================================' as separator2;

SELECT
    function_name,
    COUNT(*) as error_count,
    MAX(created_at) as last_error,
    LEFT(MAX(error_message), 100) as sample_error
FROM job_failures
WHERE created_at >= now() - interval '2 hours'
GROUP BY function_name
ORDER BY error_count DESC
LIMIT 5;

-- Final Summary
WITH summary AS (
    SELECT
        EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'update_bluesky_trends') as velocity_func_exists,
        EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'backfill_status') as backfill_exists,
        EXISTS(SELECT 1 FROM bluesky_trends WHERE velocity > 0) as velocity_working,
        EXISTS(SELECT 1 FROM bluesky_posts WHERE ai_processed = true AND ai_processed_at >= now() - interval '1 hour') as processing_active,
        (SELECT COUNT(*) FROM bluesky_posts WHERE ai_processed = false AND ai_relevance_score >= 0.1) as unprocessed_count
)
SELECT
    '' as blank,
    '========================================' as separator,
    'SPRINT 0 DEPLOYMENT STATUS' as title,
    '========================================' as separator2,
    CASE
        WHEN velocity_func_exists AND backfill_exists AND velocity_working AND processing_active THEN
            '🎉 FULLY DEPLOYED AND WORKING!'
        WHEN velocity_func_exists AND backfill_exists THEN
            '⚠️ DEPLOYED BUT NOT PROCESSING - Check edge functions'
        WHEN NOT velocity_func_exists OR NOT backfill_exists THEN
            '❌ NOT DEPLOYED - Run migrations first!'
        ELSE
            '❓ PARTIAL DEPLOYMENT - Some components missing'
    END as status,
    CASE
        WHEN velocity_func_exists THEN '✅' ELSE '❌'
    END || ' Velocity Functions' as velocity_status,
    CASE
        WHEN backfill_exists THEN '✅' ELSE '❌'
    END || ' Backfill Infrastructure' as backfill_status,
    CASE
        WHEN velocity_working THEN '✅' ELSE '❌'
    END || ' Velocity Calculations' as velocity_calc_status,
    CASE
        WHEN processing_active THEN '✅' ELSE '❌'
    END || ' Active Processing' as processing_status,
    'Unprocessed posts: ' || unprocessed_count as backlog
FROM summary;