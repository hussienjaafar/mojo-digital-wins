
# Fix Missing `ad_copy_studio_sessions` Table

## Problem
The Ad Copy Studio page is throwing a 404 error because the `ad_copy_studio_sessions` table doesn't exist in the database:

```
Could not find the table 'public.ad_copy_studio_sessions' in the schema cache
```

The table is defined in `supabase/migrations/20260204000000_ad_copy_studio.sql`, but this migration was never applied to the database - the table doesn't appear in the auto-generated `types.ts` file.

## Root Cause
The migration file has a non-standard filename format (`20260204000000_ad_copy_studio.sql`) that differs from the typical UUID-based naming convention used by other migrations in the project. This likely caused it to be skipped during the migration process.

## Solution
Create a new properly-formatted migration to add the missing `ad_copy_studio_sessions` table along with its related tables (`organization_meta_settings` and `ad_copy_generations`) that are also defined in the same file but missing.

### Migration SQL

The migration will create:

1. **`ad_copy_studio_sessions` table** - Stores wizard state for the 5-step workflow
   - Columns: `id`, `organization_id`, `user_id`, `current_step`, `batch_id`, `video_ids`, `transcript_ids`, `step_data`, `completed_steps`, `status`, `created_at`, `updated_at`
   - Unique constraint: Only one `in_progress` session per user per org
   - RLS policies for user access

2. **`organization_meta_settings` table** (if missing) - Per-org Meta API settings
   - Columns for Meta page IDs, default campaign settings, Advantage+ options

3. **`ad_copy_generations` table** (if missing) - Generated ad copy storage
   - Columns for video refs, ActBlue config, generated copy, validation status

### File Changes

| File | Action | Purpose |
|------|--------|---------|
| New migration file | Create | Add the missing tables with proper RLS policies |

### Technical Details

The migration will use `CREATE TABLE IF NOT EXISTS` to handle cases where some tables may already exist. All tables will have:
- Proper foreign key references to `client_organizations` and `auth.users`
- Row Level Security enabled
- Appropriate indexes for common query patterns
- RLS policies allowing users to manage their own data
