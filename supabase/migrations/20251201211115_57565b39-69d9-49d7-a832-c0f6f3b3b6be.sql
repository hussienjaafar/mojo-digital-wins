-- Add RLS policies for admin access to client data tables

-- Admin can view all ActBlue transactions
CREATE POLICY "Admins can view all actblue transactions"
ON public.actblue_transactions
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can view all daily metrics
CREATE POLICY "Admins can view all daily metrics"
ON public.daily_aggregated_metrics
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can view all client users
CREATE POLICY "Admins can view all client users"
ON public.client_users
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can view all campaign attribution  
CREATE POLICY "Admins can view all campaign attribution"
ON public.campaign_attribution
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can view all API credentials
CREATE POLICY "Admins can view all api credentials"
ON public.client_api_credentials
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));