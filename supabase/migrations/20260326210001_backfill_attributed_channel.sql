-- Backfill attributed_channel for all existing actblue_transactions
-- Uses the same priority chain as the webhook handler

-- Step 1: Set attributed_channel
UPDATE actblue_transactions t
SET attributed_channel = CASE
  -- Priority 1: refcode_mappings exact match
  WHEN t.refcode IS NOT NULL AND EXISTS (
    SELECT 1 FROM refcode_mappings rm
    WHERE rm.organization_id = t.organization_id
    AND LOWER(rm.refcode) = LOWER(t.refcode)
  ) THEN (
    SELECT rm.platform FROM refcode_mappings rm
    WHERE rm.organization_id = t.organization_id
    AND LOWER(rm.refcode) = LOWER(t.refcode)
    LIMIT 1
  )
  -- Priority 2: sms_campaigns refcode match
  WHEN t.refcode IS NOT NULL AND EXISTS (
    SELECT 1 FROM sms_campaigns sc
    WHERE sc.organization_id = t.organization_id
    AND (LOWER(sc.actblue_refcode) = LOWER(t.refcode) OR LOWER(sc.extracted_refcode) = LOWER(t.refcode))
  ) THEN 'sms'
  -- Priority 3: refcode2 fb_ prefix
  WHEN t.refcode2 IS NOT NULL AND LOWER(t.refcode2) LIKE 'fb_%' THEN 'meta'
  -- Priority 5: contribution_form patterns
  WHEN LOWER(t.contribution_form) LIKE '%sms%' OR LOWER(t.contribution_form) LIKE '%text%' THEN 'sms'
  WHEN LOWER(t.contribution_form) LIKE '%meta%' THEN 'meta'
  -- Priority 6: refcode patterns
  WHEN t.refcode ILIKE '%sms%' OR t.refcode ILIKE '%text%' OR t.refcode ILIKE 'txt%' THEN 'sms'
  WHEN t.refcode ILIKE '%fb%' OR t.refcode ILIKE '%facebook%' OR t.refcode ILIKE '%ig%' OR t.refcode ILIKE '%instagram%' OR t.refcode ILIKE '%meta%' THEN 'meta'
  WHEN t.refcode ILIKE '%email%' OR t.refcode ILIKE '%em_%' THEN 'email'
  WHEN t.refcode ILIKE '%organic%' OR t.refcode ILIKE '%direct%' THEN 'organic'
  ELSE 'other'
END
WHERE attributed_channel = 'other' OR attributed_channel IS NULL;

-- Step 2: Set sms_campaign_id for SMS-attributed transactions
UPDATE actblue_transactions t
SET sms_campaign_id = (
  SELECT sc.id FROM sms_campaigns sc
  WHERE sc.organization_id = t.organization_id
  AND (LOWER(sc.actblue_refcode) = LOWER(t.refcode) OR LOWER(sc.extracted_refcode) = LOWER(t.refcode))
  ORDER BY sc.send_date DESC
  LIMIT 1
)
WHERE t.attributed_channel = 'sms'
AND t.sms_campaign_id IS NULL
AND t.refcode IS NOT NULL;

-- Step 3: Also set sms_campaign_id via form name match for transactions without refcode match
UPDATE actblue_transactions t
SET sms_campaign_id = (
  SELECT sc.id FROM sms_campaigns sc
  WHERE sc.organization_id = t.organization_id
  AND sc.actblue_form IS NOT NULL
  AND LOWER(t.contribution_form) LIKE '%' || LOWER(sc.actblue_form) || '%'
  ORDER BY sc.send_date DESC
  LIMIT 1
)
WHERE t.attributed_channel = 'sms'
AND t.sms_campaign_id IS NULL
AND t.contribution_form IS NOT NULL;
