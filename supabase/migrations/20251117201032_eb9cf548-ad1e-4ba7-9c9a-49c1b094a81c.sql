-- Create bookmarks table
CREATE TABLE IF NOT EXISTS public.article_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  UNIQUE(user_id, article_id)
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON public.article_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_article ON public.article_bookmarks(article_id);

-- Enable RLS
ALTER TABLE public.article_bookmarks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own bookmarks"
  ON public.article_bookmarks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own bookmarks"
  ON public.article_bookmarks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bookmarks"
  ON public.article_bookmarks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bookmarks"
  ON public.article_bookmarks FOR DELETE
  USING (auth.uid() = user_id);