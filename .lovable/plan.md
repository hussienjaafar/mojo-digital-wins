

# Root Cause Analysis: ActBlue Data Not Updating

## The Problem

**344 ActBlue webhook donations have been failing since March 16 at 18:28 UTC** (approximately 22 hours). All incoming webhooks are being logged but failing to process.

## Root Cause

The migration `20260316182431` (applied yesterday) broke the ActBlue webhook's donor demographics upsert. Specifically:

**What the migration did** (line 145-150):
```sql
ALTER TABLE donor_demographics
  DROP CONSTRAINT donor_demographics_organization_id_donor_email_key;

CREATE UNIQUE INDEX donor_demographics_org_email_lower_unique
  ON donor_demographics (organization_id, lower(trim(donor_email)));
```

This replaced the simple unique constraint on `(organization_id, donor_email)` with a **functional unique index** on `(organization_id, lower(trim(donor_email)))`.

**Why it broke**: The ActBlue webhook (line 541) does:
```ts
.upsert({...}, { onConflict: 'organization_id,donor_email' })
```

The Supabase JS client's `onConflict` parameter requires a **plain column-based unique constraint**. It cannot resolve to a functional index (`lower(trim(...))`). This causes Postgres error `42P10: "there is no unique or exclusion constraint matching the ON CONFLICT specification"`.

**Impact**: Every incoming ActBlue webhook hits this error during the donor demographics upsert step, and the entire webhook processing fails. The transaction itself (which inserts into `actblue_transactions` before this step) may succeed, but the error causes the webhook log to be marked as `failed` and the HTTP response returns 500, so **ActBlue may retry or drop these**.

## The Fix (2 parts)

### Part 1: Database — Restore a plain unique constraint alongside the functional index

Create a migration that adds back a simple unique constraint that the Supabase JS `onConflict` can reference, while keeping the case-insensitive index for query optimization:

```sql
ALTER TABLE donor_demographics
  ADD CONSTRAINT donor_demographics_org_donor_email_unique
  UNIQUE (organization_id, donor_email);
```

### Part 2: Edge Function — Make the upsert resilient

Update `actblue-webhook/index.ts` line 541 to reference the new constraint. Also wrap the donor demographics upsert in a try-catch so that if it fails, the core transaction still succeeds (donor demographics is supplementary, not critical).

### Part 3: Recover the 344 failed webhooks

Run the `reprocess-failed-webhooks` edge function to re-process the 344 failed webhook payloads that are safely stored in `webhook_logs`. All donation data is preserved in the payloads and can be recovered.

## Files to Change

| File | Change |
|------|--------|
| New migration SQL | Add back `UNIQUE (organization_id, donor_email)` constraint |
| `supabase/functions/actblue-webhook/index.ts` | Wrap donor_demographics upsert in try-catch to prevent it from killing the whole webhook |

## Timeline

- **March 16, ~18:25 UTC**: Migration `20260316182431` applied, dropping the unique constraint
- **March 16, 18:28 UTC**: First webhook failure (344 total since then)
- **Impact**: All orgs with active webhooks affected; some orgs still show recent data from successful webhooks that occurred before the migration

