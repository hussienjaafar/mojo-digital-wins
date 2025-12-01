-- Critical Bug Fix: Add unique constraint to entity_mentions to prevent duplicates
-- This prevents duplicate entity mentions from inflating trend calculations

-- Step 1: Clean up existing duplicates (keep the most recent one)
DELETE FROM entity_mentions a
USING entity_mentions b
WHERE a.id < b.id
  AND a.entity_name = b.entity_name
  AND a.source_id = b.source_id
  AND a.source_type = b.source_type;

-- Step 2: Add unique constraint to prevent future duplicates
ALTER TABLE entity_mentions 
ADD CONSTRAINT entity_mentions_unique_source 
UNIQUE (entity_name, source_id, source_type);

-- Step 3: Add index for performance on common queries
CREATE INDEX IF NOT EXISTS idx_entity_mentions_name_type 
ON entity_mentions(entity_name, entity_type);

-- Step 4: Add index for time-based queries
CREATE INDEX IF NOT EXISTS idx_entity_mentions_mentioned_at 
ON entity_mentions(mentioned_at DESC);
