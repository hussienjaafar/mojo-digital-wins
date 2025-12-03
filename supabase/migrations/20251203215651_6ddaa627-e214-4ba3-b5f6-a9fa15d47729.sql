-- Add circuit breaker columns to scheduled_jobs
ALTER TABLE public.scheduled_jobs 
ADD COLUMN IF NOT EXISTS is_circuit_open BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS circuit_opened_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS circuit_failure_threshold INTEGER DEFAULT 5;

-- Create function to check and trip circuit breaker
CREATE OR REPLACE FUNCTION public.check_circuit_breaker()
RETURNS TRIGGER AS $$
BEGIN
  -- If job failed, check if we should trip the circuit
  IF NEW.last_run_status = 'failed' AND NEW.consecutive_failures >= COALESCE(NEW.circuit_failure_threshold, 5) THEN
    NEW.is_circuit_open := true;
    NEW.circuit_opened_at := now();
    NEW.is_enabled := false;
  END IF;
  
  -- If job succeeded, reset circuit breaker
  IF NEW.last_run_status = 'success' AND OLD.is_circuit_open = true THEN
    NEW.is_circuit_open := false;
    NEW.circuit_opened_at := NULL;
    NEW.consecutive_failures := 0;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for circuit breaker
DROP TRIGGER IF EXISTS trigger_circuit_breaker ON public.scheduled_jobs;
CREATE TRIGGER trigger_circuit_breaker
  BEFORE UPDATE ON public.scheduled_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.check_circuit_breaker();

-- Create function to reset circuit breaker manually
CREATE OR REPLACE FUNCTION public.reset_circuit_breaker(job_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.scheduled_jobs
  SET 
    is_circuit_open = false,
    circuit_opened_at = NULL,
    consecutive_failures = 0,
    is_enabled = true
  WHERE id = job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create index for finding open circuits
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_circuit_open 
ON public.scheduled_jobs(is_circuit_open) WHERE is_circuit_open = true;

-- Clean up old job failures (keep last 7 days)
DELETE FROM public.job_failures 
WHERE created_at < NOW() - INTERVAL '7 days' 
AND is_resolved = true;