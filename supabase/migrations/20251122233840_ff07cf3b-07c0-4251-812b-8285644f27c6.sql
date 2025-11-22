-- Fix search_path security warnings for new functions

ALTER FUNCTION calculate_next_run(TEXT) SET search_path = 'public';
ALTER FUNCTION update_job_after_execution(UUID, TEXT, INTEGER, TEXT) SET search_path = 'public';