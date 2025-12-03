-- Phase 1: Creative Intelligence System Database Schema

-- 1. SMS Creative Insights Table
CREATE TABLE public.sms_creative_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT,
  
  -- Creative Content
  message_text TEXT NOT NULL,
  
  -- AI Analysis
  topic TEXT,
  tone TEXT,
  sentiment_score NUMERIC,
  sentiment_label TEXT,
  call_to_action TEXT,
  urgency_level TEXT,
  key_themes TEXT[] DEFAULT '{}',
  
  -- Timing
  send_hour INTEGER,
  send_day_of_week INTEGER,
  send_date DATE,
  
  -- Performance Metrics
  messages_sent INTEGER DEFAULT 0,
  messages_delivered INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  amount_raised NUMERIC DEFAULT 0,
  click_rate NUMERIC,
  conversion_rate NUMERIC,
  
  -- Metadata
  analyzed_at TIMESTAMP WITH TIME ZONE,
  ai_model_used TEXT,
  analysis_confidence NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Meta Creative Insights Table
CREATE TABLE public.meta_creative_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  ad_id TEXT,
  creative_id TEXT,
  
  -- Creative Content
  primary_text TEXT,
  headline TEXT,
  description TEXT,
  call_to_action_type TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  creative_type TEXT,
  
  -- Audio Transcription (for video ads)
  audio_transcript TEXT,
  transcript_confidence NUMERIC,
  
  -- AI Analysis
  topic TEXT,
  tone TEXT,
  sentiment_score NUMERIC,
  sentiment_label TEXT,
  urgency_level TEXT,
  emotional_appeal TEXT,
  key_themes TEXT[] DEFAULT '{}',
  
  -- Performance Metrics
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  spend NUMERIC DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  conversion_value NUMERIC DEFAULT 0,
  ctr NUMERIC,
  roas NUMERIC,
  
  -- Metadata
  analyzed_at TIMESTAMP WITH TIME ZONE,
  ai_model_used TEXT,
  analysis_confidence NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Creative Performance Learnings Table (for aggregated patterns)
CREATE TABLE public.creative_performance_learnings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.client_organizations(id) ON DELETE CASCADE, -- NULL for global patterns
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'meta')),
  
  -- Pattern Attributes
  topic TEXT,
  tone TEXT,
  urgency_level TEXT,
  call_to_action TEXT,
  emotional_appeal TEXT,
  optimal_hour INTEGER,
  optimal_day INTEGER,
  
  -- Performance Metrics
  sample_size INTEGER DEFAULT 0,
  avg_click_rate NUMERIC,
  avg_conversion_rate NUMERIC,
  avg_roas NUMERIC,
  avg_amount_raised NUMERIC,
  
  -- Scores
  effectiveness_score NUMERIC, -- 0-100
  confidence_level NUMERIC, -- 0-1
  
  -- Time Period
  period_start DATE,
  period_end DATE,
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_sms_creative_insights_org ON public.sms_creative_insights(organization_id);
CREATE INDEX idx_sms_creative_insights_campaign ON public.sms_creative_insights(campaign_id);
CREATE INDEX idx_sms_creative_insights_topic ON public.sms_creative_insights(topic);
CREATE INDEX idx_sms_creative_insights_analyzed ON public.sms_creative_insights(analyzed_at);

CREATE INDEX idx_meta_creative_insights_org ON public.meta_creative_insights(organization_id);
CREATE INDEX idx_meta_creative_insights_campaign ON public.meta_creative_insights(campaign_id);
CREATE INDEX idx_meta_creative_insights_topic ON public.meta_creative_insights(topic);
CREATE INDEX idx_meta_creative_insights_analyzed ON public.meta_creative_insights(analyzed_at);

CREATE INDEX idx_creative_learnings_org ON public.creative_performance_learnings(organization_id);
CREATE INDEX idx_creative_learnings_channel ON public.creative_performance_learnings(channel);
CREATE INDEX idx_creative_learnings_topic ON public.creative_performance_learnings(topic);
CREATE INDEX idx_creative_learnings_global ON public.creative_performance_learnings(organization_id) WHERE organization_id IS NULL;

-- Enable RLS
ALTER TABLE public.sms_creative_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_creative_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_performance_learnings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sms_creative_insights
CREATE POLICY "Users can view own org SMS insights"
  ON public.sms_creative_insights FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can view all SMS insights"
  ON public.sms_creative_insights FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage SMS insights"
  ON public.sms_creative_insights FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for meta_creative_insights
CREATE POLICY "Users can view own org Meta insights"
  ON public.meta_creative_insights FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can view all Meta insights"
  ON public.meta_creative_insights FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage Meta insights"
  ON public.meta_creative_insights FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for creative_performance_learnings
CREATE POLICY "Users can view own org learnings"
  ON public.creative_performance_learnings FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can view global learnings"
  ON public.creative_performance_learnings FOR SELECT
  USING (organization_id IS NULL);

CREATE POLICY "Admins can view all learnings"
  ON public.creative_performance_learnings FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage learnings"
  ON public.creative_performance_learnings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Update timestamp triggers
CREATE TRIGGER update_sms_creative_insights_updated_at
  BEFORE UPDATE ON public.sms_creative_insights
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meta_creative_insights_updated_at
  BEFORE UPDATE ON public.meta_creative_insights
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_creative_learnings_updated_at
  BEFORE UPDATE ON public.creative_performance_learnings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();