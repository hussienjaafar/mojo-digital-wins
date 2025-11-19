-- Create policy to allow everyone to view bills (they are public legislative data)
DROP POLICY IF EXISTS "Bills are viewable by everyone" ON bills;

CREATE POLICY "Bills are viewable by everyone"
ON bills FOR SELECT
USING (true);