-- Fix bill_actions RLS - add SELECT policy for authenticated users
-- RLS was enabled but no policy was created, blocking all reads

-- Allow authenticated users to read bill actions
CREATE POLICY "Authenticated users can view bill actions" ON public.bill_actions
  FOR SELECT
  TO authenticated
  USING (true);

-- Also allow public read for anonymous users (bills are public information)
CREATE POLICY "Anyone can view bill actions" ON public.bill_actions
  FOR SELECT
  TO anon
  USING (true);
