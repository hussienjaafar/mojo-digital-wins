-- Phase A: Add missing columns to actblue_transactions for Meta attribution tracking
-- These columns are needed by the ActBlue webhook to store Meta click tracking data

ALTER TABLE public.actblue_transactions 
ADD COLUMN IF NOT EXISTS click_id TEXT,
ADD COLUMN IF NOT EXISTS fbclid TEXT;

-- Add index for faster lookups on these attribution columns
CREATE INDEX IF NOT EXISTS idx_actblue_transactions_click_id ON public.actblue_transactions(click_id) WHERE click_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_actblue_transactions_fbclid ON public.actblue_transactions(fbclid) WHERE fbclid IS NOT NULL;

-- Add comment to document the purpose
COMMENT ON COLUMN public.actblue_transactions.click_id IS 'Meta Ads click ID for conversion tracking';
COMMENT ON COLUMN public.actblue_transactions.fbclid IS 'Facebook click ID passed through URL parameters';