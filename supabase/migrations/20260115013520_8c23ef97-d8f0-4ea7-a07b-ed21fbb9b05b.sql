-- Add missing receipt_id column to actblue_transactions table
-- This column is used by the sync-actblue-csv edge function for deduplication

ALTER TABLE public.actblue_transactions 
ADD COLUMN IF NOT EXISTS receipt_id TEXT;

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_actblue_transactions_receipt_id 
ON public.actblue_transactions(receipt_id) WHERE receipt_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.actblue_transactions.receipt_id IS 'ActBlue receipt ID from CSV exports, used for deduplication alongside lineitem_id';