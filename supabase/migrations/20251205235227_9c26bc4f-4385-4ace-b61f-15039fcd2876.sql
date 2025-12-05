-- Phase 1: Add missing ActBlue fields that can provide insights
ALTER TABLE public.actblue_transactions 
ADD COLUMN IF NOT EXISTS fee numeric,
ADD COLUMN IF NOT EXISTS card_type text,
ADD COLUMN IF NOT EXISTS recurring_upsell_shown boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS recurring_upsell_succeeded boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS smart_boost_amount numeric,
ADD COLUMN IF NOT EXISTS double_down boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS payment_method text;

-- Add index for A/B test analysis
CREATE INDEX IF NOT EXISTS idx_actblue_ab_test ON public.actblue_transactions(organization_id, ab_test_name) 
WHERE ab_test_name IS NOT NULL;

-- Add index for mobile vs desktop analysis
CREATE INDEX IF NOT EXISTS idx_actblue_mobile ON public.actblue_transactions(organization_id, is_mobile);

-- Add index for express lane analysis
CREATE INDEX IF NOT EXISTS idx_actblue_express ON public.actblue_transactions(organization_id, is_express);

COMMENT ON COLUMN public.actblue_transactions.fee IS 'ActBlue processing fee for the transaction';
COMMENT ON COLUMN public.actblue_transactions.card_type IS 'Card type used (Visa, Mastercard, etc)';
COMMENT ON COLUMN public.actblue_transactions.recurring_upsell_shown IS 'Whether recurring upsell was shown to donor';
COMMENT ON COLUMN public.actblue_transactions.recurring_upsell_succeeded IS 'Whether donor accepted recurring upsell';
COMMENT ON COLUMN public.actblue_transactions.smart_boost_amount IS 'Smart boost amount if applied';
COMMENT ON COLUMN public.actblue_transactions.double_down IS 'Whether donor doubled their donation';
COMMENT ON COLUMN public.actblue_transactions.payment_method IS 'Payment method (card, paypal, etc)';