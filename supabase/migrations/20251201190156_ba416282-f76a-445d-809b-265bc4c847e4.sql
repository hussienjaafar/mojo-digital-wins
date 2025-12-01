-- Add unique constraint (skip if exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'entity_watchlist_entity_name_type_key'
  ) THEN
    ALTER TABLE public.entity_watchlist 
    ADD CONSTRAINT entity_watchlist_entity_name_type_key 
    UNIQUE (entity_name, entity_type);
  END IF;
END $$;

-- Populate with key entities using valid entity_type values
INSERT INTO public.entity_watchlist (entity_name, entity_type, alert_threshold, is_active)
VALUES 
  ('CAIR', 'organization', 5, true),
  ('MPAC', 'organization', 5, true),
  ('ACLU', 'organization', 5, true),
  ('ADC', 'organization', 5, true),
  ('Gaza', 'topic', 10, true),
  ('Palestine', 'topic', 10, true),
  ('Donald Trump', 'person', 15, true),
  ('Benjamin Netanyahu', 'person', 15, true),
  ('Immigration', 'topic', 10, true),
  ('Surveillance', 'topic', 8, true)
ON CONFLICT (entity_name, entity_type) DO NOTHING;

-- Ensure calculate-entity-trends job is scheduled
UPDATE public.scheduled_jobs
SET 
  is_active = true,
  next_run_at = NOW() + INTERVAL '30 seconds'
WHERE job_type = 'calculate_entity_trends';

-- If job doesn't exist, create it (check for existence first)
INSERT INTO public.scheduled_jobs (job_type, schedule, is_active, next_run_at)
SELECT 'calculate_entity_trends', '*/10 * * * *', true, NOW() + INTERVAL '30 seconds'
WHERE NOT EXISTS (
  SELECT 1 FROM public.scheduled_jobs WHERE job_type = 'calculate_entity_trends'
);