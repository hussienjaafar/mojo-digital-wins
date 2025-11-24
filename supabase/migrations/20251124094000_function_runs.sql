-- Function runs metrics table
CREATE TABLE IF NOT EXISTS public.function_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  success BOOLEAN,
  items_processed INTEGER,
  items_created INTEGER,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_function_runs_name_time ON public.function_runs(function_name, started_at DESC);
