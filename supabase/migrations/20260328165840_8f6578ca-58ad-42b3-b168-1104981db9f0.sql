
-- Step-based backfill that processes one pattern at a time
CREATE OR REPLACE FUNCTION public.backfill_attribution_step(
  p_org_id uuid,
  p_step integer,
  p_limit integer DEFAULT 50000
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '55s'
AS $$
DECLARE
  updated integer := 0;
BEGIN
  CASE p_step
    WHEN 1 THEN
      -- text- or text_ prefix → sms
      WITH targets AS (
        SELECT id FROM actblue_transactions
        WHERE organization_id = p_org_id AND attributed_channel = 'other'
          AND refcode IS NOT NULL
          AND (LOWER(refcode) LIKE 'text-%' OR LOWER(refcode) LIKE 'text\_%')
        LIMIT p_limit
      )
      UPDATE actblue_transactions SET attributed_channel = 'sms'
      FROM targets WHERE actblue_transactions.id = targets.id;
    WHEN 2 THEN
      -- em followed by digits → email
      WITH targets AS (
        SELECT id FROM actblue_transactions
        WHERE organization_id = p_org_id AND attributed_channel = 'other'
          AND refcode IS NOT NULL AND LOWER(refcode) ~ '^em[0-9]'
        LIMIT p_limit
      )
      UPDATE actblue_transactions SET attributed_channel = 'email'
      FROM targets WHERE actblue_transactions.id = targets.id;
    WHEN 3 THEN
      -- ads_ prefix → meta
      WITH targets AS (
        SELECT id FROM actblue_transactions
        WHERE organization_id = p_org_id AND attributed_channel = 'other'
          AND refcode IS NOT NULL AND LOWER(refcode) LIKE 'ads\_%'
        LIMIT p_limit
      )
      UPDATE actblue_transactions SET attributed_channel = 'meta'
      FROM targets WHERE actblue_transactions.id = targets.id;
    WHEN 4 THEN
      -- web_ or web- prefix → organic
      WITH targets AS (
        SELECT id FROM actblue_transactions
        WHERE organization_id = p_org_id AND attributed_channel = 'other'
          AND refcode IS NOT NULL
          AND (LOWER(refcode) LIKE 'web\_%' OR LOWER(refcode) LIKE 'web-%')
        LIMIT p_limit
      )
      UPDATE actblue_transactions SET attributed_channel = 'organic'
      FROM targets WHERE actblue_transactions.id = targets.id;
    ELSE
      RETURN 0;
  END CASE;

  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated;
END;
$$;
