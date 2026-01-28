
# Fix Donor Intelligence Page Data Population

## Problem Summary

The Donor Intelligence page is not showing any data for "Abdul For Senate" because the underlying `donor_demographics` table has **zero records** for this organization, despite:
- 82,225 ActBlue transactions totaling ~$4.6M
- 32,583 unique donor emails
- A working demographics cache (used by the Demographics page)
- 974 LTV predictions

The Demographics page works because it reads from the `donor_demographics_cache` table (pre-aggregated JSONB). The Donor Intelligence page queries `donor_demographics` directly to enable individual donor filtering and export.

## Root Cause

Abdul For Senate's transaction data was likely imported via a method that bypassed the normal `donor_demographics` population logic (which happens in `sync-actblue-csv` and `actblue-webhook`).

## Solution: Populate donor_demographics from actblue_transactions

We need to backfill the `donor_demographics` table for this organization (and potentially others missing data). This is a one-time operation plus an edge function for future use.

### Implementation Steps

#### 1. Create a "Populate Demographics" Edge Function
Create a new edge function `populate-donor-demographics` that:
- Accepts `organization_id` as input
- Queries `actblue_transactions` to aggregate donor-level data
- Upserts records into `donor_demographics`
- Generates the proper `donor_key` for LTV joins

#### 2. Create Database Function for Bulk Population
Create an RPC function `populate_donor_demographics_bulk` that:
- Efficiently inserts/updates all donors from transactions in a single SQL statement
- Sets proper aggregates (total_donated, donation_count, first/last donation dates, is_recurring)
- Generates the `donor_key` using the standardized hash formula

#### 3. Add UI Trigger on Donor Intelligence Page
Add a "Populate Data" button (or auto-trigger) when the page detects zero demographics records but has transactions.

#### 4. Integrate with Existing Pipelines
The existing "Journeys" and "LTV" buttons on the page already run pipelines - we'll add logic to ensure demographics are populated first.

---

## Technical Implementation

### New Edge Function: `supabase/functions/populate-donor-demographics/index.ts`

```text
Purpose: Bulk populate donor_demographics from actblue_transactions for a given org

Flow:
1. Validate organization_id
2. Call RPC to bulk upsert donors
3. Return count of donors created/updated
```

### New Database Function (Migration)

