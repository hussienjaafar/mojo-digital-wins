
-- EveryAction Transactions table
CREATE TABLE public.everyaction_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  transaction_id TEXT NOT NULL,
  van_id TEXT,
  donor_email TEXT,
  donor_name TEXT,
  first_name TEXT,
  last_name TEXT,
  amount NUMERIC NOT NULL,
  transaction_date TIMESTAMPTZ NOT NULL,
  transaction_type TEXT DEFAULT 'donation',
  is_recurring BOOLEAN DEFAULT false,
  refcode TEXT,
  source_code TEXT,
  designation TEXT,
  contribution_form TEXT,
  addr1 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT,
  phone TEXT,
  employer TEXT,
  occupation TEXT,
  payment_method TEXT,
  recurring_period TEXT,
  custom_fields JSONB DEFAULT '[]'::jsonb,
  phone_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT everyaction_transactions_unique_tx UNIQUE (organization_id, transaction_id)
);

-- Indexes
CREATE INDEX idx_everyaction_tx_org ON public.everyaction_transactions(organization_id);
CREATE INDEX idx_everyaction_tx_date ON public.everyaction_transactions(transaction_date);
CREATE INDEX idx_everyaction_tx_donor ON public.everyaction_transactions(donor_email);
CREATE INDEX idx_everyaction_tx_van ON public.everyaction_transactions(van_id);
CREATE INDEX idx_everyaction_tx_refcode ON public.everyaction_transactions(refcode);

-- RLS
ALTER TABLE public.everyaction_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org everyaction transactions"
  ON public.everyaction_transactions FOR SELECT
  USING (public.user_belongs_to_organization(organization_id));

CREATE POLICY "Admins can insert everyaction transactions"
  ON public.everyaction_transactions FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.user_belongs_to_organization(organization_id)
  );

CREATE POLICY "Admins can update everyaction transactions"
  ON public.everyaction_transactions FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.user_belongs_to_organization(organization_id)
  );

CREATE POLICY "Only system admins can delete everyaction transactions"
  ON public.everyaction_transactions FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- EveryAction Sync State table
CREATE TABLE public.everyaction_sync_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE UNIQUE,
  last_sync_cursor TIMESTAMPTZ,
  last_export_job_id BIGINT,
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,
  last_sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.everyaction_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org sync state"
  ON public.everyaction_sync_state FOR SELECT
  USING (public.user_belongs_to_organization(organization_id));

CREATE POLICY "Admins can manage sync state"
  ON public.everyaction_sync_state FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));
