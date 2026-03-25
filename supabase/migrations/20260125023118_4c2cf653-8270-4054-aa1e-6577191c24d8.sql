-- Add unique constraints for correlation engine upserts
-- These are REQUIRED for the ON CONFLICT clauses to work

-- 1. creative_performance_correlations unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_correlations_unique 
ON creative_performance_correlations(
  organization_id, 
  correlation_type, 
  attribute_name, 
  attribute_value, 
  correlated_metric
);

-- 2. creative_performance_learnings unique constraint
-- Uses COALESCE for nullable columns
CREATE UNIQUE INDEX IF NOT EXISTS idx_learnings_unique
ON creative_performance_learnings(
  COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'),
  channel,
  COALESCE(topic, ''),
  COALESCE(tone, ''),
  COALESCE(urgency_level, ''),
  COALESCE(call_to_action, ''),
  COALESCE(emotional_appeal, ''),
  COALESCE(optimal_hour::text, '-1'),
  COALESCE(optimal_day::text, '-1')
);

-- 3. ad_fatigue_alerts unique constraint (one active alert per ad)
CREATE UNIQUE INDEX IF NOT EXISTS idx_fatigue_alerts_unique
ON ad_fatigue_alerts(organization_id, ad_id)
WHERE is_acknowledged = false;