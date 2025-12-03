-- Phase 1: Link existing watchlist items to demo organization
UPDATE public.entity_watchlist 
SET organization_id = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'
WHERE organization_id IS NULL;

-- Phase 2: Generate test alerts with valid alert_types
INSERT INTO public.client_entity_alerts (
  organization_id,
  entity_name,
  alert_type,
  severity,
  velocity,
  current_mentions,
  actionable_score,
  is_actionable,
  is_read,
  triggered_at,
  suggested_action,
  sample_sources
) VALUES 
(
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  'Immigration Policy',
  'spike',
  'critical',
  245.5,
  89,
  0.92,
  true,
  false,
  NOW() - INTERVAL '15 minutes',
  'Consider sending fundraising appeal highlighting immigration stance',
  '[{"source": "Reuters", "title": "New Immigration Executive Order Announced"}, {"source": "AP News", "title": "Border Policy Changes Take Effect"}]'::jsonb
),
(
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  'Healthcare Reform',
  'breaking',
  'high',
  156.2,
  45,
  0.78,
  true,
  false,
  NOW() - INTERVAL '1 hour',
  'Draft response messaging on healthcare positions',
  '[{"source": "CNN", "title": "Healthcare Bill Advances in Senate"}]'::jsonb
),
(
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  'Climate Action',
  'sentiment_shift',
  'medium',
  78.3,
  32,
  0.65,
  true,
  false,
  NOW() - INTERVAL '3 hours',
  'Monitor for fundraising opportunity',
  '[{"source": "NPR", "title": "Climate Summit Concludes"}]'::jsonb
),
(
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  'Voting Rights',
  'spike',
  'critical',
  312.8,
  156,
  0.95,
  true,
  false,
  NOW() - INTERVAL '30 minutes',
  'Immediate outreach recommended - high engagement window',
  '[{"source": "Washington Post", "title": "Voting Rights Act Amendment Proposed"}, {"source": "NYT", "title": "State Legislatures Act on Voting Laws"}]'::jsonb
);