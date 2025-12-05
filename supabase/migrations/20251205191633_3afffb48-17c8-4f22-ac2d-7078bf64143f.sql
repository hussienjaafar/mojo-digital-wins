-- Phase 4: Database Schema Optimization (Part 1: Indexes)

-- Add composite indexes for common queries (without CONCURRENTLY)

-- Optimized index for recent processed bluesky posts
CREATE INDEX IF NOT EXISTS idx_bluesky_posts_processed_recent 
ON bluesky_posts (created_at DESC) 
WHERE ai_processed = true;

-- Index for entity mentions queries
CREATE INDEX IF NOT EXISTS idx_entity_mentions_recent 
ON entity_mentions (mentioned_at DESC, entity_type);

-- Index for articles by threat level and date
CREATE INDEX IF NOT EXISTS idx_articles_threat_recent 
ON articles (published_date DESC, threat_level) 
WHERE threat_level IN ('critical', 'high');

-- Index for job executions cleanup
CREATE INDEX IF NOT EXISTS idx_job_executions_started 
ON job_executions (started_at DESC);

-- Index for AI cache lookups
CREATE INDEX IF NOT EXISTS idx_ai_cache_content_hash 
ON ai_analysis_cache (content_hash);

-- Archive table for old bluesky posts
CREATE TABLE IF NOT EXISTS bluesky_posts_archive (
  id uuid PRIMARY KEY,
  author_did text NOT NULL,
  post_uri text NOT NULL,
  created_at timestamptz NOT NULL,
  text text,
  ai_topics text[],
  ai_sentiment numeric,
  ai_sentiment_label text,
  affected_groups text[],
  archived_at timestamptz DEFAULT NOW()
);

-- Archive table for old articles  
CREATE TABLE IF NOT EXISTS articles_archive (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  source_name text NOT NULL,
  source_url text NOT NULL,
  published_date timestamptz NOT NULL,
  threat_level text,
  relevance_category text,
  affected_groups text[],
  ai_summary text,
  sentiment_score numeric,
  archived_at timestamptz DEFAULT NOW()
);

-- Enable RLS on archive tables
ALTER TABLE bluesky_posts_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles_archive ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for archive tables (admin only)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bluesky_posts_archive' AND policyname = 'Admins can manage bluesky archive') THEN
    CREATE POLICY "Admins can manage bluesky archive" ON bluesky_posts_archive
      FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'articles_archive' AND policyname = 'Admins can manage articles archive') THEN
    CREATE POLICY "Admins can manage articles archive" ON articles_archive
      FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- Add function to archive old data
CREATE OR REPLACE FUNCTION archive_old_data()
RETURNS TABLE(bluesky_archived int, articles_archived int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bs_count int := 0;
  art_count int := 0;
BEGIN
  -- Archive bluesky posts older than 30 days
  WITH archived AS (
    INSERT INTO bluesky_posts_archive (id, author_did, post_uri, created_at, text, ai_topics, ai_sentiment, ai_sentiment_label, affected_groups)
    SELECT id, author_did, post_uri, created_at, text, ai_topics, ai_sentiment, ai_sentiment_label, affected_groups
    FROM bluesky_posts
    WHERE created_at < NOW() - INTERVAL '30 days'
    AND ai_processed = true
    ON CONFLICT (id) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO bs_count FROM archived;

  -- Delete archived bluesky posts
  DELETE FROM bluesky_posts 
  WHERE created_at < NOW() - INTERVAL '30 days'
  AND ai_processed = true
  AND id IN (SELECT id FROM bluesky_posts_archive);

  -- Archive articles older than 90 days
  WITH archived AS (
    INSERT INTO articles_archive (id, title, source_name, source_url, published_date, threat_level, relevance_category, affected_groups, ai_summary, sentiment_score)
    SELECT id, title, source_name, source_url, published_date, threat_level, relevance_category, affected_groups, ai_summary, sentiment_score
    FROM articles
    WHERE published_date < NOW() - INTERVAL '90 days'
    ON CONFLICT (id) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO art_count FROM archived;

  -- Delete archived articles
  DELETE FROM articles 
  WHERE published_date < NOW() - INTERVAL '90 days'
  AND id IN (SELECT id FROM articles_archive);

  RETURN QUERY SELECT bs_count, art_count;
END;
$$;