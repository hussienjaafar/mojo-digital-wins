-- Sprint 4: retention/LTV scaffolding

CREATE TABLE IF NOT EXISTS public.donor_ltv_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  donor_email_hash text, -- hashed email for non-PII
  donor_phone_hash text, -- optional phone hash for SMS linkage
  predicted_ltv_90 numeric,
  predicted_ltv_180 numeric,
  repeat_prob_90 numeric,
  repeat_prob_180 numeric,
  churn_risk numeric,
  model_version text,
  computed_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dlp_org_hash ON public.donor_ltv_predictions(organization_id, donor_email_hash);
CREATE INDEX IF NOT EXISTS idx_dlp_phone_hash ON public.donor_ltv_predictions(organization_id, donor_phone_hash);

ALTER TABLE public.donor_ltv_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY dlp_select ON public.donor_ltv_predictions
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_organization(organization_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY dlp_admin_write ON public.donor_ltv_predictions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY dlp_service_role ON public.donor_ltv_predictions
  FOR ALL
  USING (auth.uid() IS NULL AND current_setting('role') = 'service_role');

COMMENT ON TABLE public.donor_ltv_predictions IS 'Non-PII LTV/retention predictions per donor hash (email/phone).';
