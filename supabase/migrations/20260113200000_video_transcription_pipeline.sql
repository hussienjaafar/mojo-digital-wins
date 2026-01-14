-- =============================================================================
-- VIDEO TRANSCRIPTION PIPELINE SCHEMA
-- =============================================================================
-- Adds tables for tracking video asset fetching and transcription analysis.
-- Designed for correlating video content features against ROAS, CTR, CPA.

-- =============================================================================
-- 1. META AD VIDEOS TABLE
-- =============================================================================
-- Tracks the status of video asset resolution and fetching from Meta API.
-- Videos may be inaccessible due to API restrictions, permissions, or expiry.

CREATE TABLE IF NOT EXISTS public.meta_ad_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  ad_id TEXT NOT NULL,
  creative_id TEXT,
  video_id TEXT NOT NULL,

  -- Video source information
  video_source_url TEXT,
  video_source_expires_at TIMESTAMPTZ,
  thumbnail_url TEXT,
  duration_seconds INTEGER,

  -- Resolution method tracking
  resolution_method TEXT CHECK (resolution_method IN (
    'creative.video_id',
    'object_story_spec.video_data.video_id',
    'object_story_spec.link_data.video_id',
    'asset_feed_spec.videos',
    'effective_object_story_id',
    'ad_preview_fallback',
    'manual'
  )),

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN (
    'PENDING',           -- Initial state, video_id known
    'URL_FETCHED',       -- Successfully got source URL from Meta
    'URL_EXPIRED',       -- Source URL was fetched but has expired
    'URL_INACCESSIBLE',  -- Meta returned error for source URL request
    'DOWNLOADED',        -- Video file downloaded to storage
    'TRANSCRIBED',       -- Successfully transcribed
    'TRANSCRIPT_FAILED', -- Transcription failed
    'ERROR'              -- General error state
  )),

  -- Error tracking
  error_code TEXT,
  error_message TEXT,
  last_error_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0,

  -- Timestamps
  url_fetched_at TIMESTAMPTZ,
  downloaded_at TIMESTAMPTZ,
  transcribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Unique constraint: one row per org + ad + video combination
  CONSTRAINT meta_ad_videos_unique UNIQUE (organization_id, ad_id, video_id)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_meta_ad_videos_org_status
  ON public.meta_ad_videos(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_meta_ad_videos_video_id
  ON public.meta_ad_videos(video_id);

CREATE INDEX IF NOT EXISTS idx_meta_ad_videos_pending
  ON public.meta_ad_videos(organization_id, status)
  WHERE status IN ('PENDING', 'URL_FETCHED', 'DOWNLOADED');

CREATE INDEX IF NOT EXISTS idx_meta_ad_videos_needs_transcription
  ON public.meta_ad_videos(organization_id, status)
  WHERE status = 'URL_FETCHED' OR status = 'DOWNLOADED';


-- =============================================================================
-- 2. META AD TRANSCRIPTS TABLE
-- =============================================================================
-- Stores transcript text and AI-analyzed features for video ads.
-- These features can be correlated against performance metrics.

CREATE TABLE IF NOT EXISTS public.meta_ad_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  ad_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  video_ref UUID REFERENCES public.meta_ad_videos(id) ON DELETE SET NULL,

  -- Raw transcript
  transcript_text TEXT NOT NULL,
  transcript_segments JSONB,  -- Array of {start, end, text, confidence} for word-level timing

  -- Audio/Video metrics
  duration_seconds NUMERIC(10,2),
  language TEXT DEFAULT 'en',
  language_confidence NUMERIC(5,4),

  -- Speaking analysis
  speaker_count INTEGER DEFAULT 1,
  words_total INTEGER,
  words_per_minute NUMERIC(6,2),
  silence_percentage NUMERIC(5,2),  -- % of video that is silence

  -- Hook analysis (first 3-5 seconds)
  hook_text TEXT,                    -- First ~15 words or 3 seconds
  hook_duration_seconds NUMERIC(5,2),
  hook_word_count INTEGER,

  -- AI-analyzed content features
  topic_primary TEXT,                -- Main topic (immigration, healthcare, etc)
  topic_tags TEXT[] DEFAULT '{}',    -- All detected topics
  tone_primary TEXT,                 -- Main tone (urgent, hopeful, angry, etc)
  tone_tags TEXT[] DEFAULT '{}',     -- All detected tones
  sentiment_score NUMERIC(5,4),      -- -1 to 1
  sentiment_label TEXT,              -- positive/negative/neutral

  -- Call-to-action analysis
  cta_text TEXT,                     -- Detected call to action
  cta_type TEXT,                     -- donate, sign, share, learn_more
  cta_timestamp_seconds NUMERIC(10,2),

  -- Emotional triggers
  urgency_level TEXT CHECK (urgency_level IN ('low', 'medium', 'high', 'extreme')),
  emotional_appeals TEXT[] DEFAULT '{}',  -- fear, hope, anger, compassion, etc

  -- Key phrases for pattern matching
  key_phrases TEXT[] DEFAULT '{}',

  -- Transcription metadata
  transcription_model TEXT,          -- whisper-1, etc
  transcription_confidence NUMERIC(5,4),
  analysis_model TEXT,               -- gpt-4, etc
  analysis_version TEXT,

  -- Timestamps
  transcribed_at TIMESTAMPTZ DEFAULT now(),
  analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Unique constraint
  CONSTRAINT meta_ad_transcripts_unique UNIQUE (organization_id, ad_id, video_id)
);

