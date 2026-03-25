-- Create function to cleanup cron job_run_details
CREATE OR REPLACE FUNCTION public.cleanup_cron_job_run_details(retention_days INT DEFAULT 7)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = cron, public
AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM cron.job_run_details 
  WHERE start_time < NOW() - (retention_days || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION public.cleanup_cron_job_run_details(INT) TO service_role;