-- ============================================================
-- EVIDENCE-BASED TREND DETECTION MODEL
-- Replaces naive clustering with baseline-aware, corroborated trend events
-- ============================================================

-- 1. Create trend_events table (the core trend entity)
CREATE TABLE IF NOT EXISTS public.trend_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE, -- Normalized lowercase key for deduplication
  event_title text NOT NULL, -- Display title
  
  -- Temporal tracking
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  peak_at timestamptz,
  
  -- Baseline metrics (rolling historical averages)
  baseline_7d numeric DEFAULT 0, -- Average hourly mentions over 7 days
  baseline_30d numeric DEFAULT 0, -- Average hourly mentions over 30 days
  baseline_updated_at timestamptz,
  
  -- Current window counts (for comparison to baseline)
  current_1h integer DEFAULT 0,
  current_6h integer DEFAULT 0,
  current_24h integer DEFAULT 0,
  
  -- Derived velocity metrics
  velocity numeric DEFAULT 0, -- % above/below baseline
  velocity_1h numeric DEFAULT 0,
  velocity_6h numeric DEFAULT 0,
  acceleration numeric DEFAULT 0, -- Rate of velocity change
  
  -- Confidence and classification
  confidence_score numeric DEFAULT 0, -- 0-100 composite score
  confidence_factors jsonb DEFAULT '{}', -- Breakdown of confidence components
  
  -- Status flags
  is_trending boolean DEFAULT false,
  is_breaking boolean DEFAULT false, -- Requires cross-source + velocity
  is_verified boolean DEFAULT false, -- Manual verification
  trend_stage text DEFAULT 'stable' CHECK (trend_stage IN ('emerging', 'surging', 'peaking', 'declining', 'stable')),
  
  -- Cross-source corroboration
  source_count integer DEFAULT 0,
  news_source_count integer DEFAULT 0, -- RSS + Google News
  social_source_count integer DEFAULT 0, -- Bluesky
  corroboration_score numeric DEFAULT 0, -- 0-100 based on source diversity
  
  -- Entity classification
  entity_type text DEFAULT 'topic' CHECK (entity_type IN ('person', 'organization', 'event', 'legislation', 'location', 'hashtag', 'topic', 'category')),
  related_topics text[] DEFAULT '{}',
  
  -- Evidence summary
  evidence_count integer DEFAULT 0,
  top_headline text,
  sentiment_score numeric, -- -1 to 1
  sentiment_label text CHECK (sentiment_label IN ('positive', 'negative', 'neutral', 'mixed')),
  
  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for trend_events
