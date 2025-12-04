-- Create evergreen topics blocklist table
CREATE TABLE IF NOT EXISTS public.evergreen_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'generic',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.evergreen_topics ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read
CREATE POLICY "Anyone can view evergreen topics" ON public.evergreen_topics
  FOR SELECT USING (true);

-- Only admins can manage
CREATE POLICY "Admins can manage evergreen topics" ON public.evergreen_topics
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert blocklist items
INSERT INTO public.evergreen_topics (topic, category) VALUES
  -- Generic categories (should never trend)
  ('politics', 'category'),
  ('economy', 'category'),
  ('government', 'category'),
  ('healthcare', 'category'),
  ('education', 'category'),
  ('immigration', 'category'),
  ('climate', 'category'),
  ('technology', 'category'),
  ('security', 'category'),
  ('military', 'category'),
  ('foreign policy', 'category'),
  ('civil rights', 'category'),
  ('human rights', 'category'),
  ('criminal justice', 'category'),
  ('voting rights', 'category'),
  ('religious freedom', 'category'),
  ('lgbtq rights', 'category'),
  
  -- Actions/descriptions (not news)
  ('debate', 'action'),
  ('reform', 'action'),
  ('crisis', 'action'),
  ('investigation', 'action'),
  ('legislation', 'action'),
  ('announcement', 'action'),
  ('controversy', 'action'),
  ('tensions', 'action'),
  ('policy', 'action'),
  ('strategy', 'action'),
  ('approach', 'action'),
  ('movement', 'action'),
  ('issues', 'action'),
  ('challenges', 'action'),
  
  -- Demographic groups (should use affected_groups, not trending)
  ('workers', 'demographic'),
  ('immigrants', 'demographic'),
  ('refugees', 'demographic'),
  ('veterans', 'demographic'),
  ('seniors', 'demographic'),
  ('youth', 'demographic'),
  ('women', 'demographic'),
  ('disabled', 'demographic'),
  ('general_public', 'demographic'),
  ('muslim_american', 'demographic'),
  ('arab_american', 'demographic'),
  ('black_american', 'demographic'),
  ('latino_hispanic', 'demographic'),
  ('asian_american', 'demographic'),
  ('indigenous', 'demographic'),
  ('lgbtq', 'demographic')
ON CONFLICT (topic) DO NOTHING;

-- Create improved unified trends view with proper filtering
DROP MATERIALIZED VIEW IF EXISTS mv_unified_trends;

CREATE MATERIALIZED VIEW mv_unified_trends AS
WITH 
-- Get evergreen topics to exclude
blocklist AS (
  SELECT lower(topic) as topic FROM evergreen_topics
),

-- News topics with proper calculations
news_trends AS (
  SELECT 
    topic,
    'news' as source_type,
    SUM(mention_count) as mentions_1h,
    SUM(mention_count) as mentions_24h,
    MAX(velocity_score) as velocity,
    AVG(avg_sentiment_score) as sentiment,
    MAX(updated_at) as last_updated
  FROM trending_topics
  WHERE hour_timestamp >= NOW() - INTERVAL '24 hours'
    AND lower(topic) NOT IN (SELECT topic FROM blocklist)
    AND mention_count >= 2
  GROUP BY topic
),

-- Social (Bluesky) trends
social_trends AS (
  SELECT 
    topic,
    'social' as source_type,
    mentions_last_hour as mentions_1h,
    mentions_last_24_hours as mentions_24h,
    LEAST(velocity, 500) as velocity,  -- Cap at 500%
    sentiment_avg as sentiment,
    updated_at as last_updated
  FROM bluesky_trends
  WHERE is_trending = true
    AND lower(topic) NOT IN (SELECT topic FROM blocklist)
    AND mentions_last_24_hours >= 3
),

-- Entity trends (exclude demographics)
entity_trends_filtered AS (
  SELECT 
    entity_name as topic,
    'entity' as source_type,
    mentions_1h,
    mentions_24h,
    LEAST(velocity, 500) as velocity,
    sentiment_avg as sentiment,
    updated_at as last_updated
  FROM entity_trends
  WHERE is_trending = true
    AND entity_type != 'affected_group'  -- Exclude demographics
    AND lower(entity_name) NOT IN (SELECT topic FROM blocklist)
    AND mentions_24h >= 3
),

-- Combine all sources
all_trends AS (
  SELECT * FROM news_trends
  UNION ALL
  SELECT * FROM social_trends
  UNION ALL
  SELECT * FROM entity_trends_filtered
),

-- Aggregate by topic (case-insensitive)
unified AS (
  SELECT 
    lower(topic) as normalized_name,
    MAX(topic) as name,  -- Keep original casing from highest source
    ARRAY_AGG(DISTINCT source_type) as source_types,
    ARRAY_AGG(DISTINCT source_type) as sources,
    MAX(velocity) as max_velocity,
    AVG(velocity) as avg_velocity,
    SUM(mentions_1h) as total_mentions_1h,
    SUM(mentions_24h) as total_mentions_24h,
    AVG(sentiment) as avg_sentiment,
    MAX(last_updated) as last_updated,
    COUNT(DISTINCT source_type) as source_count
  FROM all_trends
  GROUP BY lower(topic)
)

SELECT 
  ROW_NUMBER() OVER (ORDER BY 
    CASE WHEN source_count >= 2 THEN 1000 ELSE 0 END +  -- Multi-source bonus
    total_mentions_1h * 10 +  -- Recent mentions weighted heavily
    LEAST(max_velocity, 500) +  -- Velocity capped
    total_mentions_24h
    DESC
  ) as id,
  name,
  normalized_name,
  source_types,
  sources,
  max_velocity,
  avg_velocity,
  total_mentions_1h,
  total_mentions_24h,
  avg_sentiment,
  last_updated,
  source_count,
  -- Unified score: recency-weighted
  (total_mentions_1h * 10 + LEAST(max_velocity, 500) + total_mentions_24h) as unified_score,
  -- Breakthrough = new in last 2 hours with high velocity
  (total_mentions_1h >= 3 AND max_velocity > 100 AND source_count >= 2) as is_breakthrough,
  NOW() as refreshed_at
FROM unified
WHERE total_mentions_24h >= 3  -- Minimum threshold
ORDER BY unified_score DESC
LIMIT 50;

-- Create index for refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_unified_trends_id ON mv_unified_trends(id);

-- Refresh the view
REFRESH MATERIALIZED VIEW mv_unified_trends;