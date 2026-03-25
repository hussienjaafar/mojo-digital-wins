-- Add critical indexes for demographics RPC performance
-- These support COUNT(DISTINCT donor_email) and GROUP BY operations

-- Primary index for donor-level aggregations
CREATE INDEX IF NOT EXISTS idx_actblue_transactions_org_email 
ON actblue_transactions (organization_id, donor_email);

-- Composite index for the main CTE filtering (date range + transaction type + org)
CREATE INDEX IF NOT EXISTS idx_actblue_transactions_org_type_date
ON actblue_transactions (organization_id, transaction_type, transaction_date);

-- Index for state/occupation aggregations
CREATE INDEX IF NOT EXISTS idx_actblue_transactions_org_state
ON actblue_transactions (organization_id, state) WHERE state IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_actblue_transactions_org_occupation
ON actblue_transactions (organization_id, occupation) WHERE occupation IS NOT NULL;

-- Index for refcode aggregations
CREATE INDEX IF NOT EXISTS idx_actblue_transactions_org_refcode
ON actblue_transactions (organization_id, refcode) WHERE refcode IS NOT NULL;