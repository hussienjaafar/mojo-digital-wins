-- Phase 1: Update discover_trending_keywords to prioritize phrases and filter noise
CREATE OR REPLACE FUNCTION public.discover_trending_keywords(
  time_window interval DEFAULT '06:00:00'::interval,
  min_frequency integer DEFAULT 20
) RETURNS TABLE (keyword text, frequency bigint, source_type text)
LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  RETURN QUERY
  -- Known entity single words (curated list - always reliable)
  WITH known_entity_words AS (
    SELECT 
      word as kw,
      COUNT(*) as freq,
      'known_entity' as src
    FROM (
      SELECT regexp_split_to_table(
        regexp_replace(text, '[^a-zA-Z\s]', ' ', 'g'),
        '\s+'
      ) as word
      FROM bluesky_posts
      WHERE created_at > NOW() - time_window
        AND text IS NOT NULL
    ) words
    WHERE word IN (
      -- Known political figures (single name recognition)
      'Trump', 'Biden', 'Harris', 'Obama', 'Putin', 'Zelensky', 'Netanyahu',
      'Hegseth', 'Patel', 'Musk', 'Wray', 'Pelosi', 'McConnell', 'Schumer',
      'Vance', 'Walz', 'DeSantis', 'Newsom', 'Hochul', 'Abbott', 'Pritzker',
      'Sanders', 'Warren', 'Ocasio', 'Gaetz', 'Greene', 'Jordan', 'Bannon',
      'Kushner', 'Ivanka', 'Barron', 'Melania', 'Jill', 'Macron', 'Starmer',
      'Trudeau', 'Modi', 'Milei', 'Erdogan', 'Orban', 'Bolsonaro', 'Lula'
    )
    GROUP BY word
    HAVING COUNT(*) >= min_frequency / 2
  ),
  -- Two-word phrases (First Last names, proper nouns)
  two_word_phrases AS (
    SELECT 
      phrase as kw,
      COUNT(*) as freq,
      'phrase' as src
    FROM (
      SELECT (regexp_matches(text, '([A-Z][a-z]+\s+[A-Z][a-z]+)', 'g'))[1] as phrase
      FROM bluesky_posts
      WHERE created_at > NOW() - time_window
        AND text IS NOT NULL
        AND LENGTH(text) > 20
    ) phrases
    WHERE phrase IS NOT NULL
      -- Filter common non-entity phrases
      AND LOWER(phrase) NOT IN (
        'new york', 'los angeles', 'san francisco', 'united states', 'white house',
        'breaking news', 'just now', 'right now', 'last night', 'next week',
        'good morning', 'good evening', 'happy birthday', 'thank you', 'please help',
        'check out', 'sign up', 'click here', 'read more', 'learn more',
        'every day', 'last year', 'this year', 'next year', 'first time',
        'real time', 'full time', 'part time', 'long time', 'same time',
        'high school', 'middle school', 'elementary school', 'law school',
        'social media', 'fake news', 'mainstream media', 'big tech'
      )
    GROUP BY phrase
    HAVING COUNT(*) >= min_frequency
  ),
  -- Three-word phrases for full names with middle initial or title
  three_word_phrases AS (
    SELECT 
      phrase as kw,
      COUNT(*) as freq,
      'full_name' as src
    FROM (
      SELECT (regexp_matches(text, '([A-Z][a-z]+\s+[A-Z]\.?\s+[A-Z][a-z]+)', 'g'))[1] as phrase
      FROM bluesky_posts
      WHERE created_at > NOW() - time_window
        AND text IS NOT NULL
    ) phrases
    WHERE phrase IS NOT NULL
    GROUP BY phrase
    HAVING COUNT(*) >= min_frequency / 3
  ),
  -- News headline phrases (from google_news)
  news_phrases AS (
    SELECT 
      phrase as kw,
      COUNT(*) as freq,
      'news_phrase' as src
    FROM (
      SELECT (regexp_matches(title, '([A-Z][a-z]+\s+[A-Z][a-z]+)', 'g'))[1] as phrase
      FROM google_news_articles
      WHERE published_at > NOW() - time_window
        AND title IS NOT NULL
    ) phrases
    WHERE phrase IS NOT NULL
      AND LOWER(phrase) NOT IN (
        'new york', 'los angeles', 'san francisco', 'united states', 'white house',
        'breaking news', 'just now', 'right now'
      )
    GROUP BY phrase
    HAVING COUNT(*) >= 2
  )
  -- Return phrases first (higher quality), then known entities
  SELECT kw, freq, src FROM two_word_phrases
  UNION ALL
  SELECT kw, freq, src FROM three_word_phrases
  UNION ALL
  SELECT kw, freq, src FROM news_phrases
  UNION ALL
  SELECT kw, freq, src FROM known_entity_words
  ORDER BY freq DESC
  LIMIT 100;
