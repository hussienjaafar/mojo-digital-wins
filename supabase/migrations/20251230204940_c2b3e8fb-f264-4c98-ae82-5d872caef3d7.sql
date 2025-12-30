-- Create donor_first_donation table to fix attribution view
CREATE TABLE IF NOT EXISTS public.donor_first_donation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  donor_key TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  first_donation_at TIMESTAMPTZ NOT NULL,
  first_amount NUMERIC(12,2),
  first_refcode TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(donor_key, organization_id)
);

-- Enable RLS
ALTER TABLE public.donor_first_donation ENABLE ROW LEVEL SECURITY;

-- RLS policies for client users
CREATE POLICY "Client users can view their org donor_first_donation"
ON public.donor_first_donation
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.client_users WHERE id = auth.uid()
  )
);

-- Index for performance
CREATE INDEX idx_donor_first_donation_org ON public.donor_first_donation(organization_id);
CREATE INDEX idx_donor_first_donation_date ON public.donor_first_donation(first_donation_at);

-- Populate from existing actblue_transactions (first donation per donor)
INSERT INTO public.donor_first_donation (donor_key, organization_id, first_donation_at, first_amount, first_refcode)
SELECT 
  COALESCE(donor_email, first_name || '_' || last_name) as donor_key,
  organization_id,
  MIN(transaction_date) as first_donation_at,
  (ARRAY_AGG(amount ORDER BY transaction_date))[1] as first_amount,
  (ARRAY_AGG(refcode ORDER BY transaction_date))[1] as first_refcode
FROM public.actblue_transactions
WHERE donor_email IS NOT NULL OR (first_name IS NOT NULL AND last_name IS NOT NULL)
GROUP BY COALESCE(donor_email, first_name || '_' || last_name), organization_id
ON CONFLICT (donor_key, organization_id) DO UPDATE SET
  first_donation_at = EXCLUDED.first_donation_at,
  first_amount = EXCLUDED.first_amount,
  first_refcode = EXCLUDED.first_refcode,
  updated_at = now();

-- Create trigger to update updated_at
CREATE TRIGGER update_donor_first_donation_updated_at
BEFORE UPDATE ON public.donor_first_donation
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();