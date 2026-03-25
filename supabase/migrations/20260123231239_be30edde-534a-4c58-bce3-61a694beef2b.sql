-- Drop the existing status check constraint
ALTER TABLE public.actblue_backfill_chunks 
DROP CONSTRAINT IF EXISTS actblue_backfill_chunks_status_check;

-- Add new constraint that includes 'cancelled' status
ALTER TABLE public.actblue_backfill_chunks 
ADD CONSTRAINT actblue_backfill_chunks_status_check 
CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retrying', 'cancelled'));