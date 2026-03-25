-- Add actblue_refcode column if not exists
ALTER TABLE sms_campaigns 
ADD COLUMN IF NOT EXISTS actblue_refcode text;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_sms_campaigns_actblue_refcode 
ON sms_campaigns(organization_id, actblue_refcode) 
WHERE actblue_refcode IS NOT NULL;