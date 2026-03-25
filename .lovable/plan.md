

# MPAC Attributed ROI/Revenue: Root Cause Found

## The Problem

MPAC's 5 most recent donations (March 16-17) show $0 attributed revenue and 0.0x ROI despite ALL 5 having `refcode: MSLAD7` and `contributionForm: mpac-meta` in their webhook payloads.

## Root Cause

When the ActBlue webhook system went down, 345 webhooks across multiple orgs were logged with `organization_id = NULL` and `processing_status = failed` — including 5 for MPAC. The "backfill" that recovered these donations inserted them into `actblue_transactions` **without using the webhook payloads**, so all attribution fields (`refcode`, `contribution_form`, `order_number`, `payment_method`) are NULL.

The proof:

| Source | refcode | contribution_form |
|--------|---------|-------------------|
| `webhook_logs` payload | `MSLAD7` | `mpac-meta` |
| `actblue_transactions` (what dashboard reads) | `NULL` | `NULL` |

Because `refcode` is NULL, the RPC classifies all 5 as `channel: other`, yielding $0 meta-attributed revenue and 0.0x ROI.

## Scope: Systemic, Not Just MPAC

345 webhooks with `organization_id = NULL` exist since March 16, spanning at least 6 entity IDs (309 for one org, 11 for another, etc.). **All** of these have attribution data in their payloads but were backfilled without it.

## The Fix

### Step 1: Reprocess the 345 NULL-org webhooks using the already-fixed reprocessor

The `reprocess-failed-webhooks` function (which we already fixed to correctly read `payload.contribution`) supports `recover_null_org: true`. This will:
- Resolve each webhook's org from `entityId` → `client_api_credentials`
- Extract `refcode`, `contribution_form`, `order_number` from `payload.contribution`
- Upsert into `actblue_transactions`, overwriting the NULL fields

No code changes needed — just invoke the reprocessor with `recover_null_org: true` and `error_filter: ''` (empty to match all).

### Step 2: Verify the fix

After reprocessing, query the RPC again for MPAC to confirm meta channel revenue appears and ROI calculates correctly.

## Files to Change

None — this is a data recovery operation using the already-fixed reprocessor edge function.

