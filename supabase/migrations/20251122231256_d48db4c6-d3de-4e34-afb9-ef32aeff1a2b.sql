-- Week 4: Advanced Analytics Tables

-- Daily sentiment snapshots for tracking trends
CREATE TABLE IF NOT EXISTS public.sentiment_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  affected_group TEXT NOT NULL,
  platform TEXT NOT NULL, -- 'news', 'bluesky', 'combined'
  positive_count INTEGER DEFAULT 0,
  neutral_count INTEGER DEFAULT 0,
  negative_count INTEGER DEFAULT 0,
  avg_sentiment NUMERIC,
  total_mentions INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(snapshot_date, affected_group, platform)
);

-- Anomaly detection results
CREATE TABLE IF NOT EXISTS public.detected_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  anomaly_type TEXT NOT NULL, -- 'topic_velocity', 'sentiment_shift', 'mention_spike'
  entity_type TEXT NOT NULL, -- 'topic', 'group', 'bill', 'executive_order'
  entity_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  z_score NUMERIC NOT NULL,
  baseline_value NUMERIC,
  current_value NUMERIC,
  severity TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  alert_sent BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sentiment_snapshots_date ON public.sentiment_snapshots(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_sentiment_snapshots_group ON public.sentiment_snapshots(affected_group);
CREATE INDEX IF NOT EXISTS idx_sentiment_snapshots_platform ON public.sentiment_snapshots(platform);
CREATE INDEX IF NOT EXISTS idx_sentiment_snapshots_lookup ON public.sentiment_snapshots(snapshot_date, affected_group, platform);

CREATE INDEX IF NOT EXISTS idx_anomalies_detected ON public.detected_anomalies(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomalies_type ON public.detected_anomalies(anomaly_type);
CREATE INDEX IF NOT EXISTS idx_anomalies_entity ON public.detected_anomalies(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_severity ON public.detected_anomalies(severity) WHERE alert_sent = false;
CREATE INDEX IF NOT EXISTS idx_anomalies_unresolved ON public.detected_anomalies(detected_at DESC) WHERE resolved_at IS NULL;

-- RLS Policies
ALTER TABLE public.sentiment_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detected_anomalies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view sentiment snapshots"
  ON public.sentiment_snapshots FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view anomalies"
  ON public.detected_anomalies FOR SELECT
  USING (true);

CREATE POLICY "Service can manage sentiment snapshots"
  ON public.sentiment_snapshots FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service can manage anomalies"
  ON public.detected_anomalies FOR ALL
  USING (true)
  WITH CHECK (true);