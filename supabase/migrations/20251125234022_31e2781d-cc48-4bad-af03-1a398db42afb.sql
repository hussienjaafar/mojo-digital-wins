-- Create function to increment cache hit count
CREATE OR REPLACE FUNCTION increment_cache_hit(content_hash_param text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE ai_analysis_cache
  SET hit_count = COALESCE(hit_count, 0) + 1,
      last_used_at = NOW()
  WHERE content_hash = content_hash_param;
END;
$$;