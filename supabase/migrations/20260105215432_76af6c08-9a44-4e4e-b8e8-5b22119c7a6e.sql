-- ============================================================
-- UNIFIED SOURCE REGISTRY + HEALTH TRACKING + CROSS-SOURCE DEDUPE
-- ============================================================

-- 1. Add tier and tags to rss_sources (extend existing table)
ALTER TABLE public.rss_sources 
  ADD COLUMN IF NOT EXISTS tier text DEFAULT 'national' CHECK (tier IN ('national', 'state', 'local', 'international', 'specialized')),
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'rss' CHECK (source_type IN ('rss', 'google_news', 'bluesky', 'manual')),
  ADD COLUMN IF NOT EXISTS expected_cadence_mins integer DEFAULT 60,
  ADD COLUMN IF NOT EXISTS success_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_success_at timestamptz,
  ADD COLUMN IF NOT EXISTS backoff_until timestamptz;

-- Update existing sources with appropriate tiers based on category
UPDATE public.rss_sources SET tier = 'national' WHERE category IN ('mainstream', 'politics', 'conservative', 'independent', 'investigations');
UPDATE public.rss_sources SET tier = 'state' WHERE category IN ('state_government');
UPDATE public.rss_sources SET tier = 'specialized' WHERE category IN ('specialized', 'civil_rights');
UPDATE public.rss_sources SET tier = 'national' WHERE category IN ('government');

-- 2. Create google_news_sources table (DB-driven, not hardcoded)
CREATE TABLE IF NOT EXISTS public.google_news_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL UNIQUE,
  tier text DEFAULT 'national' CHECK (tier IN ('national', 'state', 'local', 'international', 'specialized')),
  tags text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  expected_cadence_mins integer DEFAULT 30,
  last_fetched_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error text,
  consecutive_errors integer DEFAULT 0,
  success_count integer DEFAULT 0,
  backoff_until timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Migrate hardcoded Google News feeds into DB
INSERT INTO public.google_news_sources (name, url, tier, tags) VALUES
  ('US Politics', 'https://news.google.com/rss/topics/CAAqIggKIhxDQkFTRHdvSkwyMHZNRFZ4ZERBU0FtVnVLQUFQAQ?hl=en-US&gl=US&ceid=US:en', 'national', ARRAY['politics', 'federal']),
  ('Congress Legislation', 'https://news.google.com/rss/search?q=congress+legislation&hl=en-US&gl=US&ceid=US:en', 'national', ARRAY['congress', 'legislation']),
  ('White House', 'https://news.google.com/rss/search?q=white+house+biden+trump&hl=en-US&gl=US&ceid=US:en', 'national', ARRAY['executive', 'white house']),
  ('Supreme Court', 'https://news.google.com/rss/search?q=supreme+court+ruling&hl=en-US&gl=US&ceid=US:en', 'national', ARRAY['judiciary', 'supreme court']),
  ('Election 2024', 'https://news.google.com/rss/search?q=election+2024+campaign&hl=en-US&gl=US&ceid=US:en', 'national', ARRAY['election', 'campaign']),
  ('Immigration Policy', 'https://news.google.com/rss/search?q=immigration+policy+border&hl=en-US&gl=US&ceid=US:en', 'national', ARRAY['immigration', 'policy']),
  ('Civil Rights', 'https://news.google.com/rss/search?q=civil+rights+discrimination&hl=en-US&gl=US&ceid=US:en', 'national', ARRAY['civil rights', 'discrimination'])
ON CONFLICT (url) DO NOTHING;

-- 4. Create unified source health view
CREATE OR REPLACE VIEW public.source_health AS
SELECT 
  id,
  name,
  url,
  'rss'::text as source_type,
  tier,
  tags,
  is_active,
  expected_cadence_mins,
  last_fetched_at,
  last_success_at,
  CASE WHEN fetch_error IS NOT NULL THEN last_fetched_at ELSE NULL END as last_failure_at,
  consecutive_errors as failure_count,
  fetch_error as last_error,
  backoff_until,
  -- Health status calculation
  CASE 
    WHEN backoff_until > now() THEN 'backoff'
    WHEN consecutive_errors >= 5 THEN 'critical'
    WHEN consecutive_errors >= 3 THEN 'degraded'
    WHEN last_success_at IS NULL THEN 'unknown'
    WHEN last_success_at < now() - (expected_cadence_mins * 3 || ' minutes')::interval THEN 'stale'
    ELSE 'healthy'
  END as health_status,
  -- Minutes since last success
  EXTRACT(EPOCH FROM (now() - COALESCE(last_success_at, last_fetched_at))) / 60 as mins_since_success
FROM public.rss_sources
UNION ALL
SELECT 
  id,
  name,
  url,
  'google_news'::text as source_type,
  tier,
  tags,
  is_active,
  expected_cadence_mins,
  last_fetched_at,
  last_success_at,
  last_failure_at,
  consecutive_errors as failure_count,
  last_error,
  backoff_until,
  CASE 
    WHEN backoff_until > now() THEN 'backoff'
    WHEN consecutive_errors >= 5 THEN 'critical'
    WHEN consecutive_errors >= 3 THEN 'degraded'
    WHEN last_success_at IS NULL THEN 'unknown'
    WHEN last_success_at < now() - (expected_cadence_mins * 3 || ' minutes')::interval THEN 'stale'
    ELSE 'healthy'
  END as health_status,
  EXTRACT(EPOCH FROM (now() - COALESCE(last_success_at, last_fetched_at))) / 60 as mins_since_success
FROM public.google_news_sources;

-- 5. Add content_hash column to articles for improved dedupe
ALTER TABLE public.articles 
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS canonical_url text;

