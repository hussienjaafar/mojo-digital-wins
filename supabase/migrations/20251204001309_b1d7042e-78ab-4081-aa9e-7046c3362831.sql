
-- Phase 10.1: Enhanced trending topics infrastructure

-- 1. Add more evergreen topics that slipped through (correct column name is 'topic')
INSERT INTO public.evergreen_topics (topic, category) VALUES
  ('border security', 'generic_phrase'),
  ('immigration reform', 'generic_phrase'),
  ('political leadership', 'generic_phrase'),
  ('immigration policy', 'generic_phrase'),
  ('foreign policy', 'generic_phrase'),
  ('climate report', 'generic_phrase'),
  ('national security', 'generic_phrase'),
  ('public health', 'generic_phrase'),
  ('social justice', 'generic_phrase'),
  ('economic policy', 'generic_phrase'),
  ('voting rights', 'generic_phrase'),
  ('human rights', 'generic_phrase'),
  ('civil liberties', 'generic_phrase'),
  ('domestic policy', 'generic_phrase'),
  ('trade policy', 'generic_phrase'),
  ('tax reform', 'generic_phrase'),
  ('gun control', 'generic_phrase'),
  ('gun rights', 'generic_phrase'),
  ('abortion rights', 'generic_phrase'),
  ('weather', 'generic_term'),
  ('corruption', 'generic_term'),
  ('racism', 'generic_term'),
  ('elections', 'generic_term'),
  ('voting', 'generic_term')
ON CONFLICT (topic) DO NOTHING;

-- 2. Create topic_baselines table for 7-day rolling averages
CREATE TABLE IF NOT EXISTS public.topic_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  avg_daily_mentions NUMERIC DEFAULT 0,
  avg_hourly_mentions NUMERIC DEFAULT 0,
  peak_mentions_24h INTEGER DEFAULT 0,
  baseline_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  data_points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(normalized_name)
);

-- Enable RLS
ALTER TABLE public.topic_baselines ENABLE ROW LEVEL SECURITY;

-- Allow read access
CREATE POLICY "Allow public read of topic_baselines"
  ON public.topic_baselines FOR SELECT
  USING (true);

-- Allow service role full access
CREATE POLICY "Allow service role manage topic_baselines"
  ON public.topic_baselines FOR ALL
  USING (true)
  WITH CHECK (true);

-- 3. Create function to calculate topic baselines
CREATE OR REPLACE FUNCTION public.calculate_topic_baselines()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  topics_updated INTEGER := 0;
BEGIN
  -- Calculate 7-day baselines for all active topics
  INSERT INTO public.topic_baselines (topic_name, normalized_name, avg_daily_mentions, avg_hourly_mentions, peak_mentions_24h, data_points, baseline_calculated_at, updated_at)
  SELECT 
    topic,
    LOWER(TRIM(topic)),
    ROUND(COUNT(*)::NUMERIC / 7, 2) as avg_daily,
    ROUND(COUNT(*)::NUMERIC / (7 * 24), 2) as avg_hourly,
    MAX(daily_count) as peak_24h,
    COUNT(DISTINCT DATE(created_at)) as data_points,
    NOW(),
    NOW()
  FROM (
    SELECT 
      unnest(ai_topics) as topic,
      created_at,
      COUNT(*) OVER (PARTITION BY unnest(ai_topics), DATE(created_at)) as daily_count
    FROM public.bluesky_posts
    WHERE ai_processed = true
      AND created_at >= NOW() - INTERVAL '7 days'
  ) subq
  WHERE topic IS NOT NULL
    AND LENGTH(topic) > 2
    AND topic ~ '^[A-Z]'
    AND LOWER(topic) NOT IN (SELECT LOWER(topic) FROM public.evergreen_topics)
  GROUP BY topic
  HAVING COUNT(*) >= 3
  ON CONFLICT (normalized_name) DO UPDATE SET
    avg_daily_mentions = EXCLUDED.avg_daily_mentions,
    avg_hourly_mentions = EXCLUDED.avg_hourly_mentions,
    peak_mentions_24h = EXCLUDED.peak_mentions_24h,
    data_points = EXCLUDED.data_points,
    baseline_calculated_at = NOW(),
    updated_at = NOW();
  
  GET DIAGNOSTICS topics_updated = ROW_COUNT;
  RETURN topics_updated;
END;
$$;

-- Grant execute to service_role
GRANT EXECUTE ON FUNCTION public.calculate_topic_baselines() TO service_role;
GRANT SELECT ON public.topic_baselines TO anon, authenticated;
