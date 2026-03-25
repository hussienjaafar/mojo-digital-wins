-- Add specific issue extraction columns to meta_ad_transcripts
-- These replace generic topic categories with specific political issues

-- Issue specifics (the main new feature)
ALTER TABLE meta_ad_transcripts ADD COLUMN IF NOT EXISTS issue_primary TEXT;
ALTER TABLE meta_ad_transcripts ADD COLUMN IF NOT EXISTS issue_tags TEXT[] DEFAULT '{}';
ALTER TABLE meta_ad_transcripts ADD COLUMN IF NOT EXISTS political_stances TEXT[] DEFAULT '{}';
ALTER TABLE meta_ad_transcripts ADD COLUMN IF NOT EXISTS targets_attacked TEXT[] DEFAULT '{}';
ALTER TABLE meta_ad_transcripts ADD COLUMN IF NOT EXISTS targets_supported TEXT[] DEFAULT '{}';
ALTER TABLE meta_ad_transcripts ADD COLUMN IF NOT EXISTS policy_positions TEXT[] DEFAULT '{}';

-- Donor psychology fields (from analyze-creative-motivation approach)
ALTER TABLE meta_ad_transcripts ADD COLUMN IF NOT EXISTS donor_pain_points TEXT[] DEFAULT '{}';
ALTER TABLE meta_ad_transcripts ADD COLUMN IF NOT EXISTS values_appealed TEXT[] DEFAULT '{}';
ALTER TABLE meta_ad_transcripts ADD COLUMN IF NOT EXISTS urgency_drivers TEXT[] DEFAULT '{}';

-- Add same columns to meta_creative_insights for consistency
ALTER TABLE meta_creative_insights ADD COLUMN IF NOT EXISTS issue_primary TEXT;
ALTER TABLE meta_creative_insights ADD COLUMN IF NOT EXISTS issue_tags TEXT[] DEFAULT '{}';
ALTER TABLE meta_creative_insights ADD COLUMN IF NOT EXISTS political_stances TEXT[] DEFAULT '{}';
ALTER TABLE meta_creative_insights ADD COLUMN IF NOT EXISTS targets_attacked TEXT[] DEFAULT '{}';
ALTER TABLE meta_creative_insights ADD COLUMN IF NOT EXISTS targets_supported TEXT[] DEFAULT '{}';
ALTER TABLE meta_creative_insights ADD COLUMN IF NOT EXISTS policy_positions TEXT[] DEFAULT '{}';

-- Create indexes for querying by issue
CREATE INDEX IF NOT EXISTS idx_meta_ad_transcripts_issue_primary
  ON meta_ad_transcripts(issue_primary) WHERE issue_primary IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_meta_creative_insights_issue_primary
  ON meta_creative_insights(issue_primary) WHERE issue_primary IS NOT NULL;

-- GIN indexes for array columns (for @> contains queries)
CREATE INDEX IF NOT EXISTS idx_meta_ad_transcripts_political_stances_gin
  ON meta_ad_transcripts USING GIN(political_stances);

CREATE INDEX IF NOT EXISTS idx_meta_ad_transcripts_targets_attacked_gin
  ON meta_ad_transcripts USING GIN(targets_attacked);

CREATE INDEX IF NOT EXISTS idx_meta_creative_insights_political_stances_gin
  ON meta_creative_insights USING GIN(political_stances);

COMMENT ON COLUMN meta_ad_transcripts.issue_primary IS 'Specific issue being discussed, e.g., "anti-Israel military aid", "pro-immigration anti-Laken Riley"';
COMMENT ON COLUMN meta_ad_transcripts.political_stances IS 'Political stances taken in the ad, e.g., ["anti-AIPAC", "pro-ceasefire"]';
COMMENT ON COLUMN meta_ad_transcripts.targets_attacked IS 'People/orgs criticized in the ad, e.g., ["Ritchie Torres", "AIPAC"]';
COMMENT ON COLUMN meta_ad_transcripts.targets_supported IS 'People/orgs praised in the ad, e.g., ["Michael Blake", "progressive movement"]';
COMMENT ON COLUMN meta_ad_transcripts.policy_positions IS 'Specific policies advocated, e.g., ["end military aid to Israel", "Medicare for All"]';
