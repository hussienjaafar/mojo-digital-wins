-- Add unique constraint to cluster_title for proper upsert behavior
ALTER TABLE public.trend_clusters 
ADD CONSTRAINT trend_clusters_cluster_title_key UNIQUE (cluster_title);