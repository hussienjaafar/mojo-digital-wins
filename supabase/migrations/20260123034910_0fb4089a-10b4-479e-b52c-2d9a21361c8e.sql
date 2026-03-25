-- ========================================
-- Video Transcription Tables + Motivation Analysis
-- ========================================

-- Video sync tracking table for Meta ad videos
CREATE TABLE IF NOT EXISTS meta_ad_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES client_organizations(id) ON DELETE CASCADE,
  ad_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  video_source_url TEXT,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'downloading', 'transcribing', 'completed', 'error')),
  error_code TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  last_error_at TIMESTAMPTZ,
  downloaded_at TIMESTAMPTZ,
  transcribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, ad_id, video_id)
);

-- Transcript storage with deep motivation analysis
CREATE TABLE IF NOT EXISTS meta_ad_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES client_organizations(id) ON DELETE CASCADE,
  ad_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  transcript_text TEXT NOT NULL,
  duration_seconds NUMERIC(10,2),
  language TEXT,
  -- Deep donor motivation analysis
  donor_pain_points TEXT[] DEFAULT '{}',
  values_appealed TEXT[] DEFAULT '{}',
  issue_specifics TEXT[] DEFAULT '{}',
  emotional_triggers TEXT[] DEFAULT '{}',
  urgency_drivers TEXT[] DEFAULT '{}',
  -- Topic and tone analysis
  topic_primary TEXT,
  topic_tags TEXT[] DEFAULT '{}',
  tone_primary TEXT,
  key_phrases TEXT[] DEFAULT '{}',
  cta_text TEXT,
  transcribed_at TIMESTAMPTZ DEFAULT now(),
  analyzed_at TIMESTAMPTZ,
  UNIQUE(organization_id, ad_id, video_id)
);

-- Add motivation fields to meta_creative_insights
ALTER TABLE meta_creative_insights 
  ADD COLUMN IF NOT EXISTS donor_pain_points TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS values_appealed TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS issue_specifics TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS emotional_triggers TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS urgency_drivers TEXT[] DEFAULT '{}';

-- Add motivation fields to sms_campaigns
ALTER TABLE sms_campaigns 
  ADD COLUMN IF NOT EXISTS donor_pain_points TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS values_appealed TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS issue_specifics TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS emotional_triggers TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS urgency_drivers TEXT[] DEFAULT '{}';

-- Add motivation fields to sms_creative_insights
ALTER TABLE sms_creative_insights
  ADD COLUMN IF NOT EXISTS donor_pain_points TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS values_appealed TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS issue_specifics TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS emotional_triggers TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS urgency_drivers TEXT[] DEFAULT '{}';

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_meta_ad_videos_org_status ON meta_ad_videos(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_meta_ad_videos_ad_id ON meta_ad_videos(ad_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_transcripts_org ON meta_ad_transcripts(organization_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_transcripts_ad_id ON meta_ad_transcripts(ad_id);

-- RLS for meta_ad_videos
ALTER TABLE meta_ad_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org videos"
ON meta_ad_videos FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM organization_memberships 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

CREATE POLICY "Service role full access to videos"
ON meta_ad_videos FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- RLS for meta_ad_transcripts
ALTER TABLE meta_ad_transcripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org transcripts"
ON meta_ad_transcripts FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM organization_memberships 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

CREATE POLICY "Service role full access to transcripts"
ON meta_ad_transcripts FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- Add updated_at trigger for meta_ad_videos
CREATE TRIGGER update_meta_ad_videos_updated_at
BEFORE UPDATE ON meta_ad_videos
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();