-- Create table for tracking ActBlue backfill chunks with retry logic
CREATE TABLE IF NOT EXISTS public.actblue_backfill_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  job_id UUID NOT NULL,  -- Groups chunks for same backfill job
  chunk_index INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retrying')),
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  processed_rows INTEGER DEFAULT 0,
  inserted_rows INTEGER DEFAULT 0,
  updated_rows INTEGER DEFAULT 0,
  skipped_rows INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(organization_id, job_id, chunk_index)
);

-- Index for efficient chunk pickup by the processor
CREATE INDEX IF NOT EXISTS idx_actblue_chunks_pending 
ON public.actblue_backfill_chunks(status, next_retry_at) 
WHERE status IN ('pending', 'retrying');

-- Index for job lookup
CREATE INDEX IF NOT EXISTS idx_actblue_chunks_job 
ON public.actblue_backfill_chunks(job_id);

-- Index for organization lookup
CREATE INDEX IF NOT EXISTS idx_actblue_chunks_org 
ON public.actblue_backfill_chunks(organization_id);

-- Enable RLS
ALTER TABLE public.actblue_backfill_chunks ENABLE ROW LEVEL SECURITY;

-- RLS policies for admin access
CREATE POLICY "Admins can manage backfill chunks"
ON public.actblue_backfill_chunks FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RLS policy for client users to view their own org's chunks
CREATE POLICY "Client users can view their own org chunks"
ON public.actblue_backfill_chunks FOR SELECT TO authenticated
USING (
  organization_id IN (
    SELECT cu.organization_id 
    FROM public.client_users cu 
    WHERE cu.id = auth.uid()
  )
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_actblue_chunk_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_actblue_backfill_chunks_updated_at
  BEFORE UPDATE ON public.actblue_backfill_chunks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_actblue_chunk_updated_at();

-- Add comment for documentation
COMMENT ON TABLE public.actblue_backfill_chunks IS 'Tracks individual monthly chunks for ActBlue CSV backfill jobs with retry logic';