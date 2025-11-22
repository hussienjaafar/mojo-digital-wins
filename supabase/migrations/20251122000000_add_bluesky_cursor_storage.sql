-- Create table to store JetStream cursor position for resumable streaming

CREATE TABLE IF NOT EXISTS public.bluesky_stream_cursor (
  id INTEGER PRIMARY KEY DEFAULT 1, -- Single row table
  last_cursor BIGINT NOT NULL, -- Unix microseconds from JetStream time_us field
  last_updated_at TIMESTAMPTZ DEFAULT now(),
  posts_collected INTEGER DEFAULT 0,
  last_error TEXT,

  -- Ensure only one row exists
  CONSTRAINT single_row CHECK (id = 1)
);

-- Insert initial cursor (start from current time)
INSERT INTO public.bluesky_stream_cursor (id, last_cursor, posts_collected)
VALUES (1, EXTRACT(EPOCH FROM NOW()) * 1000000, 0)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.bluesky_stream_cursor ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage cursor
CREATE POLICY "Service can manage cursor"
ON public.bluesky_stream_cursor
FOR ALL
USING (true);

-- Allow admins to view cursor
CREATE POLICY "Admins can view cursor"
ON public.bluesky_stream_cursor
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

COMMENT ON TABLE public.bluesky_stream_cursor IS
'Stores the cursor position for JetStream firehose resumable streaming.
The cursor (time_us) allows the stream to resume from the last processed event
without missing any posts. Updated every time bluesky-stream edge function runs.';
