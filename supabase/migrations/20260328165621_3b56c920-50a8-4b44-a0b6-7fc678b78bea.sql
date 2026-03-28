
DROP FUNCTION IF EXISTS public.backfill_attribution_by_org(uuid);

CREATE OR REPLACE FUNCTION public.backfill_attribution_by_org(p_org_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '55s'
AS $$
DECLARE
  updated integer := 0;
  step_count integer;
BEGIN
  -- Step 1: text- or text_ prefix → sms
  UPDATE actblue_transactions SET attributed_channel = 'sms'
  WHERE organization_id = p_org_id AND attributed_channel = 'other'
    AND refcode IS NOT NULL
    AND (LOWER(refcode) LIKE 'text-%' OR LOWER(refcode) LIKE 'text\_%');
  GET DIAGNOSTICS step_count = ROW_COUNT;
  updated := updated + step_count;

  -- Step 2: em followed by date pattern → email
  UPDATE actblue_transactions SET attributed_channel = 'email'
  WHERE organization_id = p_org_id AND attributed_channel = 'other'
    AND refcode IS NOT NULL AND LOWER(refcode) ~ '^em[0-9]{6}';
  GET DIAGNOSTICS step_count = ROW_COUNT;
  updated := updated + step_count;

  -- Step 3: ads_ prefix → meta
  UPDATE actblue_transactions SET attributed_channel = 'meta'
  WHERE organization_id = p_org_id AND attributed_channel = 'other'
    AND refcode IS NOT NULL AND LOWER(refcode) LIKE 'ads\_%';
  GET DIAGNOSTICS step_count = ROW_COUNT;
  updated := updated + step_count;

  -- Step 4: web_ or web- prefix → organic
  UPDATE actblue_transactions SET attributed_channel = 'organic'
  WHERE organization_id = p_org_id AND attributed_channel = 'other'
    AND refcode IS NOT NULL
    AND (LOWER(refcode) LIKE 'web\_%' OR LOWER(refcode) LIKE 'web-%');
  GET DIAGNOSTICS step_count = ROW_COUNT;
  updated := updated + step_count;

  -- Step 5: contribution_form patterns
  UPDATE actblue_transactions
  SET attributed_channel = CASE
    WHEN LOWER(contribution_form) LIKE '%sms%' OR LOWER(contribution_form) LIKE '%text%' THEN 'sms'
    WHEN LOWER(contribution_form) LIKE '%meta%' THEN 'meta'
    ELSE attributed_channel
  END
  WHERE organization_id = p_org_id AND attributed_channel = 'other'
    AND contribution_form IS NOT NULL;
  GET DIAGNOSTICS step_count = ROW_COUNT;
  updated := updated + step_count;

  RETURN updated;
END;
$$;
