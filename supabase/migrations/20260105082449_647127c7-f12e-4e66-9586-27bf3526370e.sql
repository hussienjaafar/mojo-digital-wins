-- Trend feedback from users
CREATE TABLE public.trend_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trend_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES public.client_organizations(id),
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('relevant', 'not_relevant', 'follow_up')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.trend_feedback ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own feedback"
ON public.trend_feedback FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feedback"
ON public.trend_feedback FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feedback"
ON public.trend_feedback FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own feedback"
ON public.trend_feedback FOR DELETE
USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_trend_feedback_user ON public.trend_feedback(user_id, trend_id);
CREATE INDEX idx_trend_feedback_org ON public.trend_feedback(organization_id, trend_id);