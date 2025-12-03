-- Add unique constraint for creative_performance_learnings upsert
-- Using COALESCE to handle NULL values in the unique constraint

CREATE UNIQUE INDEX idx_creative_learnings_pattern_unique 
ON public.creative_performance_learnings (
  COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid),
  channel,
  COALESCE(topic, ''),
  COALESCE(tone, ''),
  COALESCE(urgency_level, ''),
  COALESCE(call_to_action, ''),
  COALESCE(emotional_appeal, ''),
  COALESCE(optimal_hour, -1),
  COALESCE(optimal_day, -1)
);