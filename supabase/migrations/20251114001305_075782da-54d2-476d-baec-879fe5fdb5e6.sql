-- Add email delivery tracking to admin_invite_codes
ALTER TABLE admin_invite_codes 
ADD COLUMN email_sent_to text,
ADD COLUMN email_status text DEFAULT 'pending',
ADD COLUMN email_sent_at timestamp with time zone,
ADD COLUMN email_error text,
ADD COLUMN resend_count integer DEFAULT 0;

-- Add index for better query performance
CREATE INDEX idx_admin_invite_codes_email_status ON admin_invite_codes(email_status);

-- Create table for email template customization
CREATE TABLE IF NOT EXISTS admin_invite_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  name text NOT NULL,
  subject text NOT NULL DEFAULT '🎯 You''ve been invited to join as an Administrator',
  logo_url text,
  primary_color text DEFAULT '#667eea',
  header_text text DEFAULT 'Admin Invitation',
  footer_text text DEFAULT 'This is an automated message from your admin dashboard.',
  custom_message text,
  is_default boolean DEFAULT false,
  created_by uuid REFERENCES profiles(id)
);

-- Enable RLS
ALTER TABLE admin_invite_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for templates
CREATE POLICY "Only admins can view templates"
  ON admin_invite_templates FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can create templates"
  ON admin_invite_templates FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update templates"
  ON admin_invite_templates FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete templates"
  ON admin_invite_templates FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_admin_invite_templates_updated_at
  BEFORE UPDATE ON admin_invite_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default template
INSERT INTO admin_invite_templates (name, is_default)
VALUES ('Default Template', true);