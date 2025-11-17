-- Create article_clusters table for duplicate detection
CREATE TABLE IF NOT EXISTS public.article_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  related_article_ids UUID[] NOT NULL DEFAULT '{}',
  cluster_title TEXT NOT NULL,
  cluster_summary TEXT,
  similarity_threshold NUMERIC DEFAULT 0.75,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.article_clusters ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view article clusters"
  ON public.article_clusters
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage article clusters"
  ON public.article_clusters
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_article_clusters_primary_article ON public.article_clusters(primary_article_id);
CREATE INDEX IF NOT EXISTS idx_article_clusters_created_at ON public.article_clusters(created_at DESC);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_article_clusters_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_article_clusters_updated_at
  BEFORE UPDATE ON public.article_clusters
  FOR EACH ROW
  EXECUTE FUNCTION update_article_clusters_updated_at();