
-- Create contact notification recipients table
CREATE TABLE public.contact_notification_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  added_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email)
);

-- Enable RLS
ALTER TABLE public.contact_notification_recipients ENABLE ROW LEVEL SECURITY;

-- RLS: Only system admins can manage recipients
CREATE POLICY "System admins can view recipients"
  ON public.contact_notification_recipients FOR SELECT
  USING (public.is_system_admin());

CREATE POLICY "System admins can insert recipients"
  ON public.contact_notification_recipients FOR INSERT
  WITH CHECK (public.is_system_admin());

CREATE POLICY "System admins can update recipients"
  ON public.contact_notification_recipients FOR UPDATE
  USING (public.is_system_admin());

CREATE POLICY "System admins can delete recipients"
  ON public.contact_notification_recipients FOR DELETE
  USING (public.is_system_admin());
