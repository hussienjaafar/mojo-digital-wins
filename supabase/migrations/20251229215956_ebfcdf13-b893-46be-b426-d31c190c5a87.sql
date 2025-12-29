-- Add click_id and fbclid columns to refcode_mappings for click ID tracking
ALTER TABLE public.refcode_mappings
  ADD COLUMN IF NOT EXISTS click_id text,
  ADD COLUMN IF NOT EXISTS fbclid text;

-- Create index for click_id lookups
CREATE INDEX IF NOT EXISTS idx_refcode_mappings_click_id 
ON public.refcode_mappings(click_id) WHERE click_id IS NOT NULL;

-- Create index for fbclid lookups
CREATE INDEX IF NOT EXISTS idx_refcode_mappings_fbclid 
ON public.refcode_mappings(fbclid) WHERE fbclid IS NOT NULL;

-- Create view for click ID reconciliation candidates
-- These are transactions with click_id/fbclid but no refcode (need probabilistic matching)
CREATE OR REPLACE VIEW public.donation_clickid_candidates AS
SELECT 
  t.transaction_id,
  t.organization_id,
  t.click_id,
  t.fbclid,
  t.donor_email,
  t.transaction_date,
  t.amount,
  t.net_amount
FROM public.actblue_transactions t
WHERE (t.click_id IS NOT NULL OR t.fbclid IS NOT NULL)
  AND t.refcode IS NULL
  AND t.transaction_type IS DISTINCT FROM 'refund';

-- Add RLS-aware function for the view
CREATE OR REPLACE FUNCTION public.get_clickid_candidates(_organization_id uuid, _limit integer DEFAULT 200)
RETURNS TABLE(
  transaction_id text,
  organization_id uuid,
  click_id text,
  fbclid text,
  donor_email text,
  transaction_date date,
  amount numeric,
  net_amount numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verify user has access to this organization
  IF NOT (
    public.user_belongs_to_organization(_organization_id) OR
    public.has_role(auth.uid(), 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied to organization data';
  END IF;

  RETURN QUERY
  SELECT 
    t.transaction_id,
    t.organization_id,
    t.click_id,
    t.fbclid,
    t.donor_email,
    t.transaction_date,
    t.amount,
    t.net_amount
  FROM public.actblue_transactions t
  WHERE t.organization_id = _organization_id
    AND (t.click_id IS NOT NULL OR t.fbclid IS NOT NULL)
    AND t.refcode IS NULL
    AND t.transaction_type IS DISTINCT FROM 'refund'
  LIMIT _limit;
END;
$$;