-- Fix get_sms_metrics function with correct column names
DROP FUNCTION IF EXISTS public.get_sms_metrics(uuid, date, date);

CREATE OR REPLACE FUNCTION public.get_sms_metrics(
  p_organization_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  WITH 
  -- Get all SMS campaigns for the organization in the date range
  campaigns_base AS (
    SELECT 
      c.id,
      c.campaign_id,
      c.campaign_name,
      c.send_date,
      c.send_date::date as send_date_local,
      c.messages_sent,
      c.messages_delivered,
      c.clicks,
      c.opt_outs,
      c.cost,
      c.message_text,
      c.extracted_refcode,
      c.actblue_refcode,
      c.destination_url,
      c.conversions as stored_conversions,
      c.amount_raised as stored_amount_raised
    FROM sms_campaigns c
    WHERE c.organization_id = p_organization_id
      AND c.send_date >= p_start_date
      AND c.send_date <= (p_end_date + interval '1 day')
  ),
  
  -- Get all potential SMS donations
  sms_donations AS (
    SELECT 
      t.id as txn_id,
      t.transaction_date::date as txn_date,
      t.amount,
      t.refcode,
      t.contribution_form,
      t.donor_email
    FROM actblue_transactions t
    WHERE t.organization_id = p_organization_id
      AND t.transaction_date >= p_start_date
      AND t.transaction_date <= (p_end_date + interval '1 day')
  ),
  
  -- Match donations to campaigns using tiered logic based on REFCODE matching
  matched_donations AS (
    SELECT 
      c.id as campaign_id,
      d.txn_id,
      d.amount,
      d.donor_email,
      d.txn_date,
      d.refcode,
      CASE 
        -- Tier 1: Explicit actblue_refcode match (highest priority)
        WHEN c.actblue_refcode IS NOT NULL 
             AND LOWER(COALESCE(d.refcode, '')) = LOWER(c.actblue_refcode) 
        THEN 200
        
        -- Tier 2: Direct extracted_refcode match (exact or partial)
        WHEN c.extracted_refcode IS NOT NULL 
             AND d.refcode IS NOT NULL
             AND (
               LOWER(d.refcode) = LOWER(c.extracted_refcode)
               OR LOWER(d.refcode) LIKE LOWER(c.extracted_refcode) || '%'
               OR LOWER(c.extracted_refcode) LIKE LOWER(d.refcode) || '%'
             )
        THEN 180
        
        -- Tier 3: Date-coded refcode with token match
        WHEN d.refcode ~ '^20[0-9]{6}[A-Za-z]+'
             AND c.extracted_refcode IS NOT NULL
             AND (
               ABS(c.send_date_local - TO_DATE(LEFT(d.refcode, 8), 'YYYYMMDD')) <= 1
             )
             AND (
               LOWER(c.extracted_refcode) LIKE '%' || LOWER(SUBSTRING(d.refcode FROM 9)) || '%'
               OR LOWER(SUBSTRING(d.refcode FROM 9)) LIKE '%' || LOWER(REGEXP_REPLACE(c.extracted_refcode, '[0-9]', '', 'g')) || '%'
             )
        THEN 150
        
        -- Tier 4: Date-coded refcode matches send_date only
        WHEN d.refcode ~ '^20[0-9]{6}[A-Za-z]+'
             AND (
               ABS(c.send_date_local - TO_DATE(LEFT(d.refcode, 8), 'YYYYMMDD')) <= 1
             )
        THEN 100
        
        -- Tier 5: Form-based attribution within 3 days of campaign
        WHEN LOWER(COALESCE(d.contribution_form, '')) LIKE '%sms%'
             AND ABS(d.txn_date - c.send_date_local) <= 3
        THEN 50
        
        ELSE 0
      END as match_score
    FROM campaigns_base c
    CROSS JOIN sms_donations d
    WHERE d.refcode IS NOT NULL OR LOWER(COALESCE(d.contribution_form, '')) LIKE '%sms%'
  ),
  
  -- Select best match for each donation
  best_matches AS (
    SELECT DISTINCT ON (txn_id)
      campaign_id,
      txn_id,
      amount,
      donor_email,
      match_score
    FROM matched_donations
    WHERE match_score > 0
    ORDER BY txn_id, match_score DESC, campaign_id
  ),
  
  -- Aggregate donations per campaign
  campaign_donations AS (
    SELECT 
      campaign_id,
      COUNT(*) as donations,
      COALESCE(SUM(amount), 0) as amount_raised,
      COUNT(DISTINCT donor_email) as unique_donors
    FROM best_matches
    GROUP BY campaign_id
  ),
  
  -- Build final campaign list with metrics
  campaigns_with_metrics AS (
    SELECT 
      c.id,
      c.campaign_id,
      c.campaign_name,
      c.send_date,
      COALESCE(c.messages_sent, 0) as sent,
      COALESCE(c.messages_delivered, 0) as delivered,
      COALESCE(c.clicks, 0) as clicks,
      COALESCE(c.opt_outs, 0) as opt_outs,
      COALESCE(c.cost, 0) as cost,
      c.message_text,
      c.extracted_refcode,
      c.actblue_refcode,
      c.destination_url,
      COALESCE(cd.donations, c.stored_conversions, 0) as conversions,
      COALESCE(cd.amount_raised, c.stored_amount_raised, 0) as amount_raised,
      COALESCE(cd.unique_donors, 0) as unique_donors,
      CASE WHEN COALESCE(c.messages_sent, 0) > 0 
           THEN ROUND((COALESCE(c.clicks, 0)::numeric / c.messages_sent) * 100, 2) 
           ELSE 0 END as click_rate,
      CASE WHEN COALESCE(c.cost, 0) > 0 
           THEN ROUND(COALESCE(cd.amount_raised, c.stored_amount_raised, 0) / c.cost, 2) 
           ELSE 0 END as roi
    FROM campaigns_base c
    LEFT JOIN campaign_donations cd ON cd.campaign_id = c.id
  ),
  
  -- Calculate daily metrics
  daily_metrics AS (
    SELECT 
      c.send_date::date as date,
      SUM(c.messages_sent) as sent,
      SUM(c.messages_delivered) as delivered,
      SUM(c.clicks) as clicks,
      SUM(c.cost) as cost,
      SUM(COALESCE(cd.donations, 0)) as donations,
      SUM(COALESCE(cd.amount_raised, 0)) as amount_raised
    FROM campaigns_base c
    LEFT JOIN campaign_donations cd ON cd.campaign_id = c.id
    GROUP BY c.send_date::date
    ORDER BY date
  ),
  
  -- Calculate totals
  totals AS (
    SELECT 
      COALESCE(SUM(sent), 0) as total_sent,
      COALESCE(SUM(delivered), 0) as total_delivered,
      COALESCE(SUM(clicks), 0) as total_clicks,
      COALESCE(SUM(cost), 0) as total_cost,
      COALESCE(SUM(conversions), 0) as total_conversions,
      COALESCE(SUM(amount_raised), 0) as total_amount_raised,
      COALESCE(SUM(unique_donors), 0) as total_unique_donors,
      COUNT(*) as campaign_count
    FROM campaigns_with_metrics
  )
  
  SELECT jsonb_build_object(
    'campaigns', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', id,
          'campaignId', campaign_id,
          'campaignName', campaign_name,
          'sendDate', send_date,
          'sent', sent,
          'delivered', delivered,
          'clicks', clicks,
          'optOuts', opt_outs,
          'cost', cost,
          'messageText', message_text,
          'extractedRefcode', extracted_refcode,
          'actblueRefcode', actblue_refcode,
          'destinationUrl', destination_url,
          'conversions', conversions,
          'amountRaised', amount_raised,
          'uniqueDonors', unique_donors,
          'clickRate', click_rate,
          'roi', roi
        )
        ORDER BY send_date DESC
      )
      FROM campaigns_with_metrics
    ), '[]'::jsonb),
    'dailyMetrics', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'date', date,
          'sent', sent,
          'delivered', delivered,
          'clicks', clicks,
          'cost', cost,
          'donations', donations,
          'amountRaised', amount_raised
        )
        ORDER BY date
      )
      FROM daily_metrics
    ), '[]'::jsonb),
    'totals', (
      SELECT jsonb_build_object(
        'totalSent', total_sent,
        'totalDelivered', total_delivered,
        'totalClicks', total_clicks,
        'totalCost', total_cost,
        'totalConversions', total_conversions,
        'totalAmountRaised', total_amount_raised,
        'totalUniqueDonors', total_unique_donors,
        'campaignCount', campaign_count
      )
      FROM totals
    )
  ) INTO result;
  
  RETURN result;
END;
$$;