-- Add extracted_refcode and destination_url columns to sms_campaigns
ALTER TABLE sms_campaigns 
ADD COLUMN IF NOT EXISTS extracted_refcode TEXT,
ADD COLUMN IF NOT EXISTS destination_url TEXT;

-- Create index for efficient refcode lookups
CREATE INDEX IF NOT EXISTS idx_sms_campaigns_refcode 
ON sms_campaigns(organization_id, extracted_refcode) 
WHERE extracted_refcode IS NOT NULL;

-- Add phone_hash column to actblue_transactions for identity matching
ALTER TABLE actblue_transactions
ADD COLUMN IF NOT EXISTS phone_hash TEXT;

-- Create index for phone hash lookups
CREATE INDEX IF NOT EXISTS idx_actblue_phone_hash 
ON actblue_transactions(organization_id, phone_hash) 
WHERE phone_hash IS NOT NULL;

-- Add campaign_id to refcode_mappings for direct SMS campaign linkage
ALTER TABLE refcode_mappings
ADD COLUMN IF NOT EXISTS sms_campaign_id TEXT;

-- Create index for SMS campaign lookups in refcode_mappings
CREATE INDEX IF NOT EXISTS idx_refcode_mappings_sms_campaign 
ON refcode_mappings(organization_id, sms_campaign_id) 
WHERE sms_campaign_id IS NOT NULL;