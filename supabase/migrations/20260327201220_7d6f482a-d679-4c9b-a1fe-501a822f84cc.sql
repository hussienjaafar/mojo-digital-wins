CREATE OR REPLACE FUNCTION backfill_attribution_batch() RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r1 INT; r2 INT; r3 INT; r4 INT; r5 INT; r6 INT; r7 INT;
BEGIN
  UPDATE actblue_transactions SET attributed_channel='sms' WHERE id IN (SELECT id FROM actblue_transactions WHERE attributed_channel='other' AND contribution_form IS NOT NULL AND (LOWER(contribution_form) LIKE '%sms%' OR LOWER(contribution_form) LIKE '%text%') LIMIT 2000);
  GET DIAGNOSTICS r1 = ROW_COUNT;
  UPDATE actblue_transactions SET attributed_channel='meta' WHERE id IN (SELECT id FROM actblue_transactions WHERE attributed_channel='other' AND contribution_form IS NOT NULL AND LOWER(contribution_form) LIKE '%meta%' LIMIT 2000);
  GET DIAGNOSTICS r2 = ROW_COUNT;
  UPDATE actblue_transactions SET attributed_channel='sms' WHERE id IN (SELECT id FROM actblue_transactions WHERE attributed_channel='other' AND refcode IS NOT NULL AND (refcode ILIKE '%sms%' OR refcode ILIKE '%text%' OR refcode ILIKE 'txt%') LIMIT 2000);
  GET DIAGNOSTICS r3 = ROW_COUNT;
  UPDATE actblue_transactions SET attributed_channel='meta' WHERE id IN (SELECT id FROM actblue_transactions WHERE attributed_channel='other' AND refcode IS NOT NULL AND (refcode ILIKE '%fb%' OR refcode ILIKE '%facebook%' OR refcode ILIKE '%ig%' OR refcode ILIKE '%instagram%' OR refcode ILIKE '%meta%') LIMIT 2000);
  GET DIAGNOSTICS r4 = ROW_COUNT;
  UPDATE actblue_transactions SET attributed_channel='email' WHERE id IN (SELECT id FROM actblue_transactions WHERE attributed_channel='other' AND refcode IS NOT NULL AND (refcode ILIKE '%email%' OR refcode ILIKE '%em_%') LIMIT 2000);
  GET DIAGNOSTICS r5 = ROW_COUNT;
  UPDATE actblue_transactions SET attributed_channel='organic' WHERE id IN (SELECT id FROM actblue_transactions WHERE attributed_channel='other' AND refcode IS NOT NULL AND (refcode ILIKE '%organic%' OR refcode ILIKE '%direct%') LIMIT 2000);
  GET DIAGNOSTICS r6 = ROW_COUNT;
  UPDATE actblue_transactions SET attributed_channel='meta' WHERE id IN (SELECT id FROM actblue_transactions WHERE attributed_channel='other' AND refcode2 IS NOT NULL AND LOWER(refcode2) LIKE 'fb_%' LIMIT 2000);
  GET DIAGNOSTICS r7 = ROW_COUNT;
  RETURN 'sms_form:' || r1 || ' meta_form:' || r2 || ' sms_ref:' || r3 || ' meta_ref:' || r4 || ' email_ref:' || r5 || ' organic_ref:' || r6 || ' meta_ref2:' || r7;
END; $$