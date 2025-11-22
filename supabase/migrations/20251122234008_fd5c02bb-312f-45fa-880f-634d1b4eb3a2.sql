-- Phase 1: Add Missing Columns to Support Tables

-- Add columns to rss_sources for health tracking
ALTER TABLE rss_sources
ADD COLUMN IF NOT EXISTS fetch_frequency_minutes INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS error_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS consecutive_errors INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_fetch_status TEXT,
ADD COLUMN IF NOT EXISTS last_error_message TEXT;

-- Create index for error tracking
CREATE INDEX IF NOT EXISTS idx_rss_sources_errors ON rss_sources(consecutive_errors DESC) WHERE is_active = true;

-- Add columns to job_failures for better tracking
ALTER TABLE job_failures
ADD COLUMN IF NOT EXISTS job_name TEXT;

-- Backfill job_name from function_name
UPDATE job_failures SET job_name = function_name WHERE job_name IS NULL;