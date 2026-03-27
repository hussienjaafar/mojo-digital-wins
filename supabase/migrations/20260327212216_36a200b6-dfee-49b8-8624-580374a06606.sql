CREATE OR REPLACE FUNCTION backfill_attribution_step(p_step INT, p_limit INT DEFAULT 500)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '15s'
AS $$
DECLARE
  updated INT := 0;
BEGIN
  CASE p_step
    WHEN 1 THEN
      UPDATE actblue_transactions SET attributed_channel='sms'
      WHERE id IN (SELECT id FROM actblue_transactions WHERE attributed_channel='other' AND contribution_form IS NOT NULL AND (LOWER(contribution_form) LIKE '%sms%' OR LOWER(contribution_form) LIKE '%text%') LIMIT p_limit);
    WHEN 2 THEN
      UPDATE actblue_transactions SET attributed_channel='meta'
      WHERE id IN (SELECT id FROM actblue_transactions WHERE attributed_channel='other' AND contribution_form IS NOT NULL AND LOWER(contribution_form) LIKE '%meta%' LIMIT p_limit);
    WHEN 3 THEN
      UPDATE actblue_transactions SET attributed_channel='sms'
      WHERE id IN (SELECT id FROM actblue_transactions WHERE attributed_channel='other' AND refcode IS NOT NULL AND (refcode ILIKE '%sms%' OR refcode ILIKE '%text%' OR refcode ILIKE 'txt%') LIMIT p_limit);
    WHEN 4 THEN
      UPDATE actblue_transactions SET attributed_channel='meta'
      WHERE id IN (SELECT id FROM actblue_transactions WHERE attributed_channel='other' AND refcode IS NOT NULL AND (refcode ILIKE '%fb%' OR refcode ILIKE '%facebook%' OR refcode ILIKE '%ig%' OR refcode ILIKE '%instagram%' OR refcode ILIKE '%meta%') LIMIT p_limit);
    WHEN 5 THEN
      UPDATE actblue_transactions SET attributed_channel='email'
      WHERE id IN (SELECT id FROM actblue_transactions WHERE attributed_channel='other' AND refcode IS NOT NULL AND (refcode ILIKE '%email%' OR refcode ILIKE '%em_%') LIMIT p_limit);
    WHEN 6 THEN
      UPDATE actblue_transactions SET attributed_channel='organic'
      WHERE id IN (SELECT id FROM actblue_transactions WHERE attributed_channel='other' AND refcode IS NOT NULL AND (refcode ILIKE '%organic%' OR refcode ILIKE '%direct%') LIMIT p_limit);
    WHEN 7 THEN
      UPDATE actblue_transactions SET attributed_channel='meta'
      WHERE id IN (SELECT id FROM actblue_transactions WHERE attributed_channel='other' AND refcode2 IS NOT NULL AND LOWER(refcode2) LIKE 'fb_%' LIMIT p_limit);
    ELSE
      RETURN 0;
  END CASE;
  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated;
END;
$$;