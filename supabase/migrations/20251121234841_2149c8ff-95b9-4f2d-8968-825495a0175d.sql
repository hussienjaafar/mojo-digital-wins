-- Enable RLS on bluesky_posts table
ALTER TABLE public.bluesky_posts ENABLE ROW LEVEL SECURITY;

-- Allow admins to manage all Bluesky posts
CREATE POLICY "Admins can manage bluesky posts"
ON public.bluesky_posts
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow anyone to view Bluesky posts (public social intelligence data)
CREATE POLICY "Anyone can view bluesky posts"
ON public.bluesky_posts
FOR SELECT
USING (true);
