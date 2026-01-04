-- Ensure job_type is properly set for opportunity and action jobs
UPDATE scheduled_jobs
SET job_type = 'detect_fundraising_opportunities'
WHERE (job_name ILIKE '%opportunit%' OR endpoint ILIKE '%detect-fundraising%')
AND (job_type IS NULL OR job_type = '');

UPDATE scheduled_jobs
SET job_type = 'generate_suggested_actions'
WHERE (job_name ILIKE '%action%' OR endpoint ILIKE '%generate-suggested%')
AND (job_type IS NULL OR job_type = '');

-- Add trend_window_start column for better deduplication if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'fundraising_opportunities' 
    AND column_name = 'trend_window_start'
  ) THEN
    ALTER TABLE fundraising_opportunities ADD COLUMN trend_window_start timestamptz;
  END IF;
END $$;

-- Create index for faster lookups on the unique constraint columns
CREATE INDEX IF NOT EXISTS idx_fundraising_opportunities_org_entity 
ON fundraising_opportunities(organization_id, entity_name);

CREATE INDEX IF NOT EXISTS idx_suggested_actions_org_alert 
ON suggested_actions(organization_id, alert_id);

-- Add index for faster status filtering on opportunities
CREATE INDEX IF NOT EXISTS idx_fundraising_opportunities_status_active
ON fundraising_opportunities(status, is_active) WHERE is_active = true;

-- Add index for faster pending actions queries
CREATE INDEX IF NOT EXISTS idx_suggested_actions_pending
ON suggested_actions(status, is_used) WHERE is_used = false AND is_dismissed = false;