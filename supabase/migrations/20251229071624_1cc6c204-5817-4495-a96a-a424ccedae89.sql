-- Add attribution_method column to transaction_attribution
ALTER TABLE public.transaction_attribution
ADD COLUMN IF NOT EXISTS attribution_method TEXT DEFAULT 'organic';

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_transaction_attribution_method 
ON public.transaction_attribution(attribution_method);

-- Add reprocessed_at column to webhook_logs for tracking reprocessed webhooks
ALTER TABLE public.webhook_logs
ADD COLUMN IF NOT EXISTS reprocessed_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS success BOOLEAN DEFAULT NULL;