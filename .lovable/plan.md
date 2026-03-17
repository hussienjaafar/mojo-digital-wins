

# Fix: Reprocessed Donations Missing Attribution Data

## Root Cause

The `reprocess-failed-webhooks` function has a payload parsing bug. The ActBlue webhook payload structure is:

```text
payload
├── donor: { email, firstname, ... }
├── lineitems: [...]
└── contribution: { refcode, refcodes: {}, contributionForm, ... }
```

The main `actblue-webhook` correctly reads `parsedPayload.contribution` (line 309). But the reprocessor at line 152 does:

```ts
const contribution = payload;        // BUG: should be payload.contribution
const refcodes = contribution.refcodes || {};  // reads payload.refcodes → undefined
```

This means `refcode`, `refcode2`, `contributionForm`, `recurringPeriod`, `orderNumber`, `paymentMethod`, and all other contribution-level fields are NULL for all 344 reprocessed transactions.

## Impact

- **307 of 344** reprocessed donations had refcodes in their payloads — all lost
- **344 of 344** had `contributionForm` — all lost
- This kills channel attribution for the last ~24 hours across all affected orgs

## The Fix (2 parts)

### Part 1: Fix the reprocessor code

In `supabase/functions/reprocess-failed-webhooks/index.ts`, change line 152 from:

```ts
const contribution = payload;
```

to:

```ts
const contribution = payload.contribution || payload;
```

This reads from the correct nested object while remaining backward-compatible with any payloads that might have been stored in a flat format.

Also fix the `donor` extraction (line 154) — currently `contribution.donor` reads `payload.donor` by accident (works because `payload.donor` exists at top level), but should be explicit:

```ts
const donor = payload.donor || {};
const refcodes = contribution.refcodes || {};
```

### Part 2: Re-run the reprocessor to update the 344 transactions

After deploying the fix, re-invoke the reprocessor. Since the transactions already exist (upsert with `ignoreDuplicates: false`), the reprocessor will UPDATE them with the correct attribution fields.

But first, we need to reset those webhook logs back to `reprocessed` → allow re-reprocessing. The current code skips webhooks where `reprocessed_at IS NOT NULL` (line 73). We have two options:

- **Option A**: Temporarily NULL out `reprocessed_at` on the 344 webhooks, re-run the reprocessor, then it will re-upsert with correct data.
- **Option B**: Add a `force_reprocess` parameter to the function that skips the `reprocessed_at IS NULL` filter.

I recommend **Option A** (simpler, one-time fix) combined with the code fix.

## Files to Change

| File | Change |
|------|--------|
| `supabase/functions/reprocess-failed-webhooks/index.ts` | Fix `contribution` to read from `payload.contribution` |
| Database (data update) | NULL out `reprocessed_at` on the 344 webhooks so they can be reprocessed |
| Deploy + invoke | Re-run reprocessor for each affected org to restore attribution |

