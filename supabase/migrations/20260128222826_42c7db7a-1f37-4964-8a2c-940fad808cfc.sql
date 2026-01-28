-- Create storage bucket for organization logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('organization-logos', 'organization-logos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: Anyone can view logos (public bucket)
CREATE POLICY "Organization logos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'organization-logos');

-- RLS: Admins can upload organization logos
CREATE POLICY "Admins can upload organization logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'organization-logos' 
  AND public.has_role(auth.uid(), 'admin')
);

-- RLS: Admins can update organization logos
CREATE POLICY "Admins can update organization logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'organization-logos' 
  AND public.has_role(auth.uid(), 'admin')
);

-- RLS: Admins can delete organization logos
CREATE POLICY "Admins can delete organization logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'organization-logos' 
  AND public.has_role(auth.uid(), 'admin')
);