-- Create saved_donor_segments table for storing user-defined segments
CREATE TABLE public.saved_donor_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  filters jsonb NOT NULL DEFAULT '[]'::jsonb,
  donor_count_snapshot integer,
  total_value_snapshot numeric(12,2),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add index for faster lookups
CREATE INDEX idx_saved_donor_segments_org ON public.saved_donor_segments(organization_id);
CREATE INDEX idx_saved_donor_segments_created_by ON public.saved_donor_segments(created_by);

-- Enable RLS
ALTER TABLE public.saved_donor_segments ENABLE ROW LEVEL SECURITY;

-- RLS policies: Users can manage segments for organizations they belong to via organization_memberships
CREATE POLICY "Users can view segments for their organizations"
ON public.saved_donor_segments
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_memberships 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

CREATE POLICY "Users can create segments for their organizations"
ON public.saved_donor_segments
FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_memberships 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

CREATE POLICY "Users can update segments they created or for their organizations"
ON public.saved_donor_segments
FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_memberships 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

CREATE POLICY "Users can delete segments they created or for their organizations"
ON public.saved_donor_segments
FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_memberships 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_saved_donor_segments_updated_at
BEFORE UPDATE ON public.saved_donor_segments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE public.saved_donor_segments IS 'User-defined donor segments with filter configurations for targeting and analysis';