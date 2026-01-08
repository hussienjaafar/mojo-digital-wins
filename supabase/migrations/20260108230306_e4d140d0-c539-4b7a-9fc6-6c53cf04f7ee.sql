-- Create action effectiveness view for learning loop
CREATE OR REPLACE VIEW action_effectiveness_summary AS
SELECT 
  te.event_title as trend_label,
  tao.action_type,
  COUNT(*) as total_actions,
  COUNT(CASE WHEN tao.outcome_type IS NOT NULL AND tao.outcome_type != 'none' THEN 1 END) as successful_actions,
  ROUND(
    (COUNT(CASE WHEN tao.outcome_type IS NOT NULL AND tao.outcome_type != 'none' THEN 1 END)::numeric / 
    NULLIF(COUNT(*), 0)) * 100, 1
  ) as success_rate,
  SUM(COALESCE(tao.outcome_value, 0)) as total_outcome_value,
  AVG(COALESCE(tao.outcome_value, 0)) as avg_outcome_value
FROM trend_action_outcomes tao
LEFT JOIN trend_events te ON te.id = tao.trend_event_id
GROUP BY te.event_title, tao.action_type;

-- Create learning signals table to store pattern weights
CREATE TABLE IF NOT EXISTS learning_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_type TEXT NOT NULL,
  pattern_key TEXT NOT NULL,
  weight_adjustment NUMERIC DEFAULT 0,
  sample_count INTEGER DEFAULT 0,
  last_calculated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  UNIQUE(signal_type, pattern_key)
);

-- Enable RLS
ALTER TABLE learning_signals ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated users
CREATE POLICY "Allow read access to learning signals"
  ON learning_signals
  FOR SELECT
  USING (true);

-- Create semantic clusters table for trend grouping
CREATE TABLE IF NOT EXISTS trend_semantic_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_name TEXT NOT NULL,
  cluster_description TEXT,
  member_trend_ids UUID[] DEFAULT '{}',
  centroid_keywords TEXT[] DEFAULT '{}',
  avg_confidence NUMERIC DEFAULT 0,
  avg_velocity NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE trend_semantic_clusters ENABLE ROW LEVEL SECURITY;

-- Allow read access
CREATE POLICY "Allow read access to semantic clusters"
  ON trend_semantic_clusters
  FOR SELECT
  USING (true);

-- Add cluster reference to trend_events if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trend_events' AND column_name = 'semantic_cluster_id'
  ) THEN
    ALTER TABLE trend_events ADD COLUMN semantic_cluster_id UUID REFERENCES trend_semantic_clusters(id);
  END IF;
END $$;

-- Create index for cluster lookups
CREATE INDEX IF NOT EXISTS idx_trend_events_semantic_cluster ON trend_events(semantic_cluster_id);
CREATE INDEX IF NOT EXISTS idx_learning_signals_pattern ON learning_signals(signal_type, pattern_key);
CREATE INDEX IF NOT EXISTS idx_trend_action_outcomes_trend ON trend_action_outcomes(trend_event_id);
CREATE INDEX IF NOT EXISTS idx_trend_action_outcomes_org ON trend_action_outcomes(organization_id);