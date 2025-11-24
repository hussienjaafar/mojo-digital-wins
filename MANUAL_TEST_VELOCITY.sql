-- ============================================================================
-- MANUAL TEST FOR VELOCITY ALGORITHM
-- Run this to test if the velocity fix would work even if not deployed
-- ============================================================================

-- Step 1: Create test data if needed
DO $$
BEGIN
    -- Only insert test data if we have less than 10 posts
    IF (SELECT COUNT(*) FROM bluesky_posts WHERE ai_processed = true) < 10 THEN
        RAISE NOTICE 'Inserting test data for velocity testing...';

        -- Insert some test posts with topics
        INSERT INTO bluesky_posts (
            post_uri,
            post_cid,
            author_did,
            author_handle,
            text,
            created_at,
            ai_topics,
            ai_sentiment,
            ai_processed,
            ai_processed_at,
            ai_relevance_score
        )
        SELECT
            'test://post/' || i,
            'test_cid_' || i,
            'test_did_' || i,
            'testuser' || i,
            'Test post about ' || topic,
            NOW() - (i || ' hours')::interval,
            ARRAY[topic],
            (RANDOM() * 2 - 1)::numeric,  -- Random sentiment between -1 and 1
            true,
            NOW() - (i || ' hours')::interval,
            0.5 + RANDOM() * 0.5  -- Relevance between 0.5 and 1
        FROM (
            SELECT generate_series(1, 50) as i,
                   (ARRAY['Gaza', 'Palestine', 'Immigration', 'Climate Change', 'CAIR'])[
                       1 + floor(random() * 5)::int
                   ] as topic
        ) t;

        RAISE NOTICE 'Test data inserted!';
    ELSE
        RAISE NOTICE 'Sufficient data exists for testing.';
    END IF;
END $$;

-- Step 2: Test the velocity calculation manually
WITH topic_counts AS (
    -- Count posts for each topic in different time windows
    SELECT
        unnest(ai_topics) as topic,
        COUNT(*) FILTER (WHERE created_at >= now() - interval '1 hour') as hour_count,
        COUNT(*) FILTER (WHERE created_at >= now() - interval '6 hours') as six_hour_count,
        COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours') as day_count,
        COUNT(*) as total_count
    FROM bluesky_posts
    WHERE ai_processed = true
    GROUP BY unnest(ai_topics)
),
velocity_calc AS (
    -- Calculate velocity manually
    SELECT
        topic,
        hour_count,
        six_hour_count,
        day_count,
        total_count,
        -- Manual velocity calculation (same as Sprint 0 fix)
        CASE
            WHEN day_count > 0 THEN
                ((six_hour_count::numeric / 6 - day_count::numeric / 24) /
                 (day_count::numeric / 24)) * 100
            WHEN six_hour_count > 0 THEN 500
            ELSE 0
        END as calculated_velocity,
        -- Check if it should be trending
        CASE
            WHEN ((six_hour_count::numeric / 6 - day_count::numeric / 24) /
                  NULLIF(day_count::numeric / 24, 0)) * 100 > 50 AND day_count >= 3 THEN true
            WHEN six_hour_count >= 5 THEN true
            ELSE false
        END as should_be_trending
    FROM topic_counts
)
SELECT
    '📊 MANUAL VELOCITY TEST' as test,
    '================================' as separator;

SELECT
    topic,
    calculated_velocity::numeric(10,2) || '%' as "Calculated Velocity",
    hour_count || '/' || six_hour_count || '/' || day_count as "1h/6h/24h",
    CASE WHEN should_be_trending THEN '🔥 YES' ELSE 'NO' END as "Should Trend?",
    CASE
        WHEN calculated_velocity > 0 THEN '✅ Working'
        ELSE '❌ Zero'
    END as status
FROM velocity_calc
ORDER BY calculated_velocity DESC
LIMIT 10;

-- Step 3: Compare with actual bluesky_trends table
SELECT
    '' as blank,
    '📊 ACTUAL vs EXPECTED' as comparison,
    '================================' as separator;

WITH expected AS (
    SELECT
        unnest(ai_topics) as topic,
        COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours') as day_count
    FROM bluesky_posts
    WHERE ai_processed = true
    GROUP BY unnest(ai_topics)
),
actual AS (
    SELECT
        topic,
        velocity,
        mentions_last_24_hours
    FROM bluesky_trends
)
SELECT
    COALESCE(e.topic, a.topic) as topic,
    COALESCE(a.velocity, 0) as "Actual Velocity",
    COALESCE(e.day_count, 0) as "Expected 24h Count",
    COALESCE(a.mentions_last_24_hours, 0) as "Actual 24h Count",
    CASE
        WHEN a.velocity IS NULL THEN '❌ Not in trends table'
        WHEN a.velocity = 0 AND e.day_count > 0 THEN '❌ Velocity is 0 (BROKEN)'
        WHEN a.velocity > 0 THEN '✅ Velocity working'
        ELSE '❓ Unknown'
    END as diagnosis
FROM expected e
FULL OUTER JOIN actual a ON e.topic = a.topic
WHERE COALESCE(e.day_count, 0) > 0
ORDER BY COALESCE(e.day_count, 0) DESC
LIMIT 10;

-- Step 4: Test if the fix function exists
SELECT
    '' as blank,
    '🔧 FUNCTION CHECK' as check_type,
    '================================' as separator;

SELECT
    CASE
        WHEN EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'update_bluesky_trends')
        THEN '✅ update_bluesky_trends function EXISTS - Sprint 0 deployed!'
        ELSE '❌ update_bluesky_trends function MISSING - Sprint 0 not deployed'
    END as function_status;

-- Step 5: If function exists, try running it
DO $$
BEGIN
    IF EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'update_bluesky_trends') THEN
        RAISE NOTICE '';
        RAISE NOTICE '🚀 Running update_bluesky_trends() function...';
        PERFORM update_bluesky_trends();
        RAISE NOTICE '✅ Function executed successfully!';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '❌ Cannot run update_bluesky_trends() - function does not exist';
        RAISE NOTICE '📝 Deploy Sprint 0 migrations first!';
    END IF;
END $$;

-- Step 6: Final check after running function
SELECT
    '' as blank,
    '📊 FINAL VELOCITY CHECK' as final_check,
    '================================' as separator;

SELECT
    topic,
    velocity || '%' as velocity,
    mentions_last_hour || '/' || mentions_last_6_hours || '/' || mentions_last_24_hours as "1h/6h/24h",
    CASE WHEN is_trending THEN '🔥 TRENDING' ELSE '' END as status,
    calculated_at
FROM bluesky_trends
WHERE mentions_last_24_hours > 0
ORDER BY velocity DESC
LIMIT 5;