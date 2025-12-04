-- Improve the keyword discovery function with better stopword filtering
CREATE OR REPLACE FUNCTION discover_trending_keywords(
  time_window interval DEFAULT '6 hours'::interval,
  min_frequency int DEFAULT 20
)
RETURNS TABLE (
  keyword text,
  frequency bigint,
  source_type text
) LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH bluesky_keywords AS (
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
    WHERE LENGTH(word) >= 4
      AND word ~ '^[A-Z][a-z]+$'
      -- Expanded stopword list to filter common words
      AND LOWER(word) NOT IN (
        -- Common words
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
        -- Additional common words that appear frequently
        'your', 'vote', 'news', 'every', 'first', 'well', 'because', 'thank', 'missing',
        'party', 'report', 'federal', 'states', 'united', 'details', 'department',
        'institute', 'european', 'snow', 'depth', 'precip', 'link', 'russian',
        'court', 'fuck', 'shit', 'damn', 'hell', 'today', 'tomorrow', 'yesterday',
        'morning', 'afternoon', 'evening', 'really', 'actually', 'basically', 'literally',
        'here', 'know', 'want', 'need', 'look', 'come', 'think', 'take', 'good', 'great',
        'best', 'last', 'long', 'little', 'much', 'same', 'still', 'another', 'each',
        'both', 'many', 'being', 'going', 'doing', 'saying', 'called', 'getting',
        'trying', 'making', 'looking', 'coming', 'taking', 'giving', 'using', 'working',
        'says', 'said', 'told', 'asked', 'made', 'came', 'went', 'took', 'gave',
        'found', 'left', 'thought', 'called', 'began', 'seemed', 'felt', 'become',
        'keep', 'mean', 'might', 'must', 'shall', 'without', 'within', 'along', 'among',
        'around', 'since', 'until', 'upon', 'below', 'above', 'across', 'against',
        'however', 'although', 'though', 'whether', 'either', 'neither', 'rather',
        'whole', 'almost', 'already', 'always', 'never', 'often', 'sometimes', 'usually',
        'perhaps', 'probably', 'certainly', 'definitely', 'possibly', 'maybe', 'sure',
        'please', 'sorry', 'thanks', 'okay', 'yeah', 'yeah', 'yep', 'nope', 'okay',
        'anyone', 'everyone', 'someone', 'nobody', 'somebody', 'everything', 'something',
        'nothing', 'anything', 'anywhere', 'everywhere', 'somewhere', 'nowhere',
        'dont', 'cant', 'wont', 'didnt', 'doesnt', 'hasnt', 'havent', 'hadnt',
        'wasnt', 'werent', 'isnt', 'arent', 'shouldnt', 'wouldnt', 'couldnt', 'mightnt',
        'update', 'updates', 'live', 'breaking', 'alert', 'read', 'watch', 'click',
        'follow', 'share', 'like', 'love', 'hate', 'want', 'need', 'help', 'stop',
        'start', 'wait', 'open', 'close', 'send', 'post', 'tweet', 'thread', 'reply',
        'retweet', 'quote', 'comment', 'subscribe', 'unsubscribe', 'join', 'leave'
      )
    GROUP BY word
    HAVING COUNT(*) >= min_frequency
  ),
  news_keywords AS (
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
        'news', 'says', 'report', 'reports', 'update', 'updates', 'live', 'breaking',
        'your', 'vote', 'every', 'first', 'well', 'today', 'tomorrow', 'yesterday'
      )
    GROUP BY word
    HAVING COUNT(*) >= 3
  ),
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
      AND LOWER(phrase) NOT IN ('new york', 'los angeles', 'san francisco', 'united states', 'white house')
    GROUP BY phrase
    HAVING COUNT(*) >= min_frequency / 2
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
$$;