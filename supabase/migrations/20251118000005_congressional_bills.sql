-- Congressional Bill Tracking System
-- Tracks bills moving through Congress that are relevant to civil liberties

-- Bills table
CREATE TABLE IF NOT EXISTS bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number TEXT NOT NULL UNIQUE,
  bill_type TEXT NOT NULL, -- hr, s, hjres, sjres, hconres, sconres, hres, sres
  congress INTEGER NOT NULL,
  title TEXT NOT NULL,
  short_title TEXT,
  origin_chamber TEXT, -- House or Senate
  introduced_date DATE,
  latest_action_date DATE,
  latest_action_text TEXT,
  current_status TEXT DEFAULT 'introduced', -- introduced, in_committee, passed_house, passed_senate, passed_both, enacted, vetoed

  -- Sponsor information
  sponsor_id TEXT,
  sponsor_name TEXT,
  sponsor_party TEXT,
  sponsor_state TEXT,

  -- Cosponsors
  cosponsor_count INTEGER DEFAULT 0,
  cosponsor_party_breakdown JSONB DEFAULT '{}',

  -- Committee and progress tracking
  committee_assignments TEXT[] DEFAULT '{}',
  related_bills TEXT[] DEFAULT '{}',

  -- URLs
  bill_text_url TEXT,
  congress_gov_url TEXT,

  -- Relevance scoring
  relevance_score INTEGER DEFAULT 0,
  threat_level TEXT DEFAULT 'low', -- critical, high, medium, low
  auto_tags TEXT[] DEFAULT '{}',

  -- Tracking
  is_bookmarked BOOLEAN DEFAULT FALSE,
  user_notes TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bill actions/history table
CREATE TABLE IF NOT EXISTS bill_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID REFERENCES bills(id) ON DELETE CASCADE,
  action_date DATE NOT NULL,
  action_text TEXT NOT NULL,
  action_code TEXT,
  chamber TEXT, -- House, Senate
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bill votes table
CREATE TABLE IF NOT EXISTS bill_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID REFERENCES bills(id) ON DELETE CASCADE,
  chamber TEXT NOT NULL, -- House, Senate
  vote_date DATE NOT NULL,
  vote_type TEXT, -- passage, amendment, cloture, etc.
  result TEXT NOT NULL, -- passed, failed
  yea_count INTEGER,
  nay_count INTEGER,
  not_voting INTEGER,
  vote_breakdown JSONB DEFAULT '{}', -- party breakdown
  roll_call_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User bill tracking (for bookmarks and notes per user)
CREATE TABLE IF NOT EXISTS user_bill_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  bill_id UUID REFERENCES bills(id) ON DELETE CASCADE,
  is_bookmarked BOOLEAN DEFAULT FALSE,
  notes TEXT,
  alert_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, bill_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bills_congress ON bills(congress);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(current_status);
