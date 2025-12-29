-- Add missing columns to actblue_transactions for webhook compatibility
ALTER TABLE public.actblue_transactions
ADD COLUMN IF NOT EXISTS next_charge_date TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS recurring_state TEXT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.actblue_transactions.next_charge_date IS 'Next charge date for recurring donations';
COMMENT ON COLUMN public.actblue_transactions.recurring_state IS 'State of recurring donation (active, cancelled, etc.)';