CREATE INDEX IF NOT EXISTS idx_trend_events_trending ON public.trend_events(is_trending) WHERE is_trending = true;
CREATE INDEX IF NOT EXISTS idx_trend_events_breaking ON public.trend_events(is_breaking) WHERE is_breaking = true;
CREATE INDEX IF NOT EXISTS idx_trend_events_confidence ON public.trend_events(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_trend_events_velocity ON public.trend_events(velocity DESC);
CREATE INDEX IF NOT EXISTS idx_trend_events_last_seen ON public.trend_events(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_trend_events_stage ON public.trend_events(trend_stage);

-- 2. Create trend_evidence table (source documents for each trend)
CREATE TABLE IF NOT EXISTS public.trend_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.trend_events(id) ON DELETE CASCADE,
  
  -- Source identification
  source_type text NOT NULL CHECK (source_type IN ('rss', 'google_news', 'bluesky', 'article')),
  source_id uuid, -- Reference to original source table
  source_url text,
  source_title text,
  source_domain text, -- Extracted domain for tier lookup
  
  -- Temporal
  published_at timestamptz,
  indexed_at timestamptz DEFAULT now(),
  
  -- Contribution scoring
  contribution_score numeric DEFAULT 1, -- Weight based on source tier
  is_primary boolean DEFAULT false, -- Is this the earliest/best source?
  
  -- Deduplication
  canonical_url text,
  content_hash text,
  
  -- Sentiment contribution
  sentiment_score numeric,
  sentiment_label text,
  
  created_at timestamptz DEFAULT now(),
  
  -- Prevent duplicate evidence
  UNIQUE(event_id, source_type, source_id)
);

-- Indexes for trend_evidence
CREATE INDEX IF NOT EXISTS idx_trend_evidence_event ON public.trend_evidence(event_id);
CREATE INDEX IF NOT EXISTS idx_trend_evidence_source_type ON public.trend_evidence(source_type);
CREATE INDEX IF NOT EXISTS idx_trend_evidence_published ON public.trend_evidence(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_trend_evidence_content_hash ON public.trend_evidence(content_hash) WHERE content_hash IS NOT NULL;

-- 3. Create trend_baselines table (materialized baseline data)
CREATE TABLE IF NOT EXISTS public.trend_baselines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL,
  
  -- Date for this baseline snapshot
  baseline_date date NOT NULL,
  
  -- Counts by window
  mentions_count integer DEFAULT 0,
  hourly_average numeric DEFAULT 0,
  
  -- Source breakdown
  news_mentions integer DEFAULT 0,
  social_mentions integer DEFAULT 0,
  
  -- Sentiment
  avg_sentiment numeric,
  
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(event_key, baseline_date)
);

CREATE INDEX IF NOT EXISTS idx_trend_baselines_key_date ON public.trend_baselines(event_key, baseline_date DESC);

-- 4. Create source tier configuration table
CREATE TABLE IF NOT EXISTS public.source_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL UNIQUE,
  tier text NOT NULL CHECK (tier IN ('tier1', 'tier2', 'tier3', 'social')),
  authority_weight numeric DEFAULT 1.0,
  name text,
  category text,
  created_at timestamptz DEFAULT now()
);

-- Seed some tier1 sources (authoritative news)
INSERT INTO public.source_tiers (domain, tier, authority_weight, name, category) VALUES
  ('reuters.com', 'tier1', 2.0, 'Reuters', 'wire'),
  ('apnews.com', 'tier1', 2.0, 'AP News', 'wire'),
  ('bbc.com', 'tier1', 1.8, 'BBC', 'international'),
  ('nytimes.com', 'tier1', 1.8, 'NYT', 'national'),
  ('washingtonpost.com', 'tier1', 1.8, 'WaPo', 'national'),
  ('wsj.com', 'tier1', 1.8, 'WSJ', 'national'),
  ('npr.org', 'tier1', 1.5, 'NPR', 'national'),
  ('propublica.org', 'tier1', 1.5, 'ProPublica', 'investigative'),
  ('politico.com', 'tier2', 1.3, 'Politico', 'politics'),
  ('thehill.com', 'tier2', 1.3, 'The Hill', 'politics'),
  ('axios.com', 'tier2', 1.3, 'Axios', 'politics'),
  ('cnn.com', 'tier2', 1.2, 'CNN', 'national'),
  ('foxnews.com', 'tier2', 1.2, 'Fox News', 'national'),
  ('msnbc.com', 'tier2', 1.2, 'MSNBC', 'national'),
  ('bsky.app', 'social', 0.5, 'Bluesky', 'social')
ON CONFLICT (domain) DO NOTHING;

-- 5. Create view for active trends with full context
CREATE OR REPLACE VIEW public.trend_events_active AS
SELECT 
  te.*,
  -- Calculate delta from baseline
  CASE 
    WHEN te.baseline_7d > 0 THEN 
      ROUND(((te.current_1h - te.baseline_7d) / te.baseline_7d * 100)::numeric, 1)
    ELSE te.current_1h * 100
  END as baseline_delta_pct,
  -- Evidence counts by source
  (SELECT COUNT(*) FROM trend_evidence WHERE event_id = te.id AND source_type IN ('rss', 'google_news')) as news_evidence_count,
  (SELECT COUNT(*) FROM trend_evidence WHERE event_id = te.id AND source_type = 'bluesky') as social_evidence_count,
  -- Freshness indicator
  CASE 
    WHEN te.last_seen_at > NOW() - INTERVAL '1 hour' THEN 'fresh'
    WHEN te.last_seen_at > NOW() - INTERVAL '6 hours' THEN 'recent'
    WHEN te.last_seen_at > NOW() - INTERVAL '24 hours' THEN 'aging'
    ELSE 'stale'
  END as freshness
