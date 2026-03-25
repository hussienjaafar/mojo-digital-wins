-- UNDO INCORRECT MERGE: Restore Hamawy For New Jersey as separate organization

-- 1. Reactivate Hamawy organization and restore original name
UPDATE client_organizations 
SET name = 'Hamawy For New Jersey',
    is_active = true
WHERE id = '3bb52c34-f486-465c-a5a9-237cac755c5b';

-- 2. Move Hamawy transactions (entity_id 208818) back to correct org
UPDATE actblue_transactions 
SET organization_id = '3bb52c34-f486-465c-a5a9-237cac755c5b'
WHERE entity_id = '208818'
  AND organization_id = '346d6aaf-34b3-435c-8cd1-3420d6a068d6';

-- 3. Move Hamawy webhook logs back (matching entity_id in payload)
UPDATE webhook_logs 
SET organization_id = '3bb52c34-f486-465c-a5a9-237cac755c5b'
WHERE organization_id = '346d6aaf-34b3-435c-8cd1-3420d6a068d6'
  AND (
    payload->>'entity_id' = '208818' 
    OR payload->'contribution'->>'entity_id' = '208818'
  );

-- 4. Move attributed donations back to Hamawy
UPDATE attributed_donations
SET organization_id = '3bb52c34-f486-465c-a5a9-237cac755c5b'
WHERE organization_id = '346d6aaf-34b3-435c-8cd1-3420d6a068d6'
  AND transaction_id IN (
    SELECT transaction_id FROM actblue_transactions 
    WHERE organization_id = '3bb52c34-f486-465c-a5a9-237cac755c5b'
  );

-- 5. Reactivate Hamawy credentials
UPDATE client_api_credentials 
SET is_active = true
WHERE organization_id = '3bb52c34-f486-465c-a5a9-237cac755c5b'
  AND platform = 'actblue';

-- 6. Clear daily_aggregated_metrics for both orgs (will be recalculated)
DELETE FROM daily_aggregated_metrics 
WHERE organization_id IN (
  '346d6aaf-34b3-435c-8cd1-3420d6a068d6',
  '3bb52c34-f486-465c-a5a9-237cac755c5b'
);