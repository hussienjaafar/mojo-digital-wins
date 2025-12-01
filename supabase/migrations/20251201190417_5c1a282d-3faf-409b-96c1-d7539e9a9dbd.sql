-- Add performance indexes (constraint already exists)
CREATE INDEX IF NOT EXISTS idx_entity_trends_trending ON entity_trends(is_trending) WHERE is_trending = true;
CREATE INDEX IF NOT EXISTS idx_entity_trends_updated_at ON entity_trends(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_entity_mentions_entity_mentioned ON entity_mentions(entity_name, mentioned_at DESC);
CREATE INDEX IF NOT EXISTS idx_entity_mentions_mentioned_at ON entity_mentions(mentioned_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_mentions_lookup ON organization_mentions(source_type, source_id, organization_abbrev);
CREATE INDEX IF NOT EXISTS idx_org_mentions_mentioned_at ON organization_mentions(mentioned_at DESC);