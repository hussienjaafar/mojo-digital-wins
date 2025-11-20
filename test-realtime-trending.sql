-- Test Script for Real-Time Trending Topics
-- Run these queries in Supabase SQL Editor to test the live dashboard

-- ============================================
-- TEST 1: Single Article Insert
-- ============================================
-- This will trigger a toast notification and update trending topics
INSERT INTO articles (
  title,
  url,
  source_name,
  published_date,
  tags,
  sentiment_label,
  sentiment_score,
  threat_level,
  content_summary
) VALUES (
  'Breaking: Supreme Court Rules on Voting Rights Act',
  'https://example.com/voting-rights-ruling',
  'Political News Network',
  NOW(),
  ARRAY['voting rights', 'supreme court', 'democracy'],
  'negative',
  0.25,
  'critical',
  'Supreme Court decision impacts voting access for millions'
);

-- ============================================
-- TEST 2: Make a Topic Trend (Multiple Articles)
-- ============================================
-- Insert several articles about "immigration" to make it trend
INSERT INTO articles (title, url, source_name, published_date, tags, sentiment_label, sentiment_score, threat_level, content_summary)
VALUES
  (
    'New Immigration Policy Targets Asylum Seekers',
    'https://example.com/immigration-1',
    'National News',
    NOW(),
    ARRAY['immigration', 'asylum', 'policy'],
    'negative',
    0.3,
    'high',
    'New restrictions on asylum applications announced'
  ),
  (
    'Civil Rights Groups Challenge Immigration Rules',
    'https://example.com/immigration-2',
    'Legal Times',
    NOW(),
    ARRAY['immigration', 'civil rights', 'legal'],
    'neutral',
    0.5,
    'medium',
    'Multiple organizations file lawsuits against new immigration policies'
  ),
  (
    'Protests Erupt Over Immigration Enforcement',
    'https://example.com/immigration-3',
    'City Observer',
    NOW(),
    ARRAY['immigration', 'protests', 'activism'],
    'negative',
    0.35,
    'high',
    'Nationwide demonstrations against immigration enforcement policies'
  ),
  (
    'Immigrant Rights Organizations Rally Support',
    'https://example.com/immigration-4',
    'Community Voice',
    NOW(),
    ARRAY['immigration', 'activism', 'solidarity'],
    'positive',
    0.7,
    'medium',
    'Community organizations mobilize to support immigrant families'
  );

-- ============================================
-- TEST 3: Create a Rising Positive Trend
-- ============================================
-- Insert articles with increasingly positive sentiment
INSERT INTO articles (title, url, source_name, published_date, tags, sentiment_label, sentiment_score, threat_level, content_summary)
VALUES
  (
    'Climate Action Bill Gains Bipartisan Support',
    'https://example.com/climate-1',
    'Environmental News',
    NOW() - INTERVAL '2 hours',
    ARRAY['climate', 'environment', 'legislation'],
    'neutral',
    0.5,
    'low',
    'New climate legislation proposed in Congress'
  ),
  (
    'Major Environmental Groups Endorse Climate Bill',
    'https://example.com/climate-2',
    'Green Today',
    NOW() - INTERVAL '1 hour',
    ARRAY['climate', 'environment', 'endorsement'],
    'positive',
    0.7,
    'low',
    'Coalition of environmental organizations support new climate legislation'
  ),
  (
    'Climate Bill Expected to Pass with Strong Majority',
    'https://example.com/climate-3',
    'Political Insider',
    NOW(),
    ARRAY['climate', 'legislation', 'politics'],
    'positive',
    0.85,
    'low',
    'Analysts predict climate bill will pass both chambers'
  );

