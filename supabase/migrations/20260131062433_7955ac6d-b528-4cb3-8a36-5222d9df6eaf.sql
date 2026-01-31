-- Expand party columns to accommodate longer party names like "DEMOCRATIC-FARMER-LABOR" (23 chars)
ALTER TABLE voter_impact_districts 
  ALTER COLUMN winner_party TYPE VARCHAR(50);

ALTER TABLE voter_impact_districts 
  ALTER COLUMN runner_up_party TYPE VARCHAR(50);