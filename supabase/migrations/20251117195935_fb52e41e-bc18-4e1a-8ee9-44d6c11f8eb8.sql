-- Create table for congressional bills
CREATE TABLE IF NOT EXISTS public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number TEXT NOT NULL UNIQUE,
  bill_type TEXT NOT NULL,
  congress INTEGER NOT NULL,
  title TEXT NOT NULL,
  short_title TEXT,
  origin_chamber TEXT,
  introduced_date DATE,
  latest_action_date DATE,
  latest_action_text TEXT,
  current_status TEXT,
  sponsor_id TEXT,
  sponsor_name TEXT,
  sponsor_party TEXT,
  sponsor_state TEXT,
  cosponsor_count INTEGER DEFAULT 0,
  cosponsor_party_breakdown JSONB DEFAULT '{}'::jsonb,
  committee_assignments TEXT[],
  related_bills TEXT[],
  bill_text_url TEXT,
  relevance_score INTEGER DEFAULT 0,
  full_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create table for bill actions/history
CREATE TABLE IF NOT EXISTS public.bill_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID REFERENCES public.bills(id) ON DELETE CASCADE,
  action_date DATE NOT NULL,
  action_text TEXT NOT NULL,
  action_code TEXT,
  chamber TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create table for user bill alerts
CREATE TABLE IF NOT EXISTS public.bill_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  bill_id UUID REFERENCES public.bills(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL DEFAULT 'status_change',
  is_active BOOLEAN DEFAULT true,
  last_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, bill_id, alert_type)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bills_congress ON public.bills(congress);
CREATE INDEX IF NOT EXISTS idx_bills_status ON public.bills(current_status);
CREATE INDEX IF NOT EXISTS idx_bills_relevance ON public.bills(relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_bills_introduced_date ON public.bills(introduced_date DESC);
CREATE INDEX IF NOT EXISTS idx_bill_actions_bill_id ON public.bill_actions(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_actions_date ON public.bill_actions(action_date DESC);
CREATE INDEX IF NOT EXISTS idx_bill_alerts_user_id ON public.bill_alerts(user_id);

-- Enable RLS
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bills (public read)
CREATE POLICY "Anyone can view bills"
  ON public.bills FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage bills"
  ON public.bills FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for bill actions (public read)
CREATE POLICY "Anyone can view bill actions"
  ON public.bill_actions FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage bill actions"
  ON public.bill_actions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for bill alerts (user-specific)
CREATE POLICY "Users can view own alerts"
  ON public.bill_alerts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own alerts"
  ON public.bill_alerts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own alerts"
  ON public.bill_alerts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own alerts"
  ON public.bill_alerts FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_bills_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bills_updated_at
  BEFORE UPDATE ON public.bills
  FOR EACH ROW
  EXECUTE FUNCTION update_bills_updated_at();