-- Fix search_path for the refresh function
CREATE OR REPLACE FUNCTION refresh_materialized_view(view_name TEXT)
RETURNS void AS $$
BEGIN
  EXECUTE 'REFRESH MATERIALIZED VIEW public.' || quote_ident(view_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;