-- Create improved recurring health function with dual metrics
CREATE OR REPLACE FUNCTION public.get_recurring_health_v2(
  _organization_id UUID,
  _start_date TIMESTAMPTZ,
  _end_date TIMESTAMPTZ
)
RETURNS TABLE (
  -- Current state metrics (point-in-time, not date-range dependent)
  current_active_mrr NUMERIC,
  current_active_donors INTEGER,
  current_paused_donors INTEGER,
  current_cancelled_donors INTEGER,
  current_failed_donors INTEGER,
  current_churned_donors INTEGER,
  
  -- Period metrics (date-range dependent)
  new_recurring_mrr NUMERIC,
  new_recurring_donors INTEGER,
  period_recurring_revenue NUMERIC,
  period_recurring_transactions INTEGER,
  
  -- Derived metrics
  avg_recurring_amount NUMERIC,
  upsell_shown INTEGER,
  upsell_succeeded INTEGER,
  upsell_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH 
  -- Step 1: Get the latest state for each recurring donor
  donor_latest_state AS (
    SELECT DISTINCT ON (donor_email)
      donor_email,
      organization_id,
      recurring_state,
      transaction_date as last_transaction_date,
      amount
    FROM actblue_transactions
    WHERE organization_id = _organization_id
      AND is_recurring = true
    ORDER BY donor_email, transaction_date DESC
  ),
  
  -- Step 2: Classify each donor's current status
  donor_status AS (
    SELECT
      donor_email,
      amount,
      CASE
        WHEN recurring_state = 'active' THEN 'active'
        WHEN recurring_state = 'paused' THEN 'paused'
        WHEN recurring_state = 'cancelled' THEN 'cancelled'
        WHEN recurring_state = 'failed' THEN 'failed'
        WHEN recurring_state IS NULL AND last_transaction_date > NOW() - INTERVAL '35 days' THEN 'active'
        ELSE 'churned'
      END as status
    FROM donor_latest_state
  ),
  
  -- Step 3: Calculate current state metrics
  current_metrics AS (
    SELECT
      COALESCE(SUM(CASE WHEN status = 'active' THEN amount ELSE 0 END), 0) as current_active_mrr,
      COUNT(CASE WHEN status = 'active' THEN 1 END)::INTEGER as current_active_donors,
      COUNT(CASE WHEN status = 'paused' THEN 1 END)::INTEGER as current_paused_donors,
      COUNT(CASE WHEN status = 'cancelled' THEN 1 END)::INTEGER as current_cancelled_donors,
      COUNT(CASE WHEN status = 'failed' THEN 1 END)::INTEGER as current_failed_donors,
      COUNT(CASE WHEN status = 'churned' THEN 1 END)::INTEGER as current_churned_donors,
      COALESCE(AVG(CASE WHEN status = 'active' THEN amount END), 0) as avg_recurring_amount
    FROM donor_status
  ),
  
  -- Step 4: Find new recurring donors (first recurring transaction in period)
  first_recurring AS (
    SELECT 
      donor_email,
      MIN(transaction_date) as first_recurring_date,
      (SELECT amount FROM actblue_transactions t2 
       WHERE t2.donor_email = actblue_transactions.donor_email 
         AND t2.organization_id = _organization_id
         AND t2.is_recurring = true
       ORDER BY t2.transaction_date ASC LIMIT 1) as first_amount
    FROM actblue_transactions
    WHERE organization_id = _organization_id
      AND is_recurring = true
    GROUP BY donor_email
  ),
  
  new_recurring AS (
    SELECT
      COALESCE(SUM(first_amount), 0) as new_recurring_mrr,
      COUNT(*)::INTEGER as new_recurring_donors
    FROM first_recurring
    WHERE first_recurring_date >= _start_date
      AND first_recurring_date <= _end_date
  ),
  
  -- Step 5: Period transactions
  period_metrics AS (
    SELECT
      COALESCE(SUM(amount), 0) as period_recurring_revenue,
      COUNT(*)::INTEGER as period_recurring_transactions
    FROM actblue_transactions
    WHERE organization_id = _organization_id
      AND is_recurring = true
      AND transaction_date >= _start_date
      AND transaction_date <= _end_date
  ),
  
  -- Step 6: Upsell metrics
  upsell_metrics AS (
    SELECT
      COALESCE(SUM(CASE WHEN recurring_upsell_shown THEN 1 ELSE 0 END), 0)::INTEGER as upsell_shown,
      COALESCE(SUM(CASE WHEN recurring_upsell_succeeded THEN 1 ELSE 0 END), 0)::INTEGER as upsell_succeeded
    FROM actblue_transactions
    WHERE organization_id = _organization_id
      AND transaction_date >= _start_date
      AND transaction_date <= _end_date
  )
  
  SELECT
    cm.current_active_mrr,
    cm.current_active_donors,
    cm.current_paused_donors,
    cm.current_cancelled_donors,
    cm.current_failed_donors,
    cm.current_churned_donors,
    nr.new_recurring_mrr,
    nr.new_recurring_donors,
    pm.period_recurring_revenue,
    pm.period_recurring_transactions,
    cm.avg_recurring_amount,
    um.upsell_shown,
    um.upsell_succeeded,
    CASE WHEN um.upsell_shown > 0 
         THEN um.upsell_succeeded::NUMERIC / um.upsell_shown 
         ELSE 0 
    END as upsell_rate
  FROM current_metrics cm
  CROSS JOIN new_recurring nr
  CROSS JOIN period_metrics pm
  CROSS JOIN upsell_metrics um;
END;
$$;