-- Create RPC function to get sparkline data for dashboard
-- Returns daily ROI, daily new MRR, and new/returning donor counts

CREATE OR REPLACE FUNCTION public.get_dashboard_sparkline_data(
  p_organization_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result JSON;
BEGIN
  WITH 
  -- First donation date for each donor (org-scoped)
  first_donations AS (
    SELECT 
      donor_email,
      MIN(DATE(transaction_date)) as first_donation_date
    FROM actblue_transactions
    WHERE organization_id = p_organization_id
      AND transaction_type = 'donation'
      AND donor_email IS NOT NULL
    GROUP BY donor_email
  ),
  
  -- Daily donor breakdown
  daily_donors AS (
    SELECT 
      DATE(t.transaction_date) as day,
      COUNT(DISTINCT CASE 
        WHEN fd.first_donation_date = DATE(t.transaction_date) 
        THEN t.donor_email 
      END) as new_donors,
      COUNT(DISTINCT CASE 
        WHEN fd.first_donation_date < DATE(t.transaction_date) 
        THEN t.donor_email 
      END) as returning_donors
    FROM actblue_transactions t
    LEFT JOIN first_donations fd ON t.donor_email = fd.donor_email
    WHERE t.organization_id = p_organization_id
      AND DATE(t.transaction_date) BETWEEN p_start_date AND p_end_date
      AND t.transaction_type = 'donation'
      AND t.donor_email IS NOT NULL
    GROUP BY DATE(t.transaction_date)
  ),
  
  -- First recurring transaction per donor (to calculate new MRR)
  first_recurring AS (
    SELECT DISTINCT ON (donor_email)
      donor_email,
      DATE(transaction_date) as first_recurring_date,
      amount as first_amount
    FROM actblue_transactions
    WHERE organization_id = p_organization_id
      AND is_recurring = true
      AND transaction_type = 'donation'
      AND donor_email IS NOT NULL
    ORDER BY donor_email, transaction_date ASC
  ),
  
  -- Daily new MRR (from new recurring starters within date range)
  daily_new_mrr AS (
    SELECT 
      first_recurring_date as day,
      COALESCE(SUM(first_amount), 0) as new_mrr_added,
      COUNT(*) as new_recurring_donors
    FROM first_recurring
    WHERE first_recurring_date BETWEEN p_start_date AND p_end_date
    GROUP BY first_recurring_date
  ),
  
  -- Daily attributed revenue by channel (using refcode_mappings priority)
  daily_attributed AS (
    SELECT 
      DATE(t.transaction_date) as day,
      SUM(CASE 
        WHEN rm.platform = 'meta' 
          OR (t.refcode2 IS NOT NULL AND t.refcode2 != '')
          OR t.refcode ILIKE '%fb%' OR t.refcode ILIKE '%meta%'
          OR (t.contribution_form IS NOT NULL AND LOWER(t.contribution_form) LIKE '%meta%')
        THEN COALESCE(t.net_amount, t.amount) ELSE 0 
      END) as meta_attributed_revenue,
      SUM(CASE 
        WHEN rm.platform = 'sms' 
          OR t.refcode ILIKE '%sms%' 
          OR (t.contribution_form IS NOT NULL AND LOWER(t.contribution_form) LIKE '%sms%')
        THEN COALESCE(t.net_amount, t.amount) ELSE 0 
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
  
  -- Daily Meta spend
  daily_meta_spend AS (
    SELECT date as day, SUM(spend) as meta_spend
    FROM meta_ad_metrics
    WHERE organization_id = p_organization_id
      AND date BETWEEN p_start_date AND p_end_date
    GROUP BY date
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
  
  -- Combine all dates and calculate daily ROI
  all_dates AS (
    SELECT DISTINCT day FROM (
      SELECT day FROM daily_attributed
      UNION SELECT day FROM daily_meta_spend
      UNION SELECT day FROM daily_sms_spend
    ) combined WHERE day IS NOT NULL
  ),
  daily_roi AS (
    SELECT 
      ad.day,
      COALESCE(da.meta_attributed_revenue, 0) + COALESCE(da.sms_attributed_revenue, 0) as attributed_revenue,
      COALESCE(dms.meta_spend, 0) + COALESCE(dss.sms_spend, 0) as total_spend,
      CASE 
        WHEN COALESCE(dms.meta_spend, 0) + COALESCE(dss.sms_spend, 0) > 0 
        THEN (COALESCE(da.meta_attributed_revenue, 0) + COALESCE(da.sms_attributed_revenue, 0)) / 
             (COALESCE(dms.meta_spend, 0) + COALESCE(dss.sms_spend, 0))
        ELSE 0 
      END as roi
    FROM all_dates ad
    LEFT JOIN daily_attributed da ON ad.day = da.day
    LEFT JOIN daily_meta_spend dms ON ad.day = dms.day
    LEFT JOIN daily_sms_spend dss ON ad.day = dss.day
  ),
  
  -- Aggregate totals for new/returning
  donor_totals AS (
    SELECT 
      COALESCE(SUM(new_donors), 0) as total_new_donors,
      COALESCE(SUM(returning_donors), 0) as total_returning_donors
    FROM daily_donors
  )
  
  SELECT json_build_object(
    'dailyRoi', (
      SELECT COALESCE(json_agg(
        json_build_object('date', day::text, 'value', ROUND(roi::numeric, 2))
        ORDER BY day
      ), '[]'::json)
      FROM daily_roi WHERE day IS NOT NULL AND total_spend > 0
    ),
    'dailyNewMrr', (
      SELECT COALESCE(json_agg(
        json_build_object('date', day::text, 'value', new_mrr_added)
        ORDER BY day
      ), '[]'::json)
      FROM daily_new_mrr WHERE day IS NOT NULL
    ),
    'newDonors', (SELECT total_new_donors FROM donor_totals),
    'returningDonors', (SELECT total_returning_donors FROM donor_totals)
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_dashboard_sparkline_data(UUID, DATE, DATE) TO authenticated;