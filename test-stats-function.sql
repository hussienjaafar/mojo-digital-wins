-- Test the get_briefing_stats function
-- Run this in Supabase SQL Editor to diagnose the issue

-- 1. Check if function exists
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'get_briefing_stats';

-- 2. Test calling the function directly
SELECT public.get_briefing_stats(CURRENT_DATE);

-- 3. Test just the articles subquery (should work)
SELECT jsonb_build_object(
  'total', COUNT(*),
  'critical', COUNT(*) FILTER (WHERE threat_level = 'critical'),
  'high', COUNT(*) FILTER (WHERE threat_level = 'high'),
  'medium', COUNT(*) FILTER (WHERE threat_level = 'medium'),
  'low', COUNT(*) FILTER (WHERE threat_level = 'low')
)
FROM public.articles
WHERE published_date >= NOW() - INTERVAL '24 hours';

-- 4. Test bills subquery
SELECT jsonb_build_object(
  'total', COUNT(*),
  'critical', COUNT(*) FILTER (WHERE threat_level = 'critical'),
  'high', COUNT(*) FILTER (WHERE threat_level = 'high'),
  'medium', COUNT(*) FILTER (WHERE threat_level = 'medium'),
  'low', COUNT(*) FILTER (WHERE threat_level = 'low')
)
FROM public.bills
WHERE latest_action_date >= NOW() - INTERVAL '24 hours' OR introduced_date >= NOW() - INTERVAL '24 hours';

-- 5. Test executive_orders subquery
SELECT jsonb_build_object(
  'total', COUNT(*),
  'critical', COUNT(*) FILTER (WHERE threat_level = 'critical'),
  'high', COUNT(*) FILTER (WHERE threat_level = 'high'),
  'medium', COUNT(*) FILTER (WHERE threat_level = 'medium'),
  'low', COUNT(*) FILTER (WHERE threat_level = 'low')
)
FROM public.executive_orders
WHERE signing_date >= NOW() - INTERVAL '24 hours';

-- 6. Test state_actions subquery
SELECT jsonb_build_object(
  'total', COUNT(*),
  'critical', COUNT(*) FILTER (WHERE threat_level = 'critical'),
  'high', COUNT(*) FILTER (WHERE threat_level = 'high'),
  'medium', COUNT(*) FILTER (WHERE threat_level = 'medium'),
  'low', COUNT(*) FILTER (WHERE threat_level = 'low')
)
FROM public.state_actions
WHERE action_date >= NOW() - INTERVAL '24 hours';

-- 7. Check for missing columns
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('articles', 'bills', 'executive_orders', 'state_actions')
AND column_name IN ('threat_level', 'published_date', 'latest_action_date', 'introduced_date', 'signing_date', 'action_date')
ORDER BY table_name, column_name;
