-- Create generated_campaign_messages table
CREATE TABLE IF NOT EXISTS public.generated_campaign_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  entity_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  message_text TEXT NOT NULL,
  message_approach TEXT,
  predicted_performance NUMERIC,
  variant_number INTEGER,
  context_used JSONB,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  was_used BOOLEAN DEFAULT false,
  actual_performance NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create send_time_optimizations table
CREATE TABLE IF NOT EXISTS public.send_time_optimizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  best_hours_of_day INTEGER[],
  best_days_of_week TEXT[],
  optimal_windows JSONB,
  hourly_performance JSONB,
  daily_performance JSONB,
  analyzed_at TIMESTAMPTZ NOT NULL,
  sample_size INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_generated_messages_org ON public.generated_campaign_messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_generated_messages_entity ON public.generated_campaign_messages(entity_name);
CREATE INDEX IF NOT EXISTS idx_generated_messages_generated_at ON public.generated_campaign_messages(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_send_time_org ON public.send_time_optimizations(organization_id);

-- Enable RLS
ALTER TABLE public.generated_campaign_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.send_time_optimizations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for generated_campaign_messages
CREATE POLICY "Admin users can view all messages" ON public.generated_campaign_messages
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Client users can view their org messages" ON public.generated_campaign_messages
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

-- RLS Policies for send_time_optimizations
CREATE POLICY "Admin users can view all optimizations" ON public.send_time_optimizations
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Client users can view their org optimizations" ON public.send_time_optimizations
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());