-- Create index for content hash dedupe
CREATE INDEX IF NOT EXISTS idx_articles_content_hash ON public.articles(content_hash) WHERE content_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_articles_canonical_url ON public.articles(canonical_url) WHERE canonical_url IS NOT NULL;

-- 6. Add content_hash to google_news_articles
ALTER TABLE public.google_news_articles 
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS canonical_url text;

CREATE INDEX IF NOT EXISTS idx_google_news_content_hash ON public.google_news_articles(content_hash) WHERE content_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_google_news_canonical_url ON public.google_news_articles(canonical_url) WHERE canonical_url IS NOT NULL;

-- 7. Create cross-source dedupe tracking table
CREATE TABLE IF NOT EXISTS public.article_dedupe_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash text NOT NULL,
  canonical_url text,
  first_seen_at timestamptz DEFAULT now(),
  source_type text NOT NULL,
  source_id uuid,
  article_id uuid,
  title_snippet text,
  published_date date,
  UNIQUE(content_hash, source_type)
);

CREATE INDEX IF NOT EXISTS idx_dedupe_content_hash ON public.article_dedupe_registry(content_hash);
CREATE INDEX IF NOT EXISTS idx_dedupe_canonical_url ON public.article_dedupe_registry(canonical_url) WHERE canonical_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dedupe_published_date ON public.article_dedupe_registry(published_date);

-- 8. Create function to update source health on fetch
CREATE OR REPLACE FUNCTION public.update_source_health(
  p_source_id uuid,
  p_source_type text,
  p_success boolean,
  p_error_message text DEFAULT NULL,
  p_items_fetched integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_backoff_mins integer;
  v_current_errors integer;
BEGIN
  IF p_source_type = 'rss' THEN
    IF p_success THEN
      UPDATE rss_sources SET
        last_fetched_at = now(),
        last_success_at = now(),
        fetch_error = NULL,
        consecutive_errors = 0,
        success_count = COALESCE(success_count, 0) + 1,
        backoff_until = NULL
      WHERE id = p_source_id;
    ELSE
      -- Get current error count for exponential backoff
      SELECT COALESCE(consecutive_errors, 0) INTO v_current_errors FROM rss_sources WHERE id = p_source_id;
      v_backoff_mins := LEAST(POWER(2, v_current_errors + 1)::integer, 480); -- Max 8 hours
      
      UPDATE rss_sources SET
        last_fetched_at = now(),
        fetch_error = p_error_message,
        last_error_message = p_error_message,
        consecutive_errors = COALESCE(consecutive_errors, 0) + 1,
        error_count = COALESCE(error_count, 0) + 1,
        backoff_until = now() + (v_backoff_mins || ' minutes')::interval
      WHERE id = p_source_id;
    END IF;
    
  ELSIF p_source_type = 'google_news' THEN
    IF p_success THEN
      UPDATE google_news_sources SET
        last_fetched_at = now(),
        last_success_at = now(),
        last_error = NULL,
        consecutive_errors = 0,
        success_count = COALESCE(success_count, 0) + 1,
        backoff_until = NULL,
        updated_at = now()
      WHERE id = p_source_id;
    ELSE
      SELECT COALESCE(consecutive_errors, 0) INTO v_current_errors FROM google_news_sources WHERE id = p_source_id;
      v_backoff_mins := LEAST(POWER(2, v_current_errors + 1)::integer, 480);
      
      UPDATE google_news_sources SET
        last_fetched_at = now(),
        last_failure_at = now(),
        last_error = p_error_message,
        consecutive_errors = COALESCE(consecutive_errors, 0) + 1,
        backoff_until = now() + (v_backoff_mins || ' minutes')::interval,
        updated_at = now()
      WHERE id = p_source_id;
    END IF;
  END IF;
END;
$$;

-- 9. Create function to check if article is duplicate across sources
CREATE OR REPLACE FUNCTION public.check_article_duplicate(
  p_content_hash text,
  p_canonical_url text DEFAULT NULL
)
RETURNS TABLE(is_duplicate boolean, existing_source_type text, existing_article_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    true as is_duplicate,
    source_type as existing_source_type,
    article_id as existing_article_id
  FROM article_dedupe_registry
  WHERE content_hash = p_content_hash
     OR (p_canonical_url IS NOT NULL AND canonical_url = p_canonical_url)
  LIMIT 1;
  
  -- If no rows returned, return false
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::text, NULL::uuid;
  END IF;
END;
$$;

-- 10. Create aggregate source health summary view
CREATE OR REPLACE VIEW public.source_health_summary AS
SELECT
  source_type,
  COUNT(*) as total_sources,
  COUNT(*) FILTER (WHERE is_active) as active_sources,
  COUNT(*) FILTER (WHERE health_status = 'healthy') as healthy_sources,
  COUNT(*) FILTER (WHERE health_status = 'stale') as stale_sources,
  COUNT(*) FILTER (WHERE health_status IN ('degraded', 'critical')) as unhealthy_sources,
  AVG(mins_since_success) FILTER (WHERE is_active) as avg_mins_since_success,
  MAX(mins_since_success) FILTER (WHERE is_active) as max_mins_since_success
FROM public.source_health
GROUP BY source_type;

-- 11. Enable RLS on new tables
ALTER TABLE public.google_news_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_dedupe_registry ENABLE ROW LEVEL SECURITY;

-- RLS policies for authenticated access
CREATE POLICY "Authenticated users can view google_news_sources"
  ON public.google_news_sources FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view article_dedupe_registry"
  ON public.article_dedupe_registry FOR SELECT
  TO authenticated
  USING (true);

-- Service role can manage
CREATE POLICY "Service role manages google_news_sources"
  ON public.google_news_sources FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role manages article_dedupe_registry"
  ON public.article_dedupe_registry FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);