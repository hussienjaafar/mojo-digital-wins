
-- First check and drop existing views, then recreate properly
DO $$ 
BEGIN
  -- Drop in correct order (dependent first)
  DROP VIEW IF EXISTS public.actblue_daily_rollup CASCADE;
  DROP VIEW IF EXISTS public.actblue_transactions_secure CASCADE;
END $$;

-- Now create the secure view with security_invoker
CREATE VIEW public.actblue_transactions_secure
WITH (security_invoker = on)
AS
SELECT 
  id,
  organization_id,
  transaction_id,
  lineitem_id,
  receipt_id,
  transaction_date,
  amount,
  fee,
  net_amount,
  is_recurring,
  recurring_period,
  recurring_state,
  recurring_duration,
  next_charge_date,
  is_mobile,
  is_express,
  refcode,
  refcode2,
  refcode_custom,
  source_campaign,
  contribution_form,
  committee_name,
  entity_id,
  fec_id,
  payment_method,
  card_type,
  employer,
  occupation,
  city,
  state,
  zip,
  country,
  text_message_option,
  recurring_upsell_shown,
  recurring_upsell_succeeded,
  double_down,
  smart_boost_amount,
  ab_test_name,
  ab_test_variation,
  click_id,
  fbclid,
  order_number,
  transaction_type,
  custom_fields,
  created_at,
  donor_email,
  donor_name,
  first_name,
  last_name,
  addr1,
  phone
FROM public.actblue_transactions
WHERE (
  user_belongs_to_organization(organization_id) 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Create daily rollup view
CREATE VIEW public.actblue_daily_rollup
WITH (security_invoker = on)
AS
SELECT 
  organization_id,
  (transaction_date AT TIME ZONE 'UTC')::date as day,
  COUNT(*) FILTER (WHERE transaction_type IS DISTINCT FROM 'refund') as donation_count,
  COALESCE(SUM(amount) FILTER (WHERE transaction_type IS DISTINCT FROM 'refund'), 0) as gross_donations,
  COALESCE(SUM(fee) FILTER (WHERE transaction_type IS DISTINCT FROM 'refund'), 0) as total_fees,
  COALESCE(SUM(net_amount) FILTER (WHERE transaction_type IS DISTINCT FROM 'refund'), 0) as net_donations,
  COALESCE(SUM(ABS(amount)) FILTER (WHERE transaction_type = 'refund'), 0) as refund_amount,
  COUNT(*) FILTER (WHERE transaction_type = 'refund') as refund_count,
  COALESCE(SUM(net_amount) FILTER (WHERE transaction_type IS DISTINCT FROM 'refund'), 0) 
    - COALESCE(SUM(ABS(amount)) FILTER (WHERE transaction_type = 'refund'), 0) as net_revenue,
  COUNT(DISTINCT 
    CASE WHEN transaction_type IS DISTINCT FROM 'refund' 
    THEN COALESCE(donor_email, first_name || ' ' || last_name) 
    END
  ) as unique_donors,
  COUNT(*) FILTER (WHERE is_recurring = true AND transaction_type IS DISTINCT FROM 'refund') as recurring_count,
  COALESCE(SUM(amount) FILTER (WHERE is_recurring = true AND transaction_type IS DISTINCT FROM 'refund'), 0) as recurring_amount
FROM public.actblue_transactions_secure
GROUP BY organization_id, (transaction_date AT TIME ZONE 'UTC')::date;

-- Grant access
GRANT SELECT ON public.actblue_transactions_secure TO authenticated;
GRANT SELECT ON public.actblue_daily_rollup TO authenticated;

COMMENT ON VIEW public.actblue_transactions_secure IS 'Secure view of ActBlue transactions with RLS-like filtering. Uses security_invoker=on to properly pass auth context.';
COMMENT ON VIEW public.actblue_daily_rollup IS 'Daily aggregated ActBlue metrics. Uses security_invoker=on for proper auth context.';
