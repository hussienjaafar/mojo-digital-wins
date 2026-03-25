-- Merge Hamawy organizations with conflict handling
-- Duplicate org: 3bb52c34-f486-465c-a5a9-237cac755c5b (Hamawy For New Jersey)
-- Active org: 346d6aaf-34b3-435c-8cd1-3420d6a068d6 (A New Policy)

-- Step 1: Migrate ActBlue transactions
UPDATE actblue_transactions 
SET organization_id = '346d6aaf-34b3-435c-8cd1-3420d6a068d6'
WHERE organization_id = '3bb52c34-f486-465c-a5a9-237cac755c5b';

-- Step 2: Migrate webhook logs
UPDATE webhook_logs 
SET organization_id = '346d6aaf-34b3-435c-8cd1-3420d6a068d6'
WHERE organization_id = '3bb52c34-f486-465c-a5a9-237cac755c5b';

-- Step 3: Delete duplicate org's daily_aggregated_metrics (will be recalculated)
DELETE FROM daily_aggregated_metrics 
WHERE organization_id = '3bb52c34-f486-465c-a5a9-237cac755c5b';

-- Step 4: Migrate attributed_donations
UPDATE attributed_donations 
SET organization_id = '346d6aaf-34b3-435c-8cd1-3420d6a068d6'
WHERE organization_id = '3bb52c34-f486-465c-a5a9-237cac755c5b';

-- Step 5: Migrate client_entity_alerts
UPDATE client_entity_alerts 
SET organization_id = '346d6aaf-34b3-435c-8cd1-3420d6a068d6'
WHERE organization_id = '3bb52c34-f486-465c-a5a9-237cac755c5b';

-- Step 6: Deactivate the duplicate organization (no notes column)
UPDATE client_organizations 
SET is_active = false, 
    name = '[MERGED] ' || name
WHERE id = '3bb52c34-f486-465c-a5a9-237cac755c5b';

-- Step 7: Deactivate credentials on duplicate org
UPDATE client_api_credentials 
SET is_active = false
WHERE organization_id = '3bb52c34-f486-465c-a5a9-237cac755c5b';