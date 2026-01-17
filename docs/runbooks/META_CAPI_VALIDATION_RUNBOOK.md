# Meta CAPI Validation Runbook

## Overview

This runbook provides step-by-step instructions for validating the Meta Conversions API (CAPI) integration for a client organization. Follow these steps after configuring CAPI in the admin UI.

---

## Security Architecture

**No Plaintext PII Stored**: All user data (email, phone, name, address) is hashed using SHA-256 *before* being stored in `meta_conversion_events.user_data_hashed`. This ensures:

- No plaintext PII exists in the database
- Privacy mode filtering happens at send time, not storage time
- Data breach impact is minimized (only hashes, no recoverable PII)
- Compliant with data minimization principles

The following data is **never** sent to Meta regardless of privacy mode:
- Employer
- Occupation
- Street address

---

## Prerequisites

Before starting validation:

1. **CAPI Configured**: The organization has CAPI enabled in the admin panel
2. **Access Token**: A valid Meta access token is stored
3. **Pixel ID**: The correct Pixel ID is configured
4. **ActBlue Integration**: ActBlue webhook is working and receiving donations

---

## Step 1: Obtain Test Event Code

1. Go to [Meta Events Manager](https://business.facebook.com/events_manager2)
2. Select the correct Pixel/Data Source
3. Click **Test Events** tab
4. Copy the **Test Event Code** (e.g., `TEST12345`)
5. In the admin UI, paste this code into the **Test Event Code** field and save

> **Important**: The Test Event Code expires after 24 hours of inactivity

---

## Step 2: Send a Test Donation

Option A: **Use ActBlue Test Mode**
1. Access your ActBlue test/staging form
2. Make a test donation ($1)
3. Note the transaction ID from the confirmation

Option B: **Use Production with Refund**
1. Make a small real donation ($1)
2. Plan to refund immediately after testing
3. Note the transaction ID

---

## Step 3: Verify Event in Meta Test Events

1. Return to Meta Events Manager → Test Events
2. Within 60 seconds, you should see:
   - **Event Name**: `Purchase` (or your configured donation_event_name)
   - **Event ID**: A UUID
   - **Match Quality**: Score showing how well user data matched

3. Click on the event to see details:
   - `event_time`: Should match donation timestamp
   - `value`: Should match donation amount
   - `currency`: Should be `USD`
   - `user_data`: Should show hashed fields based on privacy mode

### Expected User Data by Privacy Mode

| Privacy Mode | Fields Sent |
|--------------|-------------|
| Conservative | em (email hash), ph (phone hash), zp (zip hash), country, external_id, fbp, fbc |
| Balanced | + fn (first name), ln (last name), ct (city), st (state) |
| Aggressive | + client_ip_address, client_user_agent |

---

## Step 4: Verify Deduplication

### Check Database for Dedupe Key

```sql
-- Find the conversion event for your test donation
SELECT
  id,
  event_id,
  dedupe_key,
  status,
  created_at,
  delivered_at
FROM meta_conversion_events
WHERE organization_id = 'YOUR_ORG_ID'
  AND source_id = 'YOUR_TRANSACTION_ID'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected**: One row with `status = 'sent'` and `delivered_at` populated.

### Test Idempotency

1. Trigger the same webhook again (if possible via replay)
2. Verify only ONE event exists in `meta_conversion_events`
3. The `dedupe_key` constraint prevents duplicates

```sql
-- Verify no duplicates
SELECT dedupe_key, COUNT(*)
FROM meta_conversion_events
WHERE organization_id = 'YOUR_ORG_ID'
GROUP BY dedupe_key
HAVING COUNT(*) > 1;
```

**Expected**: Zero rows (no duplicates).

---

## Step 5: Verify ActBlue Ownership Toggle

If the client has ActBlue CAPI enabled:

1. Enable **"ActBlue sends donation events"** toggle in admin UI
2. Send another test donation
3. Check `meta_conversion_events`:

```sql
SELECT id, event_id, status, created_at
FROM meta_conversion_events
WHERE organization_id = 'YOUR_ORG_ID'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected**: No new event created (webhook should skip enqueueing).

4. Check Supabase function logs for:
   ```
   [CAPI] ActBlue owns donation CAPI for org: YOUR_ORG_ID
   ```

---

## Step 6: Verify Health Stats

After sending events, check the org's health stats:

```sql
SELECT
  pixel_id,
  is_enabled,
  last_send_at,
  last_send_status,
  last_error,
  total_events_sent,
  total_events_failed
FROM meta_capi_config
WHERE organization_id = 'YOUR_ORG_ID';
```

**Expected**:
- `is_enabled = true`
- `last_send_status = 'success'`
- `total_events_sent > 0`
- `total_events_failed = 0`

---

## Step 7: Remove Test Event Code

After validation is complete:

1. Go to admin UI → CAPI Settings
2. Clear the **Test Event Code** field
3. Save settings

> **Important**: Remove the test code before go-live. Events sent with test code are not used for optimization.

---

## Troubleshooting

### Event Not Appearing in Meta Test Events

1. **Check outbox status**:
   ```sql
   SELECT status, last_error, retry_count
   FROM meta_conversion_events
   WHERE organization_id = 'YOUR_ORG_ID'
   ORDER BY created_at DESC
   LIMIT 1;
   ```

2. **Check scheduled job ran**:
   ```sql
   SELECT * FROM job_executions
   WHERE job_id IN (
     SELECT id FROM scheduled_jobs WHERE job_type = 'process_meta_capi_outbox'
   )
   ORDER BY started_at DESC
   LIMIT 5;
   ```

3. **Check function logs** in Supabase Dashboard → Edge Functions → `process-meta-capi-outbox`

### Auth Error (Error 190)

- Token expired or invalid
- Regenerate token in Meta Events Manager
- Update in admin UI

### Invalid Pixel ID Error

- Verify Pixel ID is correct (16-digit number)
- Ensure token has permission for this pixel

### Low Match Quality

- Check if email/phone are being sent
- Verify fbp/fbc cookies are captured
- Consider upgrading privacy mode from Conservative to Balanced

---

## Validation Checklist

Use this checklist for each client onboarding:

- [ ] CAPI config created in database
- [ ] Access token stored and encrypted
- [ ] Pixel ID verified correct
- [ ] Test Event Code added for validation
- [ ] Test donation sent
- [ ] Event appears in Meta Test Events within 60 seconds
- [ ] Event data matches donation (amount, currency, user data)
- [ ] No duplicate events in database
- [ ] If ActBlue CAPI enabled: verify events are skipped
- [ ] Health stats show success
- [ ] Test Event Code removed after validation

---

## SQL Queries Reference

### Find All CAPI-Enabled Orgs

```sql
SELECT
  c.id,
  c.organization_id,
  o.name as org_name,
  c.pixel_id,
  c.privacy_mode,
  c.is_enabled,
  c.actblue_owns_donation_complete,
  c.last_send_at,
  c.last_send_status,
  c.total_events_sent,
  c.total_events_failed
FROM meta_capi_config c
JOIN client_organizations o ON o.id = c.organization_id
WHERE c.is_enabled = true
ORDER BY c.last_send_at DESC NULLS LAST;
```

### Check Outbox Queue Depth

```sql
SELECT
  organization_id,
  status,
  COUNT(*) as count
FROM meta_conversion_events
WHERE status IN ('pending', 'failed')
GROUP BY organization_id, status
ORDER BY count DESC;
```

### Recent Events by Org

```sql
SELECT
  event_name,
  event_id,
  dedupe_key,
  status,
  created_at,
  delivered_at,
  last_error
FROM meta_conversion_events
WHERE organization_id = 'YOUR_ORG_ID'
ORDER BY created_at DESC
LIMIT 20;
```

---

## Contacts

- **Meta CAPI Documentation**: https://developers.facebook.com/docs/marketing-api/conversions-api
- **Events Manager**: https://business.facebook.com/events_manager2
- **Test Events Guide**: https://developers.facebook.com/docs/marketing-api/conversions-api/using-the-api#testEvents

---

*Last Updated: 2026-01-17*
