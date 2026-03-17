

# Root Cause: Meta Ads Not Synchronizing Across All Clients

## Problems Found

### Problem 1 (CRITICAL): Tiered Meta Sync Code is Unreachable Dead Code

In `run-scheduled-jobs/index.ts` lines 609-623, the tiered-meta-sync invocation sits **after** the `break` statement on line 607 (end of the `sync_everyaction` case). This code can never execute. It was accidentally placed here during the EveryAction integration — the code block that should be its own `case 'sync_meta_ads':` is instead orphaned dead code after `sync_everyaction`'s `break`.

There is **no `case 'sync_meta_ads'`** anywhere in the switch statement, so the `Sync Meta Ads` scheduled job (which has `job_type: 'sync_meta_ads'`) hits the default case and does nothing meaningful.

### Problem 2: Scheduled Job Only Targets One Org

The `Sync Meta Ads` row in `scheduled_jobs` has a hardcoded `payload: { organization_id: '346d6aaf-...' }` (A New Policy). Even if the case handler existed, it would only invoke `admin-sync-meta` for that single org. The tiered system (`tiered-meta-sync`) was designed to handle all orgs automatically, but it's never called.

### Problem 3: Data Staleness Evidence

| Organization | Days Stale | Notes |
|---|---|---|
| MPAC | 0 | User manually synced just now |
| Rashid For Illinois | 1 | |
| A New Policy | 7 | Despite being the hardcoded org! |
| Wesam Shahed | 33 | |
| Michael Blake | 45 | |
| Progressive Victory Fund | 105 | |

4 additional orgs (Digital Equity, New Voices, Abdul, Coastal Justice, Heartland) are showing `failed` sync status with generic "Edge Function returned a non-2xx status code" errors.

## The Fix

### 1. Add `sync_meta_ads` case to the switch statement

Move the dead tiered-meta-sync code block into its own proper `case 'sync_meta_ads':` handler, so the scheduled job actually triggers it.

### 2. Remove the hardcoded org from the scheduled job payload

Update the `scheduled_jobs` row for "Sync Meta Ads" to remove the single-org payload, since `tiered-meta-sync` handles all orgs based on priority tiers.

### 3. Clean up the dead code after `sync_everyaction`'s break

Remove the orphaned lines 609-623 and place them correctly under the new case.

## Files to Change

| File | Change |
|------|--------|
| `supabase/functions/run-scheduled-jobs/index.ts` | Add `case 'sync_meta_ads':` with the tiered-meta-sync invocation; remove dead code after `sync_everyaction` break |
| Database: `scheduled_jobs` | Clear the hardcoded `organization_id` from the Sync Meta Ads payload |

