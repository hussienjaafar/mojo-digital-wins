-- Backfill attributed_channel Step 1: refcode_mappings match
UPDATE actblue_transactions t
SET attributed_channel = (
  SELECT rm.platform FROM refcode_mappings rm
  WHERE rm.organization_id = t.organization_id
  AND LOWER(rm.refcode) = LOWER(t.refcode)
  LIMIT 1
)
WHERE (attributed_channel = 'other' OR attributed_channel IS NULL)
AND t.refcode IS NOT NULL
AND EXISTS (
  SELECT 1 FROM refcode_mappings rm
  WHERE rm.organization_id = t.organization_id
  AND LOWER(rm.refcode) = LOWER(t.refcode)
)