```sql
CREATE OR REPLACE FUNCTION public.populate_donor_demographics_bulk(_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout TO '180s'
AS $$
DECLARE
  inserted_count integer;
  updated_count integer;
BEGIN
  -- Insert new donors and update existing ones from actblue_transactions
  WITH donor_agg AS (
    SELECT 
      organization_id,
      lower(trim(donor_email)) as email_normalized,
      -- Use most recent non-null values for PII
      (array_agg(donor_first_name ORDER BY transaction_date DESC) FILTER (WHERE donor_first_name IS NOT NULL))[1] as first_name,
      (array_agg(donor_last_name ORDER BY transaction_date DESC) FILTER (WHERE donor_last_name IS NOT NULL))[1] as last_name,
      (array_agg(state ORDER BY transaction_date DESC) FILTER (WHERE state IS NOT NULL))[1] as state,
      (array_agg(city ORDER BY transaction_date DESC) FILTER (WHERE city IS NOT NULL))[1] as city,
      (array_agg(zip ORDER BY transaction_date DESC) FILTER (WHERE zip IS NOT NULL))[1] as zip,
      (array_agg(employer ORDER BY transaction_date DESC) FILTER (WHERE employer IS NOT NULL))[1] as employer,
      (array_agg(occupation ORDER BY transaction_date DESC) FILTER (WHERE occupation IS NOT NULL))[1] as occupation,
      -- Aggregates
      SUM(CASE WHEN transaction_type = 'donation' THEN amount ELSE 0 END) as total_donated,
      COUNT(CASE WHEN transaction_type = 'donation' THEN 1 END) as donation_count,
      MIN(CASE WHEN transaction_type = 'donation' THEN transaction_date END) as first_donation_date,
      MAX(CASE WHEN transaction_type = 'donation' THEN transaction_date END) as last_donation_date,
      BOOL_OR(recurring_period IS NOT NULL AND recurring_period != '' AND recurring_period != 'once') as is_recurring
    FROM actblue_transactions
    WHERE organization_id = _organization_id
      AND donor_email IS NOT NULL
    GROUP BY organization_id, lower(trim(donor_email))
  )
  INSERT INTO donor_demographics (
    organization_id, donor_email, first_name, last_name, state, city, zip,
    employer, occupation, total_donated, donation_count, 
    first_donation_date, last_donation_date, is_recurring, donor_key
  )
  SELECT 
    organization_id,
    email_normalized,
    first_name,
    last_name,
    state,
    city,
    zip,
    employer,
    occupation,
    total_donated,
    donation_count,
    first_donation_date,
    last_donation_date,
    is_recurring,
    'donor_' || substr(md5(email_normalized), 1, 6)
  FROM donor_agg
  ON CONFLICT (organization_id, donor_email) 
  DO UPDATE SET
    first_name = COALESCE(EXCLUDED.first_name, donor_demographics.first_name),
    last_name = COALESCE(EXCLUDED.last_name, donor_demographics.last_name),
    state = COALESCE(EXCLUDED.state, donor_demographics.state),
    city = COALESCE(EXCLUDED.city, donor_demographics.city),
    zip = COALESCE(EXCLUDED.zip, donor_demographics.zip),
    employer = COALESCE(EXCLUDED.employer, donor_demographics.employer),
    occupation = COALESCE(EXCLUDED.occupation, donor_demographics.occupation),
    total_donated = EXCLUDED.total_donated,
    donation_count = EXCLUDED.donation_count,
    first_donation_date = EXCLUDED.first_donation_date,
    last_donation_date = EXCLUDED.last_donation_date,
    is_recurring = EXCLUDED.is_recurring,
    donor_key = EXCLUDED.donor_key,
    updated_at = now();

  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'donors_processed', inserted_count,
    'organization_id', _organization_id
  );
END;
$$;
```

### Frontend Changes: `src/pages/ClientDonorIntelligence.tsx`

Add a new "Populate Demographics" button that:
1. Shows when segment data returns 0 donors
2. Calls the new edge function
3. Invalidates queries after completion

```typescript
const handlePopulateDemographics = async () => {
  if (!organizationId) return;
  setIsPopulating(true);
  try {
    const { data, error } = await supabase.functions.invoke('populate-donor-demographics', {
      body: { organization_id: organizationId }
    });
    if (error) throw error;
    await queryClient.invalidateQueries({ queryKey: ['donor-segment'] });
    toast.success(`Populated ${data?.donors_processed || 0} donor records`);
  } catch (err) {
    toast.error('Failed to populate demographics');
  } finally {
    setIsPopulating(false);
  }
};
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/functions/populate-donor-demographics/index.ts` | Create | Edge function to trigger bulk population |
| Database migration | Create | Add `populate_donor_demographics_bulk` RPC function |
| `src/pages/ClientDonorIntelligence.tsx` | Modify | Add "Populate" button and handler |

---

## Why This Approach

1. **Consistency**: Uses the same `donor_key` formula as LTV predictions for proper joins
2. **Efficiency**: Single SQL statement processes all donors (no N+1 queries)
3. **Idempotent**: Uses UPSERT so it's safe to run multiple times
4. **User-Triggered**: Admins can manually trigger when needed
5. **Extensible**: Can be added to cron for automatic maintenance

---

## Expected Outcome

After implementation:
1. Click "Populate Demographics" on the Donor Intelligence page
2. ~32,583 donor records created for Abdul For Senate
3. Segment builder queries will return data
4. LTV data will join correctly via `donor_key`
5. Filters, exports, and all segment features will work
