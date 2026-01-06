-- Enable RLS on tables that are missing it
ALTER TABLE public.actblue_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_api_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_ad_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attribution_touchpoints ENABLE ROW LEVEL SECURITY;

-- actblue_transactions policies
-- Users can view their organization's transactions
CREATE POLICY "Users can view own org transactions"
ON public.actblue_transactions FOR SELECT
TO authenticated
USING (public.user_belongs_to_organization(organization_id));

-- Only admins and org admins can insert
CREATE POLICY "Admins can insert transactions"
ON public.actblue_transactions FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_pii_access(organization_id)
);

-- Only admins and org admins can update
CREATE POLICY "Admins can update transactions"
ON public.actblue_transactions FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_pii_access(organization_id)
);

-- Only system admins can delete
CREATE POLICY "System admins can delete transactions"
ON public.actblue_transactions FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- client_api_credentials policies (highly sensitive - org admins only)
CREATE POLICY "Org admins can view own org credentials"
ON public.client_api_credentials FOR SELECT
TO authenticated
USING (public.has_pii_access(organization_id));

CREATE POLICY "Org admins can insert credentials"
ON public.client_api_credentials FOR INSERT
TO authenticated
WITH CHECK (public.has_pii_access(organization_id));

CREATE POLICY "Org admins can update credentials"
ON public.client_api_credentials FOR UPDATE
TO authenticated
USING (public.has_pii_access(organization_id));

CREATE POLICY "Org admins can delete credentials"
ON public.client_api_credentials FOR DELETE
TO authenticated
USING (public.has_pii_access(organization_id));

-- meta_ad_metrics policies
CREATE POLICY "Users can view own org metrics"
ON public.meta_ad_metrics FOR SELECT
TO authenticated
USING (public.user_belongs_to_organization(organization_id));

CREATE POLICY "Admins can insert metrics"
ON public.meta_ad_metrics FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_pii_access(organization_id)
);

CREATE POLICY "Admins can update metrics"
ON public.meta_ad_metrics FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_pii_access(organization_id)
);

CREATE POLICY "System admins can delete metrics"
ON public.meta_ad_metrics FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- attribution_touchpoints policies
CREATE POLICY "Users can view own org touchpoints"
ON public.attribution_touchpoints FOR SELECT
TO authenticated
USING (public.user_belongs_to_organization(organization_id));

CREATE POLICY "Admins can insert touchpoints"
ON public.attribution_touchpoints FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_pii_access(organization_id)
);

CREATE POLICY "Admins can update touchpoints"
ON public.attribution_touchpoints FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_pii_access(organization_id)
);

CREATE POLICY "System admins can delete touchpoints"
ON public.attribution_touchpoints FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow service role full access (for edge functions/automation)
-- Service role bypasses RLS by default, but explicit policies ensure clarity