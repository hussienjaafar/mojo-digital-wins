
# Fix Recent Activity Feed Channel Attribution

## Problem Summary

The "Recent Activity" feed in the single-day view shows incorrect channel tags. Donations that should be labeled as "Meta" are displaying as "Other" because:

| Current Flow (Broken) |
|----------------------|
| `get_recent_donations` RPC returns only `refcode` |
| Frontend `getChannelFromRefcode()` pattern-matches refcode |
| "gaza0108" doesn't match "meta/fb/facebook" patterns |
| Result: Shows "Other" instead of "Meta" |

**Database Evidence:**
- John ($10), Herman ($10), Elisabeth ($10) all have `click_id`, `source_campaign: meta`, and `contribution_form: moliticometa`
- The database function `detect_donation_channel()` correctly returns "meta" for these
- But the RPC never sends this data to the frontend

## Solution Overview

Update the `get_recent_donations` RPC to return the correctly detected channel using the existing `detect_donation_channel` SQL function, then update the frontend to use this server-provided channel.

---

## Implementation Plan

### Step 1: Update get_recent_donations RPC

Create a new migration to update the RPC to return the channel:

```sql
CREATE OR REPLACE FUNCTION public.get_recent_donations(
  _organization_id UUID,
  _date DATE,
  _limit INTEGER DEFAULT 20,
  _timezone TEXT DEFAULT 'America/New_York'
)
RETURNS TABLE (
  id UUID,
  amount NUMERIC,
  net_amount NUMERIC,
  donor_first_name TEXT,
  transaction_date TIMESTAMPTZ,
  is_recurring BOOLEAN,
  refcode TEXT,
  channel TEXT  -- NEW COLUMN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.amount,
    t.net_amount,
    t.first_name AS donor_first_name,
    t.transaction_date,
    COALESCE(t.is_recurring, false) AS is_recurring,
    t.refcode,
    -- Use the system-wide channel detection function
    public.detect_donation_channel(
      t.contribution_form,
      t.refcode,
      t.source_campaign,
      t.click_id,
      t.fbclid,
      NULL,  -- attributed_campaign_id (not available in this context)
      NULL,  -- attributed_ad_id
      NULL   -- attribution_method
    ) AS channel
  FROM actblue_transactions t
  WHERE t.organization_id = _organization_id
    AND (t.transaction_date AT TIME ZONE _timezone)::DATE = _date
    AND t.transaction_type = 'donation'
  ORDER BY t.transaction_date DESC
  LIMIT _limit;
END;
$$;
```

### Step 2: Update RecentDonation Interface

In `src/hooks/useHourlyMetrics.ts`, add `channel` to the interface:

```typescript
export interface RecentDonation {
  id: string;
  amount: number;
  net_amount: number;
  donor_name: string | null;
  transaction_date: string;
  is_recurring: boolean;
  refcode: string | null;
  channel: string | null;  // NEW
}
```

### Step 3: Update fetchRecentDonations

In `src/hooks/useHourlyMetrics.ts`, map the new channel field:

```typescript
async function fetchRecentDonations(
  organizationId: string,
  date: string
): Promise<RecentDonation[]> {
  const { data, error } = await supabase.rpc("get_recent_donations", {
    _organization_id: organizationId,
    _date: date,
    _limit: 20,
    _timezone: "America/New_York",
  });

  if (error) throw error;
  
  return (data || []).map((row: any) => ({
    id: row.id,
    amount: Number(row.amount) || 0,
    net_amount: Number(row.net_amount) || 0,
    donor_name: row.donor_first_name || null,
    transaction_date: row.transaction_date,
    is_recurring: row.is_recurring || false,
    refcode: row.refcode || null,
    channel: row.channel || null,  // NEW
  }));
}
```

### Step 4: Update RecentActivityFeed Component

In `src/components/client/RecentActivityFeed.tsx`, update to use server-provided channel:

```typescript
// Update getChannelFromRefcode to accept optional pre-computed channel
function getDisplayChannel(
  serverChannel: string | null, 
  refcode: string | null
): string {
  // If server provided a channel, use it (with proper capitalization)
  if (serverChannel) {
    switch (serverChannel.toLowerCase()) {
      case 'meta': return 'Meta';
      case 'sms': return 'SMS';
      case 'email': return 'Email';
      case 'google': return 'Google';
      case 'other': return 'Other';
      case 'unattributed': return 'Direct';
      default: return 'Other';
    }
  }
  
  // Fallback to old logic for backward compatibility
  if (!refcode) return "Direct";
  
  const lower = refcode.toLowerCase();
  if (lower.includes("sms") || lower.includes("text")) return "SMS";
  if (lower.includes("meta") || lower.includes("facebook") || lower.includes("fb")) return "Meta";
  if (lower.includes("email") || lower.includes("em_")) return "Email";
  if (lower.includes("google") || lower.includes("ggl")) return "Google";
  
  return "Other";
}
```

And update the DonationItem to use it:

```typescript
// In DonationItem component
const channel = getDisplayChannel(donation.channel, donation.refcode);
```

---

## Files to Modify

| File | Action | Description |
|------|--------|-------------|
| Database Migration | **CREATE** | Update `get_recent_donations` RPC to return `channel` column |
| `src/hooks/useHourlyMetrics.ts` | **MODIFY** | Add `channel` to `RecentDonation` interface and mapping |
| `src/components/client/RecentActivityFeed.tsx` | **MODIFY** | Use server-provided channel with fallback |

---

## Expected Results After Fix

| Donor | Before | After | Reason |
|-------|--------|-------|--------|
| Colin ($1,000) | Direct | Direct | No attribution signals (unattributed) |
| Ryan ($1) | Other | Other | refcode="web" with no platform match |
| John ($10) | **Other** | **Meta** | Has click_id and source_campaign=meta |
| Herman ($10) | **Other** | **Meta** | Has click_id and source_campaign=meta |
| Elisabeth ($10) | **Other** | **Meta** | Has click_id and source_campaign=meta |
| Keishon ($100) | Direct | Direct | No attribution signals (unattributed) |
| Sydney ($10) | **Other** | **Meta** | Has source_campaign=meta |
| Afaf ($25) | **Other** | **Meta** | Has click_id and source_campaign=meta |

---

## Technical Notes

1. **Single Source of Truth**: Uses the existing `detect_donation_channel` SQL function, ensuring consistency with the dashboard attribution system

2. **Backward Compatible**: Frontend includes fallback logic in case the RPC returns null for channel (e.g., during migration rollout)

3. **No Performance Impact**: The channel detection is done inline in the query, no additional joins required

4. **Channel Mapping**:
   - `meta` → "Meta" (blue badge)
   - `sms` → "SMS" (green badge)
   - `email` → "Email" (purple badge)
   - `unattributed` → "Direct" (gray badge)
   - `other` → "Other" (gray badge)
