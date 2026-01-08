-- Phase 1: Enhanced baseline schema for true z-score calculation
-- Add columns for standard deviation, hourly readings, and volatility metrics

-- Add standard deviation columns to trend_baselines
ALTER TABLE public.trend_baselines 
ADD COLUMN IF NOT EXISTS hourly_std_dev numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS relative_std_dev numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS hourly_readings integer[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS min_hourly numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_hourly numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_stable boolean DEFAULT false;

-- Add index for baseline queries
CREATE INDEX IF NOT EXISTS idx_trend_baselines_event_key_date ON public.trend_baselines(event_key, baseline_date DESC);

-- Phase 1: Add enhanced z-score fields to trend_events
ALTER TABLE public.trend_events
ADD COLUMN IF NOT EXISTS true_z_score numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS poisson_surprise numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS baseline_std_dev numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_evergreen_detected boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS burst_normalized_score numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS co_occurrence_anomaly_score numeric DEFAULT 0;

-- Create index for ranking queries
CREATE INDEX IF NOT EXISTS idx_trend_events_rank_score ON public.trend_events(rank_score DESC) WHERE is_trending = true;
CREATE INDEX IF NOT EXISTS idx_trend_events_true_z_score ON public.trend_events(true_z_score DESC) WHERE is_trending = true;

-- Add comments for documentation
COMMENT ON COLUMN public.trend_baselines.hourly_std_dev IS 'Standard deviation of hourly mention counts over the baseline period';
COMMENT ON COLUMN public.trend_baselines.relative_std_dev IS 'Relative standard deviation (std_dev/mean) - lower values indicate stable/evergreen topics';
COMMENT ON COLUMN public.trend_baselines.is_stable IS 'True if RSD < 0.4, indicating an evergreen/always-on topic';
COMMENT ON COLUMN public.trend_events.true_z_score IS 'True statistical z-score: (current - mean) / std_dev';
COMMENT ON COLUMN public.trend_events.poisson_surprise IS 'Poisson surprise score: -log(P(X >= current | lambda = baseline))';
COMMENT ON COLUMN public.trend_events.is_evergreen_detected IS 'True if topic detected as evergreen based on stability metrics';