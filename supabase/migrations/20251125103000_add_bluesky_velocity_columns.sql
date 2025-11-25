-- Sprint 0 alignment: add missing velocity fields to Bluesky trends
-- Adds baseline and spike metadata referenced in Sprint 0 plan

ALTER TABLE public.bluesky_trends
  ADD COLUMN IF NOT EXISTS baseline_velocity NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS spike_detected BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS spike_magnitude NUMERIC;

COMMENT ON COLUMN public.bluesky_trends.baseline_velocity IS 'Longer-term average velocity baseline for trend comparisons';
COMMENT ON COLUMN public.bluesky_trends.spike_detected IS 'Flag when a significant spike is detected for the topic';
COMMENT ON COLUMN public.bluesky_trends.spike_magnitude IS 'Magnitude of the detected spike (percent over baseline)';
