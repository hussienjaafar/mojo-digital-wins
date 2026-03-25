-- Ad Copy Studio Schema Migration
-- Adds support for video uploads, copy generation, and organization Meta settings

-- =============================================================================
-- 1. EXTEND META_AD_VIDEOS TABLE FOR UPLOADED VIDEOS
-- =============================================================================

-- Source tracking for uploaded vs synced videos
ALTER TABLE meta_ad_videos ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'meta_synced'
  CHECK (source IN ('uploaded', 'meta_synced', 'gdrive'));

-- Fingerprint fields for deduplication and matching
ALTER TABLE meta_ad_videos ADD COLUMN IF NOT EXISTS fingerprint_duration_sec INTEGER;
ALTER TABLE meta_ad_videos ADD COLUMN IF NOT EXISTS fingerprint_transcript_hash TEXT;
ALTER TABLE meta_ad_videos ADD COLUMN IF NOT EXISTS matched_meta_ad_id TEXT;

-- Upload tracking
ALTER TABLE meta_ad_videos ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES auth.users(id);
ALTER TABLE meta_ad_videos ADD COLUMN IF NOT EXISTS original_filename TEXT;

-- V2-READY: Video technical metadata for Meta API validation
ALTER TABLE meta_ad_videos ADD COLUMN IF NOT EXISTS video_aspect_ratio TEXT;
ALTER TABLE meta_ad_videos ADD COLUMN IF NOT EXISTS video_resolution TEXT;
ALTER TABLE meta_ad_videos ADD COLUMN IF NOT EXISTS video_codec TEXT;
ALTER TABLE meta_ad_videos ADD COLUMN IF NOT EXISTS video_file_size_bytes BIGINT;
ALTER TABLE meta_ad_videos ADD COLUMN IF NOT EXISTS video_frame_rate NUMERIC(5,2);
ALTER TABLE meta_ad_videos ADD COLUMN IF NOT EXISTS video_bitrate_kbps INTEGER;
ALTER TABLE meta_ad_videos ADD COLUMN IF NOT EXISTS thumbnail_timestamp_sec NUMERIC(5,2);
ALTER TABLE meta_ad_videos ADD COLUMN IF NOT EXISTS meets_meta_specs BOOLEAN DEFAULT false;
ALTER TABLE meta_ad_videos ADD COLUMN IF NOT EXISTS meta_spec_issues JSONB;

-- Indexes for fingerprint matching
CREATE INDEX IF NOT EXISTS idx_meta_ad_videos_source
  ON meta_ad_videos(organization_id, source);
CREATE INDEX IF NOT EXISTS idx_meta_ad_videos_fingerprint
  ON meta_ad_videos(organization_id, fingerprint_duration_sec)
  WHERE source = 'uploaded' AND matched_meta_ad_id IS NULL;

-- RLS policies for user-uploaded videos
CREATE POLICY IF NOT EXISTS "Users can upload videos to own org"
  ON meta_ad_videos FOR INSERT
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND source IN ('uploaded', 'gdrive')
  );

CREATE POLICY IF NOT EXISTS "Users can update own org videos"
  ON meta_ad_videos FOR UPDATE
  USING (organization_id = public.get_user_organization_id());

-- =============================================================================
-- 2. ORGANIZATION META SETTINGS (for v2 API integration)
-- =============================================================================

