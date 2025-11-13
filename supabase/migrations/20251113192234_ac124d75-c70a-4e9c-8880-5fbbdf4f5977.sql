-- Add RLS policies for UPDATE and DELETE on contact_submissions
-- Only admins should be able to modify or delete contact form submissions

CREATE POLICY "Only admins can update submissions"
ON public.contact_submissions
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete submissions"
ON public.contact_submissions
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));