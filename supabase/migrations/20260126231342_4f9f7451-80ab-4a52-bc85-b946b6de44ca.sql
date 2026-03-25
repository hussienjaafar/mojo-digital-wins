-- Add specific issue extraction columns to meta_ad_transcripts
ALTER TABLE meta_ad_transcripts ADD COLUMN IF NOT EXISTS issue_primary TEXT;
ALTER TABLE meta_ad_transcripts ADD COLUMN IF NOT EXISTS issue_tags TEXT[] DEFAULT '{}';
ALTER TABLE meta_ad_transcripts ADD COLUMN IF NOT EXISTS political_stances TEXT[] DEFAULT '{}';
ALTER TABLE meta_ad_transcripts ADD COLUMN IF NOT EXISTS targets_attacked TEXT[] DEFAULT '{}';
ALTER TABLE meta_ad_transcripts ADD COLUMN IF NOT EXISTS targets_supported TEXT[] DEFAULT '{}';
ALTER TABLE meta_ad_transcripts ADD COLUMN IF NOT EXISTS policy_positions TEXT[] DEFAULT '{}';
ALTER TABLE meta_ad_transcripts ADD COLUMN IF NOT EXISTS donor_pain_points TEXT[] DEFAULT '{}';
ALTER TABLE meta_ad_transcripts ADD COLUMN IF NOT EXISTS values_appealed TEXT[] DEFAULT '{}';
ALTER TABLE meta_ad_transcripts ADD COLUMN IF NOT EXISTS urgency_drivers TEXT[] DEFAULT '{}';

-- Add same columns to meta_creative_insights
ALTER TABLE meta_creative_insights ADD COLUMN IF NOT EXISTS issue_primary TEXT;
ALTER TABLE meta_creative_insights ADD COLUMN IF NOT EXISTS issue_tags TEXT[] DEFAULT '{}';
ALTER TABLE meta_creative_insights ADD COLUMN IF NOT EXISTS political_stances TEXT[] DEFAULT '{}';
ALTER TABLE meta_creative_insights ADD COLUMN IF NOT EXISTS targets_attacked TEXT[] DEFAULT '{}';
ALTER TABLE meta_creative_insights ADD COLUMN IF NOT EXISTS targets_supported TEXT[] DEFAULT '{}';
ALTER TABLE meta_creative_insights ADD COLUMN IF NOT EXISTS policy_positions TEXT[] DEFAULT '{}';