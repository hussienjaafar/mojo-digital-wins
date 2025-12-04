-- Fix function search path for newly created functions
ALTER FUNCTION discover_trending_keywords(interval, int) SET search_path = public;
ALTER FUNCTION count_keyword_mentions(text, interval) SET search_path = public;