-- Indexes for analysis queries
CREATE INDEX IF NOT EXISTS idx_meta_ad_transcripts_org
  ON public.meta_ad_transcripts(organization_id);

CREATE INDEX IF NOT EXISTS idx_meta_ad_transcripts_topic
  ON public.meta_ad_transcripts(organization_id, topic_primary);

CREATE INDEX IF NOT EXISTS idx_meta_ad_transcripts_tone
  ON public.meta_ad_transcripts(organization_id, tone_primary);

CREATE INDEX IF NOT EXISTS idx_meta_ad_transcripts_urgency
  ON public.meta_ad_transcripts(organization_id, urgency_level);

-- GIN index for array searches
CREATE INDEX IF NOT EXISTS idx_meta_ad_transcripts_topics_gin
  ON public.meta_ad_transcripts USING GIN (topic_tags);

CREATE INDEX IF NOT EXISTS idx_meta_ad_transcripts_tones_gin
  ON public.meta_ad_transcripts USING GIN (tone_tags);


-- =============================================================================
-- 3. ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on both tables
ALTER TABLE public.meta_ad_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_ad_transcripts ENABLE ROW LEVEL SECURITY;

-- Videos: Users can view their own org's videos
CREATE POLICY "Users can view own org videos"
  ON public.meta_ad_videos FOR SELECT
  USING (organization_id = public.get_user_organization_id());

-- Videos: Service role can manage all
CREATE POLICY "Service role can manage videos"
  ON public.meta_ad_videos FOR ALL
  USING (auth.role() = 'service_role');

-- Transcripts: Users can view their own org's transcripts
CREATE POLICY "Users can view own org transcripts"
  ON public.meta_ad_transcripts FOR SELECT
  USING (organization_id = public.get_user_organization_id());

-- Transcripts: Service role can manage all
CREATE POLICY "Service role can manage transcripts"
  ON public.meta_ad_transcripts FOR ALL
  USING (auth.role() = 'service_role');


-- =============================================================================
-- 4. HELPER FUNCTIONS
-- =============================================================================

-- Function to get transcription status summary for an org
CREATE OR REPLACE FUNCTION public.get_transcription_stats(p_organization_id UUID)
RETURNS TABLE (
  total_videos BIGINT,
  pending BIGINT,
  url_fetched BIGINT,
  downloaded BIGINT,
  transcribed BIGINT,
  errors BIGINT,
  transcription_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_videos,
    COUNT(*) FILTER (WHERE status = 'PENDING')::BIGINT as pending,
    COUNT(*) FILTER (WHERE status = 'URL_FETCHED')::BIGINT as url_fetched,
    COUNT(*) FILTER (WHERE status = 'DOWNLOADED')::BIGINT as downloaded,
    COUNT(*) FILTER (WHERE status = 'TRANSCRIBED')::BIGINT as transcribed,
    COUNT(*) FILTER (WHERE status IN ('ERROR', 'URL_INACCESSIBLE', 'TRANSCRIPT_FAILED'))::BIGINT as errors,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE status = 'TRANSCRIBED') / NULLIF(COUNT(*), 0),
      2
    ) as transcription_rate
  FROM public.meta_ad_videos
  WHERE organization_id = p_organization_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================================
-- 5. COMMENTS
-- =============================================================================

COMMENT ON TABLE public.meta_ad_videos IS
  'Tracks video asset resolution and fetch status from Meta Ads API';

COMMENT ON TABLE public.meta_ad_transcripts IS
  'Stores transcribed text and AI-analyzed features for video ad creatives';

COMMENT ON COLUMN public.meta_ad_videos.resolution_method IS
  'How the video_id was resolved from the Meta API response';

COMMENT ON COLUMN public.meta_ad_videos.status IS
  'Current status in the transcription pipeline';

COMMENT ON COLUMN public.meta_ad_transcripts.hook_text IS
  'First ~3 seconds of spoken content - critical for ad performance';

COMMENT ON COLUMN public.meta_ad_transcripts.transcript_segments IS
  'Word-level timing data from Whisper API for detailed analysis';