CREATE INDEX IF NOT EXISTS idx_bills_relevance ON bills(relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_bills_introduced_date ON bills(introduced_date DESC);
CREATE INDEX IF NOT EXISTS idx_bills_latest_action ON bills(latest_action_date DESC);
CREATE INDEX IF NOT EXISTS idx_bills_sponsor_party ON bills(sponsor_party);
CREATE INDEX IF NOT EXISTS idx_bills_threat_level ON bills(threat_level);
CREATE INDEX IF NOT EXISTS idx_bill_actions_bill_id ON bill_actions(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_actions_date ON bill_actions(action_date DESC);
CREATE INDEX IF NOT EXISTS idx_bill_votes_bill_id ON bill_votes(bill_id);
CREATE INDEX IF NOT EXISTS idx_user_bill_tracking_user ON user_bill_tracking(user_id);

-- Enable RLS
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_bill_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Bills and actions are public read, admin write
CREATE POLICY "Bills are viewable by authenticated users"
  ON bills FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Bills are insertable by service role"
  ON bills FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Bills are updatable by service role"
  ON bills FOR UPDATE
  TO service_role
  USING (true);

CREATE POLICY "Bill actions are viewable by authenticated users"
  ON bill_actions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Bill actions are insertable by service role"
  ON bill_actions FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Bill actions are deletable by service role"
  ON bill_actions FOR DELETE
  TO service_role
  USING (true);

CREATE POLICY "Bill votes are viewable by authenticated users"
  ON bill_votes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Bill votes are insertable by service role"
  ON bill_votes FOR INSERT
  TO service_role
  WITH CHECK (true);

-- User tracking: users can manage their own
CREATE POLICY "Users can view their own bill tracking"
  ON user_bill_tracking FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bill tracking"
  ON user_bill_tracking FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bill tracking"
  ON user_bill_tracking FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bill tracking"
  ON user_bill_tracking FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to update threat level based on relevance and status
CREATE OR REPLACE FUNCTION update_bill_threat_level()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate threat level based on relevance score and bill progress
  IF NEW.relevance_score >= 50 THEN
    IF NEW.current_status IN ('passed_house', 'passed_senate', 'passed_both') THEN
      NEW.threat_level := 'critical';
    ELSE
      NEW.threat_level := 'high';
    END IF;
  ELSIF NEW.relevance_score >= 30 THEN
    IF NEW.current_status IN ('passed_house', 'passed_senate', 'passed_both') THEN
      NEW.threat_level := 'high';
    ELSE
      NEW.threat_level := 'medium';
    END IF;
  ELSIF NEW.relevance_score >= 15 THEN
    NEW.threat_level := 'medium';
  ELSE
    NEW.threat_level := 'low';
  END IF;

  -- Generate Congress.gov URL
  NEW.congress_gov_url := 'https://www.congress.gov/bill/' || NEW.congress || 'th-congress/' ||
    CASE
      WHEN NEW.bill_type = 'hr' THEN 'house-bill'
      WHEN NEW.bill_type = 's' THEN 'senate-bill'
      WHEN NEW.bill_type = 'hjres' THEN 'house-joint-resolution'
      WHEN NEW.bill_type = 'sjres' THEN 'senate-joint-resolution'
      ELSE NEW.bill_type
    END || '/' || REGEXP_REPLACE(NEW.bill_number, '[^0-9]', '', 'g');

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update threat level
DROP TRIGGER IF EXISTS bill_threat_level_trigger ON bills;
CREATE TRIGGER bill_threat_level_trigger
  BEFORE INSERT OR UPDATE ON bills
  FOR EACH ROW
  EXECUTE FUNCTION update_bill_threat_level();

-- View for bills with action count
CREATE OR REPLACE VIEW bills_with_progress AS
SELECT
  b.*,
  COUNT(ba.id) AS action_count,
  (
    SELECT json_agg(
      json_build_object(
        'date', ba2.action_date,
        'text', ba2.action_text,
        'chamber', ba2.chamber
      ) ORDER BY ba2.action_date DESC
    )
    FROM bill_actions ba2
    WHERE ba2.bill_id = b.id
    LIMIT 5
  ) AS recent_actions
FROM bills b
LEFT JOIN bill_actions ba ON b.id = ba.bill_id
GROUP BY b.id;

-- Grant access to the view
GRANT SELECT ON bills_with_progress TO authenticated;

-- Add to critical_alerts view (if it exists, we extend it)
-- This ensures high-threat bills appear in the critical alerts
CREATE OR REPLACE VIEW critical_alerts AS
SELECT
  'bill' AS source_type,
  id::text,
  title,
  COALESCE(short_title, LEFT(title, 200)) AS summary,
  introduced_date::text AS date,
  threat_level,
  auto_tags AS affected_organizations,
  congress_gov_url AS url
FROM bills
WHERE threat_level IN ('critical', 'high')
UNION ALL
SELECT
  source_type,
  id,
  title,
  summary,
  date,
  threat_level,
  affected_organizations,
  url
FROM (
  SELECT
    'article' AS source_type,
    id::text,
    title,
    summary,
    published_at::text AS date,
    threat_level,
    affected_organizations,
    url
  FROM rss_articles
  WHERE threat_level IN ('critical', 'high')
) articles
UNION ALL
SELECT
  'executive_order' AS source_type,
  id::text,
  title,
  abstract AS summary,
  signing_date::text AS date,
  threat_level,
  auto_tags AS affected_organizations,
  html_url AS url
FROM executive_orders
WHERE threat_level IN ('critical', 'high')
UNION ALL
SELECT
  'state_action' AS source_type,
  id::text,
  title,
  description AS summary,
  action_date::text AS date,
  threat_level,
  affected_organizations,
  source_url AS url
FROM state_actions
WHERE threat_level IN ('critical', 'high')
ORDER BY date DESC;

GRANT SELECT ON critical_alerts TO authenticated;