FROM public.trend_events te
WHERE te.is_trending = true 
   OR te.last_seen_at > NOW() - INTERVAL '6 hours'
ORDER BY 
  te.is_breaking DESC,
  te.confidence_score DESC,
  te.velocity DESC;

ALTER VIEW public.trend_events_active SET (security_invoker = true);

-- 6. Function to calculate confidence score
CREATE OR REPLACE FUNCTION public.calculate_trend_confidence(
  p_current_1h integer,
  p_baseline_7d numeric,
  p_source_count integer,
  p_news_source_count integer,
  p_evidence_count integer,
  p_velocity numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_baseline_score numeric := 0;
  v_source_score numeric := 0;
  v_volume_score numeric := 0;
  v_velocity_score numeric := 0;
  v_total numeric := 0;
BEGIN
  -- Baseline deviation score (0-30 points)
  -- Higher when current significantly exceeds baseline
  IF p_baseline_7d > 0 THEN
    v_baseline_score := LEAST(30, GREATEST(0, 
      ((p_current_1h - p_baseline_7d) / p_baseline_7d * 15)
    ));
  ELSIF p_current_1h > 0 THEN
    v_baseline_score := LEAST(30, p_current_1h * 5);
  END IF;

  -- Cross-source corroboration score (0-30 points)
  -- Requires multiple independent sources
  v_source_score := LEAST(30, 
    (p_source_count * 8) + (p_news_source_count * 5)
  );

  -- Volume score (0-20 points)
  v_volume_score := LEAST(20, p_evidence_count * 2);

  -- Velocity score (0-20 points)
  v_velocity_score := LEAST(20, GREATEST(0, p_velocity / 10));

  v_total := v_baseline_score + v_source_score + v_volume_score + v_velocity_score;

  RETURN jsonb_build_object(
    'total', ROUND(v_total),
    'baseline_delta', ROUND(v_baseline_score, 1),
    'cross_source', ROUND(v_source_score, 1),
    'volume', ROUND(v_volume_score, 1),
    'velocity', ROUND(v_velocity_score, 1)
  );
END;
$$;

-- 7. Function to determine if trend is breaking
CREATE OR REPLACE FUNCTION public.is_trend_breaking(
  p_velocity numeric,
  p_source_count integer,
  p_news_source_count integer,
  p_first_seen_at timestamptz,
  p_baseline_7d numeric,
  p_current_1h integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hours_old numeric;
  v_baseline_delta numeric;
BEGIN
  v_hours_old := EXTRACT(EPOCH FROM (NOW() - p_first_seen_at)) / 3600;
  
  -- Calculate baseline delta
  IF p_baseline_7d > 0 THEN
    v_baseline_delta := (p_current_1h - p_baseline_7d) / p_baseline_7d;
  ELSE
    v_baseline_delta := p_current_1h;
  END IF;

  -- Breaking requires:
  -- 1. High velocity (>150%) AND cross-source (>=2) AND recent (<6h) OR
  -- 2. Very high velocity (>300%) AND news confirmation OR  
  -- 3. Massive baseline deviation (>5x) AND multiple sources
  RETURN (
    (p_velocity > 150 AND p_source_count >= 2 AND p_news_source_count >= 1 AND v_hours_old < 6) OR
    (p_velocity > 300 AND p_news_source_count >= 1) OR
    (v_baseline_delta > 5 AND p_source_count >= 2 AND v_hours_old < 12)
  );
END;
$$;

-- 8. RLS policies
ALTER TABLE public.trend_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trend_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trend_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view trend_events"
  ON public.trend_events FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view trend_evidence"
  ON public.trend_evidence FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view trend_baselines"
  ON public.trend_baselines FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view source_tiers"
  ON public.source_tiers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role manages trend_events"
  ON public.trend_events FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role manages trend_evidence"
  ON public.trend_evidence FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role manages trend_baselines"
  ON public.trend_baselines FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role manages source_tiers"
  ON public.source_tiers FOR ALL TO service_role USING (true) WITH CHECK (true);