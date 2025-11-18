-- Migration 1: Expand Data Sources
-- Creates executive_orders, state_actions, government_announcements tables

-- Executive Orders table
CREATE TABLE IF NOT EXISTS public.executive_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL,
  title TEXT NOT NULL,
  issuing_authority TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  issued_date DATE NOT NULL,
  effective_date DATE,
  summary TEXT,
  full_text TEXT,
  source_url TEXT,
  relevance_score INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(order_number, jurisdiction)
);

-- State Actions table
CREATE TABLE IF NOT EXISTS public.state_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL,
  action_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT,
  introduced_date DATE,
  effective_date DATE,
  sponsor TEXT,
  summary TEXT,
  source_url TEXT,
  relevance_score INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Government Announcements table
CREATE TABLE IF NOT EXISTS public.government_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency TEXT NOT NULL,
  announcement_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  published_date TIMESTAMPTZ NOT NULL,
  source_url TEXT,
  relevance_score INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.executive_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.state_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.government_announcements ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view executive orders"
  ON public.executive_orders FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage executive orders"
  ON public.executive_orders FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view state actions"
  ON public.state_actions FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage state actions"
  ON public.state_actions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view government announcements"
  ON public.government_announcements FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage government announcements"
  ON public.government_announcements FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes
CREATE INDEX idx_executive_orders_issued_date ON public.executive_orders(issued_date DESC);
CREATE INDEX idx_executive_orders_relevance ON public.executive_orders(relevance_score DESC);
CREATE INDEX idx_state_actions_introduced_date ON public.state_actions(introduced_date DESC);
CREATE INDEX idx_state_actions_state ON public.state_actions(state);
CREATE INDEX idx_government_announcements_published ON public.government_announcements(published_date DESC);