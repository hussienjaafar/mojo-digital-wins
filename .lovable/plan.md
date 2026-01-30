

# Abdul for Senate Webhook Recovery Plan

## Summary
The webhook credentials for Abdul for Senate have been updated correctly, but there are 1,107 failed webhook events from Jan 28-30 that need to be reprocessed to recover the missed donation data.

---

## Current State

| Item | Status |
|------|--------|
| Credentials in database | Correctly configured (MOJAFS / molitico2026) |
| Entity ID | 168679 (matches) |
| Last webhook received | 21:57:36 UTC (before credential update) |
| New webhooks since update | 0 (waiting for new donations) |
| Failed webhooks to recover | 1,107 events |

---

## Problem Timeline

```text
Jan 28-30: Webhooks arriving but failing auth (wrong credentials stored)
     |
22:03:33 UTC: You updated credentials to correct values
     |
Now: Waiting for new ActBlue webhook to verify fix
```

---

## Solution: Reprocess Failed Webhooks

Create an edge function or SQL procedure to:
1. Find all failed webhook events for Abdul's org
2. Re-validate using the updated credentials
3. Process the payload data into actblue_transactions
4. Mark events as reprocessed

---

## Implementation

### Option A: Edge Function for Bulk Reprocessing

Create `supabase/functions/reprocess-failed-webhooks/index.ts`:

**Functionality:**
- Accept organization_id as parameter
- Query webhook_logs where status = 'failed' and error = 'Authentication failed'
- For each event, extract the payload and insert into actblue_transactions
- Skip authentication validation (since we're reprocessing stored data)
- Update webhook_logs to mark as 'reprocessed'

**Key code flow:**
```text
1. Fetch failed webhook_logs for org
2. For each log entry:
   a. Parse stored payload
   b. Extract donation data (donor, amount, refcodes, etc.)
   c. Insert into actblue_transactions (skip duplicates)
   d. Update webhook_log status to 'reprocessed'
3. Return summary (processed count, skipped count, errors)
```

### Option B: Direct SQL Reprocessing

Use stored procedure to:
1. Join webhook_logs with the expected transaction schema
2. Insert missing transactions directly
3. More efficient for large volumes

---

## Files to Create/Modify

| File | Purpose |
|------|---------|
| `supabase/functions/reprocess-failed-webhooks/index.ts` | Edge function to reprocess failed events |
| Admin UI button (optional) | Trigger reprocessing from Integration Center |

---

## Technical Details

### Edge Function Structure

```typescript
// 1. Validate admin access
// 2. Query failed webhooks for organization
const { data: failedWebhooks } = await supabase
  .from('webhook_logs')
  .select('id, payload, received_at')
  .eq('organization_id', organization_id)
  .eq('processing_status', 'failed')
  .eq('error_message', 'Authentication failed')
  .order('received_at', { ascending: true });

// 3. Process each webhook payload (reuse existing logic from actblue-webhook)
// 4. Insert transactions, handle deduplication
// 5. Update webhook_logs status
```

### Deduplication Strategy

Use `transaction_id` (lineitemId from ActBlue) as unique key:
```sql
ON CONFLICT (organization_id, transaction_id) DO NOTHING
```

---

## Verification Steps

After implementation:
1. Run reprocessing for Abdul's org (8ba98ab9-e079-4e93-90dc-269cd384e99b)
2. Verify transaction count increased by ~1,107
3. Check donation totals in dashboard match ActBlue reports
4. Monitor next real webhook to confirm authentication works

---

## Expected Outcome

- Recover 1,107 missed donations from Jan 28-30
- Dashboard shows complete donation history
- Future webhooks authenticate successfully with new credentials

