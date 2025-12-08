-- Sprint 4 (completion): strengthen deterministic attribution and add usable LTV predictions

-- 1) Donation attribution view: allow click_id/fbclid linkage when refcode is absent
DROP VIEW IF EXISTS donation_attribution;
CREATE VIEW donation_attribution AS
SELECT 
  t.id as transaction_id,
  t.organization_id,
  t.amount,
  t.net_amount,
  t.fee,
  t.transaction_date,
  t.transaction_type,
  t.refcode,
  t.refcode2,
  t.refcode_custom,
  t.is_recurring,
  t.recurring_period,
  t.payment_method,
  t.card_type,
  -- deterministic platform priority: explicit mapping by refcode or click_id/fbclid > legacy source
  COALESCE(rm.platform, t.source_campaign, CASE WHEN t.click_id IS NOT NULL OR t.fbclid IS NOT NULL THEN 'meta' END) AS attributed_platform,
  rm.campaign_id as attributed_campaign_id,
  rm.campaign_name as attributed_campaign_name,
  rm.ad_id as attributed_ad_id,
  rm.creative_id as attributed_creative_id,
  rm.landing_page,
  rm.click_id as mapped_click_id,
  rm.fbclid as mapped_fbclid,
  t.click_id as transaction_click_id,
  t.fbclid as transaction_fbclid,
  CASE 
    WHEN rm.refcode IS NOT NULL THEN 'refcode'
    WHEN rm.click_id IS NOT NULL OR rm.fbclid IS NOT NULL THEN 'click_id'
    WHEN t.refcode IS NOT NULL THEN 'regex'
    ELSE 'unknown'
  END AS attribution_method,
  mci.topic as creative_topic,
  mci.tone as creative_tone,
  mci.key_themes as creative_themes,
  mci.emotional_appeal as creative_emotional_appeal
FROM actblue_transactions t
LEFT JOIN refcode_mappings rm 
  ON t.organization_id = rm.organization_id 
  AND (
    (t.refcode IS NOT NULL AND t.refcode = rm.refcode)
    OR (t.click_id IS NOT NULL AND t.click_id = rm.click_id)
    OR (t.fbclid IS NOT NULL AND t.fbclid = rm.fbclid)
  )
LEFT JOIN meta_creative_insights mci 
  ON rm.creative_id = mci.creative_id
  AND rm.organization_id = mci.organization_id
WHERE can_access_organization_data(t.organization_id);

COMMENT ON VIEW public.donation_attribution IS 'Org-scoped donation attribution with deterministic refcode or click_id/fbclid mappings and creative context.';

-- Helpful indexes for click_id/fbclid lookups
CREATE INDEX IF NOT EXISTS idx_refcode_mappings_org_click ON refcode_mappings(organization_id, click_id);
CREATE INDEX IF NOT EXISTS idx_refcode_mappings_org_fbclid ON refcode_mappings(organization_id, fbclid);

-- 2) Heuristic LTV/retention refresh function (non-PII; uses hashed donor keys)
CREATE OR REPLACE FUNCTION refresh_donor_ltv_predictions(
  p_org uuid,
  p_lookback_days integer DEFAULT 365
) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  inserted_count integer := 0;
BEGIN
  -- Remove old scores for org to avoid duplicates
  DELETE FROM donor_ltv_predictions WHERE organization_id = p_org;

  WITH tx AS (
    SELECT 
      organization_id,
      donor_id_hash,
      phone_hash,
      is_recurring,
      transaction_date,
      transaction_type,
      COALESCE(net_amount, amount, 0) AS value
    FROM actblue_transactions_secure
    WHERE organization_id = p_org
      AND transaction_date >= NOW() - (p_lookback_days || ' days')::interval
      AND (donor_id_hash IS NOT NULL OR phone_hash IS NOT NULL)
  ), agg AS (
    SELECT 
      organization_id,
      COALESCE(donor_id_hash, phone_hash) AS donor_key,
      MAX(donor_id_hash) AS donor_email_hash,
      MAX(phone_hash) AS donor_phone_hash,
      COUNT(*) FILTER (WHERE transaction_type = 'donation') AS donation_count,
      COUNT(*) FILTER (WHERE transaction_type = 'refund') AS refund_count,
      SUM(CASE WHEN transaction_type = 'refund' THEN -value ELSE value END) AS net_revenue,
      MIN(transaction_date) AS first_date,
      MAX(transaction_date) AS last_date,
      BOOL_OR(is_recurring) AS has_recurring
    FROM tx
    GROUP BY organization_id, COALESCE(donor_id_hash, phone_hash)
  )
  INSERT INTO donor_ltv_predictions (
    organization_id,
    donor_email_hash,
    donor_phone_hash,
    predicted_ltv_90,
    predicted_ltv_180,
    repeat_prob_90,
    repeat_prob_180,
    churn_risk,
    model_version,
    computed_at
  )
  SELECT
    p_org,
    agg.donor_email_hash,
    agg.donor_phone_hash,
    -- simple velocity-based projections using net revenue
    GREATEST(0, ROUND((agg.net_revenue / GREATEST(1, DATE_PART('day', agg.last_date - agg.first_date) + 1)) * 90, 2)) AS predicted_ltv_90,
    GREATEST(0, ROUND((agg.net_revenue / GREATEST(1, DATE_PART('day', agg.last_date - agg.first_date) + 1)) * 180, 2)) AS predicted_ltv_180,
    -- repeat probability favors donors with more donations and recent activity; recurring donors get a small boost
    LEAST(
      0.99, 
      GREATEST(
        0.01, 
        (agg.donation_count::numeric / GREATEST(1, agg.donation_count + agg.refund_count)) 
        * COALESCE(1 - (DATE_PART('day', NOW() - agg.last_date) / NULLIF(p_lookback_days, 0)), 0.5) 
        + CASE WHEN agg.has_recurring THEN 0.15 ELSE 0 END
      )
    ) AS repeat_prob_90,
    LEAST(
      0.99, 
      GREATEST(
        0.01, 
        (agg.donation_count::numeric / GREATEST(1, agg.donation_count + agg.refund_count)) 
        * COALESCE(1 - (DATE_PART('day', NOW() - agg.last_date) / NULLIF(p_lookback_days, 0)), 0.5) 
        + CASE WHEN agg.has_recurring THEN 0.20 ELSE 0 END
      )
    ) AS repeat_prob_180,
    -- churn risk rises with time since last donation, reduced if recurring
    LEAST(
      0.99, 
      GREATEST(
        0.01, 
        (DATE_PART('day', NOW() - agg.last_date) / 90.0) - CASE WHEN agg.has_recurring THEN 0.25 ELSE 0 END
      )
    ) AS churn_risk,
    'heuristic_v1' AS model_version,
    NOW() AS computed_at
  FROM agg
  WHERE agg.donor_key IS NOT NULL;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

COMMENT ON FUNCTION refresh_donor_ltv_predictions(uuid, integer) IS 'Heuristic LTV/retention scorer using hashed donors; deletes and reloads predictions for org.';
