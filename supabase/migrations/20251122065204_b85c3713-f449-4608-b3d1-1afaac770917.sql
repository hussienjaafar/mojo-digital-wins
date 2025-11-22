-- Add unique constraint on topic column to enable upsert
ALTER TABLE bluesky_trends
ADD CONSTRAINT bluesky_trends_topic_key UNIQUE (topic);