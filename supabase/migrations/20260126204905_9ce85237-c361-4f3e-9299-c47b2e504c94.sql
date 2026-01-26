-- Update get_dashboard_sparkline_data to include dailyActiveMrr for cumulative MRR sparkline
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
  -- Limited to last 14 days for performance (sparklines only show 7 days)
  date_series AS (
    SELECT generate_series(
      GREATEST(p_start_date, p_end_date - INTERVAL '13 days')::date, 
      p_end_date, 
      '1 day'::interval
    )::date as day
  ),
  
  daily_cumulative_mrr AS (
    SELECT 
      d.day,
      COALESCE((
        SELECT SUM(latest_amount) FROM (
          SELECT DISTINCT ON (donor_email) 
            donor_email, amount as latest_amount
          FROM actblue_transactions t
          WHERE t.organization_id = p_organization_id
            AND t.is_recurring = true
            AND t.transaction_type = 'donation'
            AND DATE(t.transaction_date) <= d.day
          ORDER BY donor_email, transaction_date DESC
        ) active_at_date
      ), 0) as cumulative_mrr
    FROM date_series d
  ),
  
  -- Aggregate totals for new/returning
  donor_totals AS (
    SELECT 
      SUM(new_donors) as total_new_donors,
      SUM(returning_donors) as total_returning_donors
    FROM daily_donors
  )
  
  SELECT json_build_object(
    'dailyRoi', (
      SELECT COALESCE(json_agg(
        json_build_object('date', day::text, 'value', ROUND(roi::numeric, 2))
        ORDER BY day
      ), '[]'::json)
      FROM daily_roi WHERE day IS NOT NULL
    ),
    'dailyNewMrr', (
      SELECT COALESCE(json_agg(
        json_build_object('date', day::text, 'value', new_mrr_added)
        ORDER BY day
      ), '[]'::json)
      FROM daily_new_mrr WHERE day IS NOT NULL
    ),
    'dailyActiveMrr', (
      SELECT COALESCE(json_agg(
        json_build_object('date', day::text, 'value', cumulative_mrr)
        ORDER BY day
      ), '[]'::json)
      FROM daily_cumulative_mrr WHERE cumulative_mrr > 0
    ),
    'newDonors', (SELECT COALESCE(total_new_donors, 0) FROM donor_totals),
    'returningDonors', (SELECT COALESCE(total_returning_donors, 0) FROM donor_totals)
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;