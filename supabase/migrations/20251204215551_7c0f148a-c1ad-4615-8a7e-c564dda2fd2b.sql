-- Phase 4: Enhanced velocity detection columns
ALTER TABLE public.trend_clusters 
ADD COLUMN IF NOT EXISTS acceleration numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS peak_hour timestamp with time zone,
ADD COLUMN IF NOT EXISTS mentions_last_15m integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS velocity_1h numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS velocity_6h numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS trend_stage text DEFAULT 'stable',
ADD COLUMN IF NOT EXISTS spike_detected_at timestamp with time zone;

-- Add comment explaining trend stages
COMMENT ON COLUMN public.trend_clusters.trend_stage IS 'emerging, surging, peaking, declining, stable';
COMMENT ON COLUMN public.trend_clusters.acceleration IS 'Rate of velocity change (positive = speeding up, negative = slowing down)';