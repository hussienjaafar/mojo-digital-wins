-- Add new columns for enhanced creative analysis
ALTER TABLE public.meta_creative_insights 
ADD COLUMN IF NOT EXISTS transcription_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS verbal_themes text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS key_quotes jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS visual_analysis jsonb,
ADD COLUMN IF NOT EXISTS detected_text text,
ADD COLUMN IF NOT EXISTS color_palette text[],
ADD COLUMN IF NOT EXISTS has_faces boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS effectiveness_score numeric,
ADD COLUMN IF NOT EXISTS performance_tier text;

-- Add index for performance tier filtering
CREATE INDEX IF NOT EXISTS idx_meta_creative_insights_performance_tier 
ON public.meta_creative_insights(organization_id, performance_tier);

-- Add index for transcription status
CREATE INDEX IF NOT EXISTS idx_meta_creative_insights_transcription_status 
ON public.meta_creative_insights(transcription_status) 
WHERE transcription_status IS NOT NULL;

COMMENT ON COLUMN public.meta_creative_insights.transcription_status IS 'Status of video transcription: pending, processing, completed, failed, skipped';
COMMENT ON COLUMN public.meta_creative_insights.verbal_themes IS 'Key themes extracted from audio transcript';
COMMENT ON COLUMN public.meta_creative_insights.key_quotes IS 'Notable quotes from the video transcript';
COMMENT ON COLUMN public.meta_creative_insights.visual_analysis IS 'AI-generated visual analysis for images/thumbnails';
COMMENT ON COLUMN public.meta_creative_insights.detected_text IS 'Text overlay detected in image/video';
COMMENT ON COLUMN public.meta_creative_insights.color_palette IS 'Dominant colors in the creative';
COMMENT ON COLUMN public.meta_creative_insights.has_faces IS 'Whether faces are detected in the creative';
COMMENT ON COLUMN public.meta_creative_insights.effectiveness_score IS 'Calculated effectiveness score 0-100';
COMMENT ON COLUMN public.meta_creative_insights.performance_tier IS 'Performance tier: top, high, medium, low';