
-- 1. Create a view that filters meta_ad_metrics_daily to fundraising campaigns only
CREATE OR REPLACE VIEW public.meta_fundraising_metrics_daily AS
SELECT m.*
FROM public.meta_ad_metrics_daily m
JOIN public.meta_campaigns mc 
  ON m.campaign_id = mc.campaign_id 
  AND m.organization_id = mc.organization_id
WHERE mc.objective IN ('OUTCOME_SALES', 'CONVERSIONS');

-- 2. Update get_dashboard_sparkline_data RPC to filter Meta spend to fundraising only
CREATE OR REPLACE FUNCTION public.get_dashboard_sparkline_data(
  p_organization_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  WITH 
  -- First donation date for each donor (org-scoped)
  first_donations AS (
    SELECT 
      donor_email,
      MIN(transaction_date) as first_donation_date
    FROM actblue_transactions
    WHERE organization_id = p_organization_id
      AND transaction_type = 'donation'
    GROUP BY donor_email
  ),
  
  -- Daily donor breakdown
  daily_donors AS (
    SELECT 
      DATE(t.transaction_date) as day,
      COUNT(DISTINCT CASE 
        WHEN DATE(fd.first_donation_date) = DATE(t.transaction_date) 
        THEN t.donor_email 
      END) as new_donors,
      COUNT(DISTINCT CASE 
        WHEN DATE(fd.first_donation_date) < DATE(t.transaction_date) 
        THEN t.donor_email 
      END) as returning_donors
    FROM actblue_transactions t
    LEFT JOIN first_donations fd ON t.donor_email = fd.donor_email
    WHERE t.organization_id = p_organization_id
      AND DATE(t.transaction_date) BETWEEN p_start_date AND p_end_date
      AND t.transaction_type = 'donation'
    GROUP BY DATE(t.transaction_date)
  ),
  
  -- First recurring transaction per donor
  first_recurring AS (
    SELECT 
      donor_email,
      MIN(transaction_date) as first_recurring_date,
      (SELECT amount FROM actblue_transactions t2 
       WHERE t2.donor_email = actblue_transactions.donor_email 
         AND t2.organization_id = p_organization_id
         AND t2.is_recurring = true
       ORDER BY t2.transaction_date ASC LIMIT 1) as first_amount
    FROM actblue_transactions
    WHERE organization_id = p_organization_id
      AND is_recurring = true
    GROUP BY donor_email
  ),
  
  -- Daily new MRR (from new recurring starters)
  daily_new_mrr AS (
    SELECT 
      DATE(first_recurring_date) as day,
      COALESCE(SUM(first_amount), 0) as new_mrr_added,
      COUNT(*) as new_recurring_donors
    FROM first_recurring
    WHERE first_recurring_date >= p_start_date
      AND first_recurring_date <= p_end_date
    GROUP BY DATE(first_recurring_date)
  ),
  
  -- Daily attributed revenue by channel
  daily_attributed AS (
    SELECT 
      DATE(t.transaction_date) as day,
      SUM(CASE 
        WHEN rm.platform = 'meta' 
          OR (t.refcode2 IS NOT NULL AND t.refcode2 != '') 
        THEN t.net_amount ELSE 0 
      END) as meta_attributed_revenue,
      SUM(CASE 
        WHEN rm.platform = 'sms' 
          OR t.refcode ILIKE '%sms%' 
          OR LOWER(t.contribution_form) LIKE '%sms%'
        THEN t.net_amount ELSE 0 
      END) as sms_attributed_revenue
    FROM actblue_transactions t
    LEFT JOIN refcode_mappings rm 
      ON t.organization_id = rm.organization_id 
      AND t.refcode = rm.refcode
    WHERE t.organization_id = p_organization_id
      AND DATE(t.transaction_date) BETWEEN p_start_date AND p_end_date
      AND t.transaction_type = 'donation'
    GROUP BY DATE(t.transaction_date)
  ),
  
  -- Daily Meta spend - FILTERED to fundraising campaigns only
  daily_meta_spend AS (
    SELECT m.date as day, SUM(m.spend) as meta_spend
    FROM meta_ad_metrics m
    JOIN meta_campaigns mc ON m.campaign_id = mc.campaign_id 
      AND m.organization_id = mc.organization_id
    WHERE m.organization_id = p_organization_id
      AND m.date BETWEEN p_start_date AND p_end_date
      AND mc.objective IN ('OUTCOME_SALES', 'CONVERSIONS')
    GROUP BY m.date
  ),
  
  -- Daily SMS spend
  daily_sms_spend AS (
    SELECT DATE(send_date) as day, SUM(cost) as sms_spend
    FROM sms_campaigns
    WHERE organization_id = p_organization_id
      AND DATE(send_date) BETWEEN p_start_date AND p_end_date
      AND status != 'draft'
    GROUP BY DATE(send_date)
  ),
  
  -- Combine daily ROI
  daily_roi AS (
    SELECT 
      COALESCE(da.day, dms.day, dss.day) as day,
      COALESCE(da.meta_attributed_revenue, 0) + COALESCE(da.sms_attributed_revenue, 0) as attributed_revenue,
      COALESCE(dms.meta_spend, 0) + COALESCE(dss.sms_spend, 0) as total_spend,
      CASE 
        WHEN COALESCE(dms.meta_spend, 0) + COALESCE(dss.sms_spend, 0) > 0 
        THEN (COALESCE(da.meta_attributed_revenue, 0) + COALESCE(da.sms_attributed_revenue, 0)) / 
             (COALESCE(dms.meta_spend, 0) + COALESCE(dss.sms_spend, 0))
        ELSE 0 
      END as roi
    FROM daily_attributed da
    FULL OUTER JOIN daily_meta_spend dms ON da.day = dms.day
    FULL OUTER JOIN daily_sms_spend dss ON COALESCE(da.day, dms.day) = dss.day
  ),
  
  -- Calculate cumulative active MRR as of each date in the range
  date_series AS (
    SELECT generate_series(
      GREATEST(p_start_date, p_end_date - INTERVAL '13 days'),
      p_end_date,
      '1 day'::interval
    )::date as day
  ),
  
  active_mrr_daily AS (
    SELECT 
      ds.day,
      COALESCE(SUM(latest.amount), 0) as active_mrr
    FROM date_series ds
    CROSS JOIN LATERAL (
      SELECT DISTINCT ON (t.donor_email) t.amount
      FROM actblue_transactions t
      WHERE t.organization_id = p_organization_id
        AND t.is_recurring = true
        AND t.recurring_state = 'active'
        AND DATE(t.transaction_date) <= ds.day
      ORDER BY t.donor_email, t.transaction_date DESC
    ) latest
    GROUP BY ds.day
  ),
  
  -- Aggregate totals
  totals AS (
    SELECT
      COALESCE(SUM(dd.new_donors), 0) as total_new_donors,
      COALESCE(SUM(dd.returning_donors), 0) as total_returning_donors
    FROM daily_donors dd
  )
  
  SELECT json_build_object(
    'dailyRoi', COALESCE((
      SELECT json_agg(json_build_object('date', day, 'value', ROUND(roi::numeric, 2)) ORDER BY day)
      FROM daily_roi
    ), '[]'::json),
    'dailyNewMrr', COALESCE((
      SELECT json_agg(json_build_object('date', day, 'value', ROUND(new_mrr_added::numeric, 2)) ORDER BY day)
      FROM daily_new_mrr
    ), '[]'::json),
    'dailyActiveMrr', COALESCE((
      SELECT json_agg(json_build_object('date', day, 'value', ROUND(active_mrr::numeric, 2)) ORDER BY day)
      FROM active_mrr_daily
    ), '[]'::json),
    'newDonors', (SELECT total_new_donors FROM totals),
    'returningDonors', (SELECT total_returning_donors FROM totals)
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;
