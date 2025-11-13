-- Add new columns to contact_submissions for enhanced management
ALTER TABLE public.contact_submissions
ADD COLUMN status TEXT NOT NULL DEFAULT 'new',
ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium',
ADD COLUMN assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN resolved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

-- Create submission notes table
CREATE TABLE public.submission_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES public.contact_submissions(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on submission notes
ALTER TABLE public.submission_notes ENABLE ROW LEVEL SECURITY;

-- Only admins can view notes
CREATE POLICY "Only admins can view submission notes"
  ON public.submission_notes
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Only admins can create notes
CREATE POLICY "Only admins can create submission notes"
  ON public.submission_notes
  FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) 
    AND admin_id = auth.uid()
  );

-- Only admins can delete their own notes
CREATE POLICY "Admins can delete their own notes"
  ON public.submission_notes
  FOR DELETE
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) 
    AND admin_id = auth.uid()
  );

-- Create indexes for better performance
CREATE INDEX idx_contact_submissions_status ON public.contact_submissions(status);
CREATE INDEX idx_contact_submissions_priority ON public.contact_submissions(priority);
CREATE INDEX idx_contact_submissions_assigned_to ON public.contact_submissions(assigned_to);
CREATE INDEX idx_submission_notes_submission_id ON public.submission_notes(submission_id);
CREATE INDEX idx_submission_notes_admin_id ON public.submission_notes(admin_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_contact_submission_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  
  -- Set resolved_at when status changes to resolved
  IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
    NEW.resolved_at = now();
  ELSIF NEW.status != 'resolved' THEN
    NEW.resolved_at = NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to automatically update timestamps
CREATE TRIGGER update_contact_submissions_timestamp
  BEFORE UPDATE ON public.contact_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_contact_submission_timestamp();

-- Function to get submissions with notes count
CREATE OR REPLACE FUNCTION public.get_submissions_with_details()
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  name TEXT,
  email TEXT,
  campaign TEXT,
  organization_type TEXT,
  message TEXT,
  status TEXT,
  priority TEXT,
  assigned_to UUID,
  assigned_to_email TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  notes_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow admins to call this function
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can view submissions';
  END IF;

  RETURN QUERY
  SELECT 
    cs.id,
    cs.created_at,
    cs.updated_at,
    cs.name,
    cs.email,
    cs.campaign,
    cs.organization_type,
    cs.message,
    cs.status,
    cs.priority,
    cs.assigned_to,
    p.email as assigned_to_email,
    cs.resolved_at,
    COUNT(sn.id) as notes_count
  FROM public.contact_submissions cs
  LEFT JOIN public.profiles p ON cs.assigned_to = p.id
  LEFT JOIN public.submission_notes sn ON cs.id = sn.submission_id
  GROUP BY cs.id, p.email
  ORDER BY 
    CASE cs.priority
      WHEN 'urgent' THEN 1
      WHEN 'high' THEN 2
      WHEN 'medium' THEN 3
      WHEN 'low' THEN 4
    END,
    cs.created_at DESC;
END;
$$;