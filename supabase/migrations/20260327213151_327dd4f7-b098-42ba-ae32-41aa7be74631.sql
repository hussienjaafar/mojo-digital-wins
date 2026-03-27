CREATE OR REPLACE FUNCTION backfill_attribution_by_org(p_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '50s'
AS $$
DECLARE r1 INT; r2 INT; r3 INT; r4 INT; r5 INT; r6 INT; r7 INT;
BEGIN
  UPDATE actblue_transactions SET attributed_channel='sms' WHERE organization_id=p_org_id AND attributed_channel='other' AND contribution_form IS NOT NULL AND (LOWER(contribution_form) LIKE '%sms%' OR LOWER(contribution_form) LIKE '%text%');
  GET DIAGNOSTICS r1 = ROW_COUNT;
  UPDATE actblue_transactions SET attributed_channel='meta' WHERE organization_id=p_org_id AND attributed_channel='other' AND contribution_form IS NOT NULL AND LOWER(contribution_form) LIKE '%meta%';
  GET DIAGNOSTICS r2 = ROW_COUNT;
  UPDATE actblue_transactions SET attributed_channel='sms' WHERE organization_id=p_org_id AND attributed_channel='other' AND refcode IS NOT NULL AND (refcode ILIKE '%sms%' OR refcode ILIKE '%text%' OR refcode ILIKE 'txt%');
  GET DIAGNOSTICS r3 = ROW_COUNT;
  UPDATE actblue_transactions SET attributed_channel='meta' WHERE organization_id=p_org_id AND attributed_channel='other' AND refcode IS NOT NULL AND (refcode ILIKE '%fb%' OR refcode ILIKE '%facebook%' OR refcode ILIKE '%ig%' OR refcode ILIKE '%instagram%' OR refcode ILIKE '%meta%');
  GET DIAGNOSTICS r4 = ROW_COUNT;
  UPDATE actblue_transactions SET attributed_channel='email' WHERE organization_id=p_org_id AND attributed_channel='other' AND refcode IS NOT NULL AND (refcode ILIKE '%email%' OR refcode ILIKE '%em_%');
  GET DIAGNOSTICS r5 = ROW_COUNT;
  UPDATE actblue_transactions SET attributed_channel='organic' WHERE organization_id=p_org_id AND attributed_channel='other' AND refcode IS NOT NULL AND (refcode ILIKE '%organic%' OR refcode ILIKE '%direct%');
  GET DIAGNOSTICS r6 = ROW_COUNT;
  UPDATE actblue_transactions SET attributed_channel='meta' WHERE organization_id=p_org_id AND attributed_channel='other' AND refcode2 IS NOT NULL AND LOWER(refcode2) LIKE 'fb_%';
  GET DIAGNOSTICS r7 = ROW_COUNT;
  RETURN r1+r2+r3+r4+r5+r6+r7 || ' total (sms_form:' || r1 || ' meta_form:' || r2 || ' sms_ref:' || r3 || ' meta_ref:' || r4 || ' email_ref:' || r5 || ' organic_ref:' || r6 || ' meta_ref2:' || r7 || ')';
END;
$$;