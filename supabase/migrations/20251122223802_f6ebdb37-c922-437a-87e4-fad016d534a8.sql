-- Fix trending_topics table schema
-- Add missing columns that the application expects

ALTER TABLE trending_topics
ADD COLUMN IF NOT EXISTS velocity_score DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS momentum_score DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS trending_hour TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add index for performance on velocity-based queries
CREATE INDEX IF NOT EXISTS idx_trending_topics_velocity ON trending_topics(velocity_score DESC);
CREATE INDEX IF NOT EXISTS idx_trending_topics_hour ON trending_topics(hour_timestamp DESC);

-- Update bluesky_trends to fix sentiment calculation
-- The sentiment breakdown columns are being calculated but stored incorrectly
-- No schema changes needed, but let's add indexes for performance
CREATE INDEX IF NOT EXISTS idx_bluesky_trends_velocity ON bluesky_trends(velocity DESC);
CREATE INDEX IF NOT EXISTS idx_bluesky_trends_mentions ON bluesky_trends(mentions_last_hour DESC);
CREATE INDEX IF NOT EXISTS idx_bluesky_posts_topics ON bluesky_posts USING GIN(ai_topics);

-- Add comment to document the schema
COMMENT ON COLUMN trending_topics.velocity_score IS 'Percentage growth rate: (current - previous) / previous * 100';
COMMENT ON COLUMN trending_topics.momentum_score IS 'Rate of acceleration in mentions over time';