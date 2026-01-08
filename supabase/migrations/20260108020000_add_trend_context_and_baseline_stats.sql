-- Add baseline variability fields for true z-score
ALTER TABLE public.trend_baselines
  ADD COLUMN IF NOT EXISTS hourly_std_dev numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS relative_std_dev numeric DEFAULT 0;

-- Add context bundles and label source for trend explainability
ALTER TABLE public.trend_events
  ADD COLUMN IF NOT EXISTS context_terms text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS context_phrases text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS context_summary text,
  ADD COLUMN IF NOT EXISTS label_source text;
