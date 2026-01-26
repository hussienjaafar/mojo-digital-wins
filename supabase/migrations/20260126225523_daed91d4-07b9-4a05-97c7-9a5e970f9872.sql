-- Add all missing columns to meta_ad_transcripts table for edge function compatibility

-- Core columns
ALTER TABLE public.meta_ad_transcripts
ADD COLUMN IF NOT EXISTS video_ref UUID;

ALTER TABLE public.meta_ad_transcripts
ADD COLUMN IF NOT EXISTS transcript_segments JSONB;

-- Transcription metadata
ALTER TABLE public.meta_ad_transcripts
ADD COLUMN IF NOT EXISTS language_confidence NUMERIC;

ALTER TABLE public.meta_ad_transcripts
ADD COLUMN IF NOT EXISTS transcription_model TEXT;

ALTER TABLE public.meta_ad_transcripts
ADD COLUMN IF NOT EXISTS transcription_confidence NUMERIC;

-- Analysis metadata
ALTER TABLE public.meta_ad_transcripts
ADD COLUMN IF NOT EXISTS analysis_version TEXT;

-- Speaking metrics
ALTER TABLE public.meta_ad_transcripts
ADD COLUMN IF NOT EXISTS speaker_count INTEGER;

ALTER TABLE public.meta_ad_transcripts
ADD COLUMN IF NOT EXISTS words_total INTEGER;

ALTER TABLE public.meta_ad_transcripts
ADD COLUMN IF NOT EXISTS words_per_minute NUMERIC;

ALTER TABLE public.meta_ad_transcripts
ADD COLUMN IF NOT EXISTS silence_percentage NUMERIC;

-- Hook analysis
ALTER TABLE public.meta_ad_transcripts
ADD COLUMN IF NOT EXISTS hook_text TEXT;

ALTER TABLE public.meta_ad_transcripts
ADD COLUMN IF NOT EXISTS hook_duration_seconds NUMERIC;

ALTER TABLE public.meta_ad_transcripts
ADD COLUMN IF NOT EXISTS hook_word_count INTEGER;

-- Tone analysis
ALTER TABLE public.meta_ad_transcripts
ADD COLUMN IF NOT EXISTS tone_tags TEXT[];

-- Sentiment
ALTER TABLE public.meta_ad_transcripts
ADD COLUMN IF NOT EXISTS sentiment_score NUMERIC;

ALTER TABLE public.meta_ad_transcripts
ADD COLUMN IF NOT EXISTS sentiment_label TEXT;

-- CTA
ALTER TABLE public.meta_ad_transcripts
ADD COLUMN IF NOT EXISTS cta_type TEXT;

-- Other
ALTER TABLE public.meta_ad_transcripts
ADD COLUMN IF NOT EXISTS urgency_level TEXT;

ALTER TABLE public.meta_ad_transcripts
ADD COLUMN IF NOT EXISTS emotional_appeals TEXT[];

ALTER TABLE public.meta_ad_transcripts
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Add foreign key reference to meta_ad_videos
ALTER TABLE public.meta_ad_transcripts
ADD CONSTRAINT fk_meta_ad_transcripts_video
FOREIGN KEY (video_ref) REFERENCES meta_ad_videos(id) ON DELETE SET NULL;

-- Add unique constraint for upsert on conflict
ALTER TABLE public.meta_ad_transcripts
DROP CONSTRAINT IF EXISTS meta_ad_transcripts_org_ad_video_unique;

ALTER TABLE public.meta_ad_transcripts
ADD CONSTRAINT meta_ad_transcripts_org_ad_video_unique
UNIQUE (organization_id, ad_id, video_id);