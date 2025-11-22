-- Fix security warning: Set search_path for update_cache_hit function
DROP FUNCTION IF EXISTS update_cache_hit();

CREATE OR REPLACE FUNCTION update_cache_hit()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.hit_count := OLD.hit_count + 1;
  NEW.last_used_at := NOW();
  RETURN NEW;
END;
$$;