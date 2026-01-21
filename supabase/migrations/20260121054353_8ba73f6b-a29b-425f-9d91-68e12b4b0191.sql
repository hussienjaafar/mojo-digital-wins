-- Add AI analysis columns to sms_campaigns table
ALTER TABLE sms_campaigns ADD COLUMN IF NOT EXISTS topic TEXT;
ALTER TABLE sms_campaigns ADD COLUMN IF NOT EXISTS topic_summary TEXT;
ALTER TABLE sms_campaigns ADD COLUMN IF NOT EXISTS tone TEXT;
ALTER TABLE sms_campaigns ADD COLUMN IF NOT EXISTS urgency_level TEXT;
ALTER TABLE sms_campaigns ADD COLUMN IF NOT EXISTS call_to_action TEXT;
ALTER TABLE sms_campaigns ADD COLUMN IF NOT EXISTS key_themes TEXT[] DEFAULT '{}';
ALTER TABLE sms_campaigns ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMPTZ;

-- Create index for finding unanalyzed campaigns
CREATE INDEX IF NOT EXISTS idx_sms_campaigns_analyzed_at ON sms_campaigns(analyzed_at) WHERE analyzed_at IS NULL;