
-- Phase 1: Funnel Intelligence Tables

-- 1. funnel_step_metrics
CREATE TABLE public.funnel_step_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  variant_label TEXT NOT NULL,
  segment TEXT,
  step_key TEXT NOT NULL,
  step_number INT NOT NULL,
  views INT NOT NULL DEFAULT 0,
  completions INT NOT NULL DEFAULT 0,
  conversion_rate NUMERIC(5,4) NOT NULL DEFAULT 0,
  avg_duration_ms INT,
  drop_off_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_funnel_step_metrics_unique ON public.funnel_step_metrics (date, variant_label, segment, step_key);
CREATE INDEX idx_funnel_step_metrics_date ON public.funnel_step_metrics (date);
ALTER TABLE public.funnel_step_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin read funnel_step_metrics" ON public.funnel_step_metrics
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- 2. funnel_field_interactions
CREATE TABLE public.funnel_field_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  interaction_type TEXT NOT NULL,
  time_spent_ms INT,
  had_error BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_field_interactions_session ON public.funnel_field_interactions (session_id);
CREATE INDEX idx_field_interactions_field ON public.funnel_field_interactions (field_name);
ALTER TABLE public.funnel_field_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon insert field interactions" ON public.funnel_field_interactions
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin read field interactions" ON public.funnel_field_interactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- 3. funnel_variant_performance
CREATE TABLE public.funnel_variant_performance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  step_key TEXT NOT NULL,
  variant_label TEXT NOT NULL,
  impressions INT NOT NULL DEFAULT 0,
  conversions INT NOT NULL DEFAULT 0,
  alpha NUMERIC(10,2) NOT NULL DEFAULT 1,
  beta NUMERIC(10,2) NOT NULL DEFAULT 1,
  traffic_weight NUMERIC(5,4) NOT NULL DEFAULT 0.5,
  is_champion BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_variant_performance_unique ON public.funnel_variant_performance (step_key, variant_label);
ALTER TABLE public.funnel_variant_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin read variant performance" ON public.funnel_variant_performance
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Anon read variant weights" ON public.funnel_variant_performance
  FOR SELECT USING (true);

-- 4. funnel_copy_generations
CREATE TABLE public.funnel_copy_generations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  step_key TEXT NOT NULL,
  variant_label TEXT NOT NULL,
  headline_text TEXT NOT NULL,
  subheadline_text TEXT,
  cta_text TEXT NOT NULL,
  generation_prompt TEXT,
  parent_variant TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.funnel_copy_generations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage copy generations" ON public.funnel_copy_generations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- 5. Add columns to content_optimization
ALTER TABLE public.content_optimization
  ADD COLUMN IF NOT EXISTS impressions INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conversions INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS traffic_weight NUMERIC(5,4) NOT NULL DEFAULT 0.5;

-- 6. Add columns to funnel_analytics
ALTER TABLE public.funnel_analytics
  ADD COLUMN IF NOT EXISTS duration_ms INT,
  ADD COLUMN IF NOT EXISTS exit_type TEXT;

-- Seed initial bandit state
INSERT INTO public.funnel_variant_performance (step_key, variant_label, alpha, beta, traffic_weight)
SELECT DISTINCT step_key, variant_label, 1, 1, 0.5
FROM public.content_optimization
WHERE is_active = true
ON CONFLICT DO NOTHING;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.funnel_variant_performance;
