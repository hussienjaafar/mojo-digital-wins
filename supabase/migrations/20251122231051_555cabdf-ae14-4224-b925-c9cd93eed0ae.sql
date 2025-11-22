-- Week 3: Performance Optimization - Add comprehensive database indexes (Fixed)

-- Articles table indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_articles_processing_queue 
ON public.articles (topics_extracted, published_date DESC) 
WHERE topics_extracted = false;

CREATE INDEX IF NOT EXISTS idx_articles_analyzed_recent 
ON public.articles (processing_status, published_date DESC)
WHERE processing_status = 'completed';

CREATE INDEX IF NOT EXISTS idx_articles_group_category 
ON public.articles USING GIN (affected_groups, tags);

CREATE INDEX IF NOT EXISTS idx_articles_relevance 
ON public.articles (relevance_category, threat_level, published_date DESC)
WHERE relevance_category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_articles_threat_level 
ON public.articles (threat_level, published_date DESC)
WHERE threat_level IN ('critical', 'high');

CREATE INDEX IF NOT EXISTS idx_articles_validation 
ON public.articles (validation_passed, ai_confidence_score)
WHERE validation_passed = false;

-- Bluesky posts indexes for analysis and trends
CREATE INDEX IF NOT EXISTS idx_bluesky_analysis_queue 
ON public.bluesky_posts (ai_processed, created_at DESC) 
WHERE ai_processed = false;

CREATE INDEX IF NOT EXISTS idx_bluesky_processed_recent 
ON public.bluesky_posts (ai_processed, created_at DESC)
WHERE ai_processed = true;

CREATE INDEX IF NOT EXISTS idx_bluesky_groups_category 
ON public.bluesky_posts USING GIN (affected_groups, ai_topics);

CREATE INDEX IF NOT EXISTS idx_bluesky_relevance 
ON public.bluesky_posts (ai_relevance_score, created_at DESC)
WHERE ai_relevance_score >= 0.1;

-- Bluesky trends indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_bluesky_trends_trending 
ON public.bluesky_trends (is_trending, velocity DESC, calculated_at DESC)
WHERE is_trending = true;

CREATE INDEX IF NOT EXISTS idx_bluesky_trends_topic 
ON public.bluesky_trends (topic, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_bluesky_trends_velocity 
ON public.bluesky_trends (velocity DESC, mentions_last_24_hours DESC)
WHERE velocity > 100;

-- RSS sources index for incremental fetching
CREATE INDEX IF NOT EXISTS idx_rss_sources_fetch_queue 
ON public.rss_sources (last_fetched_at NULLS FIRST, is_active)
WHERE is_active = true;

-- Job failures and checkpoints for monitoring
CREATE INDEX IF NOT EXISTS idx_job_failures_retry_queue 
ON public.job_failures (retry_count, last_retry_at NULLS FIRST, created_at)
WHERE resolved_at IS NULL AND retry_count < max_retries;

CREATE INDEX IF NOT EXISTS idx_job_failures_function 
ON public.job_failures (function_name, created_at DESC)
WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_checkpoints_function 
ON public.processing_checkpoints (function_name, last_processed_at DESC);

-- AI cache index (without time-based predicate)
CREATE INDEX IF NOT EXISTS idx_ai_cache_content_lookup 
ON public.ai_analysis_cache (content_hash, model, prompt_hash);

CREATE INDEX IF NOT EXISTS idx_ai_cache_created 
ON public.ai_analysis_cache (created_at DESC);

-- Bills indexes for filtering
CREATE INDEX IF NOT EXISTS idx_bills_relevance 
ON public.bills (relevance_score DESC, latest_action_date DESC)
WHERE relevance_score > 0;

CREATE INDEX IF NOT EXISTS idx_bills_recent_actions 
ON public.bills (latest_action_date DESC, congress DESC);

-- Update table statistics for better query planning
ANALYZE public.articles;
ANALYZE public.bluesky_posts;
ANALYZE public.bluesky_trends;
ANALYZE public.rss_sources;
ANALYZE public.bills;
ANALYZE public.ai_analysis_cache;