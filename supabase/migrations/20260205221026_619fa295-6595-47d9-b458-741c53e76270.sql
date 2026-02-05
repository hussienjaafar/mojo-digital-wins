-- Add admin RLS policies to meta_ad_transcripts table
-- This matches the access pattern of meta_ad_videos

-- Add admin SELECT policy
CREATE POLICY "Admins can view all transcripts"
ON public.meta_ad_transcripts
FOR SELECT
TO public
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add admin INSERT policy
CREATE POLICY "Admins can insert transcripts"
ON public.meta_ad_transcripts
FOR INSERT
TO public
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add admin UPDATE policy
CREATE POLICY "Admins can update transcripts"
ON public.meta_ad_transcripts
FOR UPDATE
TO public
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add admin DELETE policy  
CREATE POLICY "Admins can delete transcripts"
ON public.meta_ad_transcripts
FOR DELETE
TO public
USING (has_role(auth.uid(), 'admin'::app_role));