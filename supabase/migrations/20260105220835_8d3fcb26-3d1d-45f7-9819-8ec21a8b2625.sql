-- =============================================================================
-- Task 4: Org-Scoped Personalization Schema (Fixed)
-- =============================================================================

-- 9. Add scheduled job for org relevance computation (without priority column)
INSERT INTO public.scheduled_jobs (job_type, job_name, schedule, endpoint, is_active)
VALUES (
  'compute_org_relevance',
  'Compute Org Relevance Scores',
  '*/20 * * * *',
  'compute-org-relevance',
  true
)
ON CONFLICT (job_type) DO UPDATE SET
  is_active = true,
  schedule = EXCLUDED.schedule;

-- Add heartbeat entry
INSERT INTO public.pipeline_heartbeat (job_type, job_name, sla_minutes, is_critical)
VALUES (
  'compute_org_relevance',
  'Compute Org Relevance Scores',
  30,
  false
)
ON CONFLICT (job_type) DO UPDATE SET
  job_name = EXCLUDED.job_name;