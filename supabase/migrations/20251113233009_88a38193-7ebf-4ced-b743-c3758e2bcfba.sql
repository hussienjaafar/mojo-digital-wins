-- Create email report schedules table
CREATE TABLE IF NOT EXISTS public.email_report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  recipient_emails TEXT[] NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly')),
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  day_of_month INTEGER CHECK (day_of_month BETWEEN 1 AND 31),
  time_of_day TIME NOT NULL DEFAULT '09:00:00',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_report_schedules ENABLE ROW LEVEL SECURITY;

-- Policies for email report schedules
CREATE POLICY "Users can view own org report schedules"
  ON public.email_report_schedules
  FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage all report schedules"
  ON public.email_report_schedules
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Client admins can manage own org report schedules"
  ON public.email_report_schedules
  FOR ALL
  USING (organization_id = get_user_organization_id() AND is_client_admin());

-- Create trigger for updated_at
CREATE TRIGGER update_email_report_schedules_updated_at
  BEFORE UPDATE ON public.email_report_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create email report logs table
CREATE TABLE IF NOT EXISTS public.email_report_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.email_report_schedules(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  recipients TEXT[] NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on logs
ALTER TABLE public.email_report_logs ENABLE ROW LEVEL SECURITY;

-- Policies for logs
CREATE POLICY "Admins can view all report logs"
  ON public.email_report_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own org report logs"
  ON public.email_report_logs
  FOR SELECT
  USING (organization_id = get_user_organization_id());

-- Index for faster lookups
CREATE INDEX idx_email_report_schedules_org ON public.email_report_schedules(organization_id);
CREATE INDEX idx_email_report_schedules_active ON public.email_report_schedules(is_active) WHERE is_active = true;
CREATE INDEX idx_email_report_logs_schedule ON public.email_report_logs(schedule_id);
CREATE INDEX idx_email_report_logs_sent_at ON public.email_report_logs(sent_at DESC);