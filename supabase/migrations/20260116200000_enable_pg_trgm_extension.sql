-- Migration: Enable pg_trgm extension for fuzzy text matching
-- Purpose: Enables Levenshtein distance and similarity functions for typo-tolerant refcode matching
-- Part of the Attribution Waterfall system upgrade

-- Enable the pg_trgm extension (PostgreSQL trigram matching)
-- This provides:
-- - similarity(text, text) → returns similarity score 0.0-1.0
-- - word_similarity(text, text) → word-based similarity
-- - GIN/GiST index support for fast similarity searches
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add index on refcode_mappings for fast fuzzy lookups
CREATE INDEX IF NOT EXISTS idx_refcode_mappings_refcode_trgm
ON public.refcode_mappings USING gin (refcode gin_trgm_ops);

-- Add index on actblue_transactions for fast fuzzy refcode searches
CREATE INDEX IF NOT EXISTS idx_actblue_transactions_refcode_trgm
ON public.actblue_transactions USING gin (refcode gin_trgm_ops);

COMMENT ON EXTENSION pg_trgm IS 'Enables fuzzy text matching for typo-tolerant refcode attribution';
