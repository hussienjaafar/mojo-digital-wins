-- Create a function to discover trending keywords from raw text
-- This finds high-frequency terms that may be trending but not yet AI-extracted

CREATE OR REPLACE FUNCTION discover_trending_keywords(
  time_window interval DEFAULT '6 hours'::interval,
  min_frequency int DEFAULT 20
)
RETURNS TABLE (
  keyword text,
  frequency bigint,
  source_type text
) AS $$
BEGIN
  RETURN QUERY
  WITH bluesky_keywords AS (
    -- Extract potential trending keywords from Bluesky posts
    -- Focus on capitalized words (likely proper nouns/names)
    SELECT 
      word as kw,
      COUNT(*) as freq,
      'bluesky' as src
    FROM (
      SELECT regexp_split_to_table(
        regexp_replace(text, '[^a-zA-Z\s]', ' ', 'g'),
        '\s+'
      ) as word
      FROM bluesky_posts
      WHERE created_at > NOW() - time_window
        AND text IS NOT NULL
        AND LENGTH(text) > 10
    ) words
    WHERE LENGTH(word) >= 4  -- Skip short words
      AND word ~ '^[A-Z][a-z]+$'  -- Capitalized words (proper nouns)
      AND LOWER(word) NOT IN (
        'this', 'that', 'with', 'from', 'have', 'been', 'will', 'would', 'could', 'should',
        'their', 'there', 'they', 'them', 'what', 'when', 'where', 'which', 'while',
        'about', 'after', 'before', 'between', 'through', 'during', 'under', 'again',
        'just', 'more', 'most', 'other', 'some', 'such', 'than', 'then', 'these', 'those',
        'very', 'also', 'only', 'even', 'back', 'into', 'over', 'down', 'like', 'make',
        'time', 'year', 'people', 'way', 'day', 'man', 'thing', 'woman', 'life', 'child',
        'world', 'school', 'state', 'family', 'student', 'group', 'country', 'problem',
        'hand', 'part', 'place', 'case', 'week', 'company', 'system', 'program', 'question',
        'work', 'government', 'number', 'night', 'point', 'home', 'water', 'room', 'mother',
        'area', 'money', 'story', 'fact', 'month', 'lot', 'right', 'study', 'book', 'eye',
        'job', 'word', 'business', 'issue', 'side', 'kind', 'head', 'house', 'service',
        'friend', 'father', 'power', 'hour', 'game', 'line', 'end', 'member', 'law', 'car',
        'city', 'community', 'name', 'president', 'team', 'minute', 'idea', 'kid', 'body',
        'information', 'nothing', 'ago', 'lead', 'social', 'whether', 'back', 'read'
      )
    GROUP BY word
    HAVING COUNT(*) >= min_frequency
  ),
  news_keywords AS (
    -- Extract keywords from Google News titles
    SELECT 
      word as kw,
      COUNT(*) as freq,
      'news' as src
    FROM (
      SELECT regexp_split_to_table(
        regexp_replace(title, '[^a-zA-Z\s]', ' ', 'g'),
        '\s+'
      ) as word
      FROM google_news_articles
      WHERE published_at > NOW() - time_window
        AND title IS NOT NULL
    ) words
    WHERE LENGTH(word) >= 4
      AND word ~ '^[A-Z][a-z]+$'
      AND LOWER(word) NOT IN (
        'this', 'that', 'with', 'from', 'have', 'been', 'will', 'would', 'could', 'should',
        'their', 'there', 'they', 'them', 'what', 'when', 'where', 'which', 'while',
        'about', 'after', 'before', 'between', 'through', 'during', 'under', 'again',
        'just', 'more', 'most', 'other', 'some', 'such', 'than', 'then', 'these', 'those',
        'very', 'also', 'only', 'even', 'back', 'into', 'over', 'down', 'like', 'make',
        'news', 'says', 'report', 'reports', 'update', 'updates', 'live', 'breaking'
      )
    GROUP BY word
    HAVING COUNT(*) >= 3  -- Lower threshold for news (fewer articles)
  ),
  -- Also extract 2-word phrases for names (e.g., "Chris Wray", "Brian Cole")
  bluesky_phrases AS (
    SELECT 
      phrase as kw,
      COUNT(*) as freq,
      'bluesky_phrase' as src
    FROM (
      SELECT 
        (regexp_matches(text, '([A-Z][a-z]+\s+[A-Z][a-z]+)', 'g'))[1] as phrase
      FROM bluesky_posts
      WHERE created_at > NOW() - time_window
        AND text IS NOT NULL
    ) phrases
    WHERE phrase IS NOT NULL
      AND LOWER(phrase) NOT IN ('new york', 'los angeles', 'san francisco', 'united states')
    GROUP BY phrase
    HAVING COUNT(*) >= min_frequency / 2  -- Lower threshold for phrases
  ),
  news_phrases AS (
    SELECT 
      phrase as kw,
      COUNT(*) as freq,
      'news_phrase' as src
    FROM (
      SELECT 
        (regexp_matches(title, '([A-Z][a-z]+\s+[A-Z][a-z]+)', 'g'))[1] as phrase
      FROM google_news_articles
      WHERE published_at > NOW() - time_window
        AND title IS NOT NULL
    ) phrases
    WHERE phrase IS NOT NULL
    GROUP BY phrase
    HAVING COUNT(*) >= 2
  )
  SELECT kw, freq, src FROM bluesky_keywords
  UNION ALL
  SELECT kw, freq, src FROM news_keywords
  UNION ALL
  SELECT kw, freq, src FROM bluesky_phrases
  UNION ALL
  SELECT kw, freq, src FROM news_phrases
  ORDER BY freq DESC;
END;
$$ LANGUAGE plpgsql;

-- Create a helper function to count keyword mentions across all sources
CREATE OR REPLACE FUNCTION count_keyword_mentions(
  search_keyword text,
  time_window interval DEFAULT '24 hours'::interval
)
RETURNS TABLE (
  bluesky_count bigint,
  news_count bigint,
  rss_count bigint,
  total_count bigint
) AS $$
DECLARE
  escaped_keyword text;
BEGIN
  escaped_keyword := '%' || search_keyword || '%';
  
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM bluesky_posts 
     WHERE created_at > NOW() - time_window 
     AND LOWER(text) LIKE LOWER(escaped_keyword))::bigint as bluesky_count,
    (SELECT COUNT(*) FROM google_news_articles 
     WHERE published_at > NOW() - time_window 
     AND LOWER(title) LIKE LOWER(escaped_keyword))::bigint as news_count,
    (SELECT COUNT(*) FROM articles 
     WHERE published_date > NOW() - time_window 
     AND LOWER(title) LIKE LOWER(escaped_keyword))::bigint as rss_count,
    (
      (SELECT COUNT(*) FROM bluesky_posts 
       WHERE created_at > NOW() - time_window 
       AND LOWER(text) LIKE LOWER(escaped_keyword)) +
      (SELECT COUNT(*) FROM google_news_articles 
       WHERE published_at > NOW() - time_window 
       AND LOWER(title) LIKE LOWER(escaped_keyword)) +
      (SELECT COUNT(*) FROM articles 
       WHERE published_date > NOW() - time_window 
       AND LOWER(title) LIKE LOWER(escaped_keyword))
    )::bigint as total_count;
END;
$$ LANGUAGE plpgsql;