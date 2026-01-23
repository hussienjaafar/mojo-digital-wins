-- Fix the unique constraint to match the code's ON CONFLICT specification
-- Drop the single-column unique constraint if it exists
ALTER TABLE actblue_transactions 
  DROP CONSTRAINT IF EXISTS actblue_transactions_transaction_id_key;

-- Create composite unique constraint for multi-tenant support
ALTER TABLE actblue_transactions 
  ADD CONSTRAINT actblue_transactions_org_txn_unique 
  UNIQUE (organization_id, transaction_id);