-- Fix circuit breaker trigger to use is_active instead of is_enabled
CREATE OR REPLACE FUNCTION public.check_circuit_breaker()
RETURNS TRIGGER AS $$
BEGIN
  -- If job failed, check if we should trip the circuit
  IF NEW.last_run_status = 'failed' AND NEW.consecutive_failures >= COALESCE(NEW.circuit_failure_threshold, 5) THEN
    NEW.is_circuit_open := true;
    NEW.circuit_opened_at := now();
    NEW.is_active := false;
  END IF;
  
  -- If job succeeded and circuit was open, reset it
  IF NEW.last_run_status = 'success' AND OLD.is_circuit_open = true THEN
    NEW.is_circuit_open := false;
    NEW.circuit_opened_at := NULL;
    NEW.consecutive_failures := 0;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update reset function to use is_active
CREATE OR REPLACE FUNCTION public.reset_circuit_breaker(job_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.scheduled_jobs
  SET 
    is_circuit_open = false,
    circuit_opened_at = NULL,
    consecutive_failures = 0,
    is_active = true
  WHERE id = job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;