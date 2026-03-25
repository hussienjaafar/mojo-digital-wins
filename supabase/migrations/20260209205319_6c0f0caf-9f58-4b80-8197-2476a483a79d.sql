
ALTER TABLE public.meta_ad_transcripts
ADD COLUMN IF NOT EXISTS hallucination_risk real,
ADD COLUMN IF NOT EXISTS auto_retry_count integer NOT NULL DEFAULT 0;