-- ============================================
-- TEST 4: Mixed Sentiment on Same Topic
-- ============================================
-- Test sentiment analysis with diverse opinions
INSERT INTO articles (title, url, source_name, published_date, tags, sentiment_label, sentiment_score, threat_level, content_summary)
VALUES
  (
    'Healthcare Reform Bill Advances in Senate',
    'https://example.com/healthcare-1',
    'Health Policy Review',
    NOW(),
    ARRAY['healthcare', 'legislation', 'senate'],
    'positive',
    0.75,
    'medium',
    'Major healthcare reform legislation moves forward'
  ),
  (
    'Critics Raise Concerns Over Healthcare Bill Costs',
    'https://example.com/healthcare-2',
    'Fiscal Watch',
    NOW(),
    ARRAY['healthcare', 'budget', 'legislation'],
    'negative',
    0.35,
    'medium',
    'Budget analysts question funding mechanisms for healthcare reform'
  ),
  (
    'Healthcare Bill Includes Mental Health Provisions',
    'https://example.com/healthcare-3',
    'Wellness Magazine',
    NOW(),
    ARRAY['healthcare', 'mental health', 'legislation'],
    'positive',
    0.8,
    'low',
    'New legislation includes expanded mental health coverage'
  ),
  (
    'Healthcare Groups Divided on Reform Proposal',
    'https://example.com/healthcare-4',
    'Medical Journal',
    NOW(),
    ARRAY['healthcare', 'medical', 'debate'],
    'neutral',
    0.5,
    'low',
    'Medical associations show mixed reactions to healthcare reform bill'
  );

-- ============================================
-- TEST 5: Critical Threat Level Articles
-- ============================================
-- Test high-priority article tracking
INSERT INTO articles (title, url, source_name, published_date, tags, sentiment_label, sentiment_score, threat_level, content_summary, affected_organizations)
VALUES
  (
    'Federal Surveillance Program Expands Scope',
    'https://example.com/surveillance-1',
    'Privacy Today',
    NOW(),
    ARRAY['surveillance', 'privacy', 'civil liberties'],
    'negative',
    0.15,
    'critical',
    'New surveillance capabilities raise privacy concerns for civil liberties groups',
    ARRAY['ACLU', 'EFF', 'Privacy International']
  ),
  (
    'Data Collection Practices Under Investigation',
    'https://example.com/privacy-2',
    'Tech Rights',
    NOW(),
    ARRAY['privacy', 'data protection', 'investigation'],
    'negative',
    0.3,
    'high',
    'Federal investigation into tech company data collection practices begins'
  );

-- ============================================
-- TEST 6: Rapid-Fire Inserts (Stress Test)
-- ============================================
-- Test system with multiple quick inserts
DO $$
DECLARE
  i INTEGER;
BEGIN
  FOR i IN 1..5 LOOP
    INSERT INTO articles (title, url, source_name, published_date, tags, sentiment_label, sentiment_score, content_summary)
    VALUES (
      'Breaking News Update #' || i,
      'https://example.com/breaking-' || i,
      'News Network ' || i,
      NOW(),
      ARRAY['breaking news', 'politics', 'update'],
      CASE
        WHEN i % 3 = 0 THEN 'positive'
        WHEN i % 3 = 1 THEN 'negative'
        ELSE 'neutral'
      END,
      (i::float / 10),
      'Breaking news story number ' || i
    );
  END LOOP;
END $$;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check recent articles (last 10 minutes)
SELECT
  title,
  source_name,
  tags,
  sentiment_label,
  sentiment_score,
  threat_level,
  published_date
FROM articles
WHERE published_date > NOW() - INTERVAL '10 minutes'
ORDER BY published_date DESC;

-- View trending topics (manual calculation)
SELECT
  unnest(tags) as topic,
  COUNT(*) as mention_count,
  AVG(sentiment_score) as avg_sentiment,
  COUNT(CASE WHEN sentiment_label = 'positive' THEN 1 END) as positive_count,
  COUNT(CASE WHEN sentiment_label = 'neutral' THEN 1 END) as neutral_count,
  COUNT(CASE WHEN sentiment_label = 'negative' THEN 1 END) as negative_count
FROM articles
WHERE published_date > NOW() - INTERVAL '7 days'
GROUP BY topic
ORDER BY mention_count DESC
LIMIT 15;

-- Check articles by threat level
SELECT
  threat_level,
  COUNT(*) as count,
  AVG(sentiment_score) as avg_sentiment
FROM articles
WHERE published_date > NOW() - INTERVAL '7 days'
GROUP BY threat_level
ORDER BY
  CASE threat_level
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END;

-- ============================================
-- CLEANUP (Optional)
-- ============================================
-- Uncomment to remove test data

-- DELETE FROM articles
-- WHERE url LIKE 'https://example.com/%'
--   AND published_date > NOW() - INTERVAL '1 hour';
