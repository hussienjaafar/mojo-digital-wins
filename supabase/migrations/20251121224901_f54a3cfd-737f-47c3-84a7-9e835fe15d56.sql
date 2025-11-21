-- Fix security warning: Set search_path for set_article_geographic_scope function
CREATE OR REPLACE FUNCTION set_article_geographic_scope()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Inherit geographic_scope from the RSS source
  SELECT geographic_scope INTO NEW.geographic_scope
  FROM public.rss_sources
  WHERE id = NEW.source_id;

  -- Default to 'national' if not set
  IF NEW.geographic_scope IS NULL THEN
    NEW.geographic_scope := 'national';
  END IF;

  RETURN NEW;
END;
$$;