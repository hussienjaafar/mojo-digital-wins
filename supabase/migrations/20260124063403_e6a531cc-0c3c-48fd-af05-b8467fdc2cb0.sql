-- Add actblue_form column to store resolved form names separately from refcodes
ALTER TABLE sms_campaigns ADD COLUMN IF NOT EXISTS actblue_form TEXT;

-- Add index for form-based lookups
CREATE INDEX IF NOT EXISTS idx_sms_campaigns_actblue_form ON sms_campaigns(actblue_form) WHERE actblue_form IS NOT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN sms_campaigns.actblue_form IS 'ActBlue form name extracted from resolved URL (e.g., "ahamawytext", "sms_donate"). Used for fallback attribution when refcode is not available.';