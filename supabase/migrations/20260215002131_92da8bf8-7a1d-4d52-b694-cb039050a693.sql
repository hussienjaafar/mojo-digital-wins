
-- ============================================================
-- Phase 1: Lead-to-Call Velocity Funnel Tables
-- ============================================================

-- 1. content_optimization — A/B variant copy for each funnel step
CREATE TABLE public.content_optimization (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  step_key text NOT NULL,
  variant_label text NOT NULL,
  headline_text text NOT NULL,
  subheadline_text text,
  cta_text text NOT NULL,
  body_content jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.content_optimization ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active content" ON public.content_optimization
  FOR SELECT USING (true);

CREATE POLICY "Only admins can manage content" ON public.content_optimization
  FOR ALL USING (is_system_admin());

-- 2. funnel_sessions — Visitor session tracking + attribution
CREATE TABLE public.funnel_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id text NOT NULL UNIQUE,
  variant_label text NOT NULL,
  segment text,
  selected_channels text[],
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  device_type text NOT NULL DEFAULT 'desktop',
  fb_pixel_id text,
  ip_address text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  lead_id uuid
);

ALTER TABLE public.funnel_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert funnel sessions" ON public.funnel_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Only admins can read funnel sessions" ON public.funnel_sessions
  FOR SELECT USING (is_system_admin());

CREATE POLICY "Anyone can update own session" ON public.funnel_sessions
  FOR UPDATE USING (true);

-- 3. funnel_analytics — Step-level interaction logging
CREATE TABLE public.funnel_analytics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id text NOT NULL,
  step_key text NOT NULL,
  step_number integer NOT NULL,
  action text NOT NULL,
  variant_label text NOT NULL,
  segment text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.funnel_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert analytics" ON public.funnel_analytics
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Only admins can read analytics" ON public.funnel_analytics
  FOR SELECT USING (is_system_admin());

-- 4. funnel_leads — Qualified + abandoned leads with PII protection
CREATE TABLE public.funnel_leads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id text NOT NULL UNIQUE,
  segment text,
  variant_label text,
  name text,
  email text,
  email_hash text,
  organization text,
  role text,
  is_decision_maker boolean NOT NULL DEFAULT false,
  budget_range text,
  selected_channels text[],
  buying_authority_info text,
  performance_kpis text[],
  utm_source text,
  utm_campaign text,
  lead_score integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'incomplete',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.funnel_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_leads FORCE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert leads" ON public.funnel_leads
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update leads by session" ON public.funnel_leads
  FOR UPDATE USING (true);

CREATE POLICY "Only PII-authorized can read leads" ON public.funnel_leads
  FOR SELECT USING (has_pii_access());

-- ============================================================
-- Seed A/B variant copy for all 8 step keys
-- ============================================================
INSERT INTO public.content_optimization (step_key, variant_label, headline_text, subheadline_text, cta_text, body_content) VALUES
  ('welcome', 'A', '$170.8 Billion. One Platform.', 'Reach the fastest-growing consumer market in America — with precision, not guesswork.', 'Get Started', null),
  ('welcome', 'B', 'The Market Leaders Can''t See.', 'While competitors spray and pray, you''ll reach 7.2M households with surgical accuracy.', 'Show Me How', null),
  ('segment_select', 'A', 'How Can We Help You Win?', 'Choose your path to precision audience engagement.', 'Continue', null),
  ('segment_select', 'B', 'What''s Your Mission?', 'Select your vertical and we''ll tailor your strategy.', 'Next', null),
  ('commercial_opportunity', 'A', 'Generation M Meets Total Market Saturation', '26% are aged 18–24. 92% say cultural relevance drives purchase decisions.', 'See the Proof', '{"stats": [{"value": "$170.8B", "label": "Annual Spending Power"}, {"value": "26%", "label": "Aged 18-24"}, {"value": "92%", "label": "Cultural Relevance Factor"}]}'),
  ('commercial_opportunity', 'B', 'The $170.8B Blind Spot', 'Your competitors are leaving billions on the table.', 'Show Me the Data', '{"stats": [{"value": "$170.8B", "label": "Annual Spending Power"}, {"value": "7.2M", "label": "U.S. Households"}, {"value": "40%", "label": "Wasted by General Buys"}]}'),
  ('political_opportunity', 'A', '1:1 Household Precision. Zero Guesswork.', 'Streaming reaches 33% more swing voters than linear TV.', 'See the Proof', '{"stats": [{"value": "33%", "label": "More Swing Voters via CTV"}, {"value": "Tag 57", "label": "USPS Priority Delivery"}, {"value": "40%", "label": "Accuracy Tax Eliminated"}]}'),
  ('political_opportunity', 'B', 'Every Door. Every Screen. Every Vote.', 'Eliminate the 40% accuracy tax with voter-file precision.', 'Show Me How', '{"stats": [{"value": "40%", "label": "Accuracy Tax Eliminated"}, {"value": "1:1", "label": "Household Targeting"}, {"value": "33%", "label": "More Swing Voters"}]}'),
  ('commercial_proof', 'A', 'Trusted by 50+ National Organizations', 'HIPAA-compliant data. Retail media integration. Cultural CTV precision.', 'I''m Ready', null),
  ('commercial_proof', 'B', 'Built for the Fortune 500. Priced for Growth.', 'From CPG to healthcare — verified reach, zero waste.', 'Let''s Talk', null),
  ('political_proof', 'A', 'Campaign-Grade Intelligence', 'National Voter File. FEC-compliant. Verified delivery.', 'Qualify My Campaign', null),
  ('political_proof', 'B', 'Your Data Advantage Starts Here', 'Cross-reference voter files with cultural affinity data.', 'Get Started', null),
  ('qualification', 'A', 'Let''s Build Your Strategy', 'Tell us about your goals and we''ll match you with the right channels.', 'Submit & Connect', null),
  ('qualification', 'B', 'You''re Almost There', 'A few details and we''ll have a custom proposal ready within 24 hours.', 'Get My Proposal', null),
  ('thank_you', 'A', 'You''re In. Let''s Move Fast.', 'Our team is reviewing your profile now.', 'Book a Call Now', null),
  ('thank_you', 'B', 'Welcome to the Inner Circle', 'We''ll be in touch within 24 hours with a tailored strategy.', 'Follow Us', null);

-- Indexes
CREATE INDEX idx_content_optimization_step_variant ON public.content_optimization (step_key, variant_label) WHERE is_active = true;
CREATE INDEX idx_funnel_sessions_session_id ON public.funnel_sessions (session_id);
CREATE INDEX idx_funnel_analytics_session_id ON public.funnel_analytics (session_id);
CREATE INDEX idx_funnel_leads_session_id ON public.funnel_leads (session_id);
CREATE INDEX idx_funnel_leads_status ON public.funnel_leads (status);
