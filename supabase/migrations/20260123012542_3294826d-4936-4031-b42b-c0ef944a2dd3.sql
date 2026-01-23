-- Add donor_key column to donor_demographics for joining with LTV predictions
ALTER TABLE donor_demographics 
ADD COLUMN IF NOT EXISTS donor_key text;

-- Create index for join performance
CREATE INDEX IF NOT EXISTS idx_donor_demographics_donor_key 
ON donor_demographics(donor_key);

-- Populate donor_key using a hash of the email (matching the pattern in donor_ltv_predictions)
UPDATE donor_demographics 
SET donor_key = 'donor_' || substr(md5(lower(trim(donor_email))), 1, 6)
WHERE donor_key IS NULL AND donor_email IS NOT NULL;