CREATE TABLE IF NOT EXISTS organization_meta_settings (
  organization_id UUID PRIMARY KEY REFERENCES client_organizations(id) ON DELETE CASCADE,
  meta_page_id TEXT,
  meta_page_name TEXT,
  meta_instagram_actor_id TEXT,
  meta_instagram_username TEXT,
  default_objective TEXT DEFAULT 'OUTCOME_SALES',
  default_optimization_goal TEXT DEFAULT 'OFFSITE_CONVERSIONS',
  default_billing_event TEXT DEFAULT 'IMPRESSIONS',
  advantage_plus_creative BOOLEAN DEFAULT true,
  advantage_audience BOOLEAN DEFAULT true,
  meta_pixel_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE organization_meta_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org meta settings"
  ON organization_meta_settings FOR SELECT
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Service role can manage all meta settings"
  ON organization_meta_settings FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- 3. AD COPY GENERATIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS ad_copy_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES client_organizations(id) ON DELETE CASCADE,
  video_ref UUID REFERENCES meta_ad_videos(id) ON DELETE SET NULL,
  transcript_ref UUID REFERENCES meta_ad_transcripts(id) ON DELETE SET NULL,
  batch_id UUID,
  batch_sequence INTEGER,
  actblue_form_name TEXT NOT NULL,
  refcode TEXT NOT NULL,
  refcode_auto_generated BOOLEAN DEFAULT true,
  amount_preset INTEGER,
  recurring_default BOOLEAN DEFAULT false,
  audience_segments JSONB NOT NULL DEFAULT '[]',
  generated_copy JSONB,
  meta_ready_copy JSONB,
  tracking_url TEXT,
  copy_validation_status TEXT CHECK (copy_validation_status IN (
    'all_valid', 'some_truncated', 'needs_review'
  )),
  generation_model TEXT,
  generation_prompt_version TEXT,
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_copy_generations_org
  ON ad_copy_generations(organization_id);
CREATE INDEX IF NOT EXISTS idx_ad_copy_generations_video
  ON ad_copy_generations(video_ref);
CREATE INDEX IF NOT EXISTS idx_ad_copy_generations_batch
  ON ad_copy_generations(batch_id);

ALTER TABLE ad_copy_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org copy generations"
  ON ad_copy_generations FOR SELECT
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can insert own org copy generations"
  ON ad_copy_generations FOR INSERT
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can update own org copy generations"
  ON ad_copy_generations FOR UPDATE
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Service role can manage all copy generations"
  ON ad_copy_generations FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- 4. AD COPY STUDIO SESSION STATE (wizard persistence)
-- =============================================================================

CREATE TABLE IF NOT EXISTS ad_copy_studio_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES client_organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_step INTEGER NOT NULL DEFAULT 1 CHECK (current_step BETWEEN 1 AND 5),
  batch_id UUID NOT NULL DEFAULT gen_random_uuid(),
  video_ids UUID[] DEFAULT '{}',
  transcript_ids UUID[] DEFAULT '{}',
  step_data JSONB DEFAULT '{}',
  completed_steps INTEGER[] DEFAULT '{}',
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Only allow one active session per user per org (but unlimited completed/abandoned)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_copy_studio_sessions_one_active
  ON ad_copy_studio_sessions(organization_id, user_id)
  WHERE status = 'in_progress';

ALTER TABLE ad_copy_studio_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sessions"
  ON ad_copy_studio_sessions FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all sessions"
  ON ad_copy_studio_sessions FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- 5. COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON COLUMN meta_ad_videos.source IS
  'Origin of the video: uploaded (direct upload), meta_synced (from Meta API), gdrive (Google Drive import)';

COMMENT ON COLUMN meta_ad_videos.fingerprint_duration_sec IS
  'Video duration in seconds, used for matching uploaded videos to existing Meta ads';

COMMENT ON COLUMN meta_ad_videos.fingerprint_transcript_hash IS
  'Hash of transcript text for matching similar videos';

COMMENT ON COLUMN meta_ad_videos.matched_meta_ad_id IS
  'If uploaded video matches an existing Meta ad, this stores the matched ad_id';

COMMENT ON COLUMN meta_ad_videos.meets_meta_specs IS
  'Whether video meets Meta Ads API specifications (resolution, duration, etc)';

COMMENT ON COLUMN meta_ad_videos.meta_spec_issues IS
  'JSON array of spec violations, e.g., [{"field": "resolution", "issue": "below minimum", "recommendation": "use 1080x1080"}]';

COMMENT ON TABLE organization_meta_settings IS
  'Per-organization settings for Meta API integration including page IDs, default campaign settings, and Advantage+ options';

COMMENT ON TABLE ad_copy_generations IS
  'Stores generated ad copy variations with ActBlue tracking configuration and Meta-ready formatted copy';

COMMENT ON COLUMN ad_copy_generations.generated_copy IS
  'Raw generated copy from GPT-4 organized by audience segment';

COMMENT ON COLUMN ad_copy_generations.meta_ready_copy IS
  'Formatted copy ready for Meta Ads API with character counts and validation';

COMMENT ON TABLE ad_copy_studio_sessions IS
  'Persists wizard state for the 5-step Ad Copy Studio workflow';

COMMENT ON COLUMN ad_copy_studio_sessions.step_data IS
  'JSON object containing data accumulated during the wizard: videos, analyses, config, generated_copy';