END;
$$;

-- Phase 5: Clean up existing bad data
DELETE FROM trend_clusters 
WHERE cluster_title IN (
  -- Generic single words that are categories, not entities
  'Education', 'Security', 'Committee', 'York', 'National', 'Black',
  'Good', 'Maybe', 'Please', 'Yeah', 'Additional', 'Song', 'Depth',
  'January', 'James', 'Christmas', 'Israeli', 'European', 'Russian',
  'High', 'Federal', 'Department', 'Institute', 'Details', 'Report',
  'Snow', 'Precip', 'Link', 'Court', 'Party', 'Vote', 'News',
  'Every', 'First', 'Well', 'Thank', 'Missing', 'States', 'United',
  'American', 'President', 'White', 'Supreme', 'Law', 'Bill',
  'Government', 'Politics', 'World', 'Today', 'Week', 'Year', 'Month',
  'People', 'Time', 'Way', 'Day', 'Night', 'Morning', 'Thing', 'Place',
  'Question', 'Answer', 'Problem', 'Issue', 'Point', 'Fact', 'Story',
  'Group', 'Family', 'Area', 'System', 'Program', 'Service', 'Money',
  'State', 'Country', 'Company', 'Business', 'Life', 'Work', 'Word',
  'Health', 'Science', 'History', 'Art', 'Music', 'Sports', 'Tech',
  'Home', 'House', 'Building', 'Street', 'Road', 'City', 'Town',
  -- Fragment words (parts of longer phrases)
  'New', 'San', 'Los', 'Las', 'Mount', 'Saint', 'Fort', 'Port'
);

-- Update misclassified locations (countries)
UPDATE trend_clusters 
SET entity_type = 'location'
WHERE cluster_title IN (
  'Ukraine', 'Russia', 'Israel', 'Gaza', 'Palestine', 'China', 'Iran', 
  'Syria', 'Venezuela', 'Canada', 'Mexico', 'Germany', 'France', 'Spain', 
  'Italy', 'Japan', 'India', 'Brazil', 'Australia', 'Ireland', 'Netherlands', 
  'Rwanda', 'Lebanon', 'Yemen', 'Iraq', 'Afghanistan', 'Taiwan', 'Korea',
  'Egypt', 'Turkey', 'Poland', 'Romania', 'Hungary', 'Greece', 'Portugal',
  'Sweden', 'Norway', 'Denmark', 'Finland', 'Switzerland', 'Austria', 'Belgium',
  'Cuba', 'Haiti', 'Jamaica', 'Colombia', 'Peru', 'Chile', 'Argentina',
  'Philippines', 'Indonesia', 'Vietnam', 'Thailand', 'Malaysia', 'Singapore',
  'Pakistan', 'Bangladesh', 'Nigeria', 'Kenya', 'Ethiopia', 'Sudan', 'Libya',
  -- US States
  'Florida', 'Texas', 'California', 'Ohio', 'Virginia', 'Georgia', 'Michigan',
  'Pennsylvania', 'Arizona', 'Nevada', 'Wisconsin', 'Minnesota', 'Iowa',
  'Colorado', 'Oregon', 'Washington', 'Illinois', 'Indiana', 'Missouri',
  'Tennessee', 'Kentucky', 'Alabama', 'Louisiana', 'Mississippi', 'Arkansas',
  'Oklahoma', 'Kansas', 'Nebraska', 'Montana', 'Wyoming', 'Utah', 'Idaho',
  'Maine', 'Vermont', 'Massachusetts', 'Connecticut', 'Delaware', 'Maryland',
  'Carolina' -- catches both North/South variants if they appear as just "Carolina"
)
AND entity_type != 'location';

-- Ensure known organizations are classified correctly
UPDATE trend_clusters 
SET entity_type = 'organization'
WHERE cluster_title IN (
  'FBI', 'CIA', 'DOJ', 'ICE', 'NATO', 'UN', 'EU', 'CDC', 'FDA', 'EPA', 
  'SEC', 'NSA', 'DHS', 'CBP', 'ATF', 'DEA', 'IRS', 'FCC', 'FTC', 'USPS',
  'Congress', 'Senate', 'Supreme Court', 'Pentagon', 'White House',
  'Democratic Party', 'Republican Party', 'GOP', 'DNC', 'RNC',
  'Hamas', 'Hezbollah', 'Taliban', 'ISIS', 'MAGA'
)
AND entity_type NOT IN ('organization', 'hashtag');