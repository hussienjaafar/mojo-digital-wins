

# Investigation: Attributed ROI and Revenue Calculations

## Summary

MPAC's attribution pipeline is actually **working correctly** — the RPC returns $3,384 meta-attributed revenue against $3,321 meta spend for March (ROI ≈ 1.0x). The issue is **systemic across other orgs** and has **two distinct root causes** plus a minor data accuracy bug.

## Root Cause 1 (CRITICAL): `admin-sync-meta` crashes on null credentials

As identified in the prior investigation, the function crashes at line 146 (`ad_account_id.startsWith('act_')`) when credentials are missing. This blocks:

| Org | Donations | Impact |
|-----|-----------|--------|
| Abdul For Senate | 100,916 | Zero meta campaigns, zero spend — ROI always 0 |
| Ali for Passaic County | 127 | Same |
| Hamawy For New Jersey | 1,144 | Same |

**Fix**: Add null-safe credential validation in `admin-sync-meta/index.ts` (the plan you already approved but hasn't been implemented yet).

## Root Cause 2: Case-sensitive refcode JOIN loses attribution

The `get_actblue_dashboard_metrics` RPC joins `actblue_transactions.refcode` to `refcode_mappings.refcode` with an **exact, case-sensitive match** (line 21: `AND t.refcode = rm.refcode`).

For MPAC specifically:
- `BLKadl` (20 donations, $843) → mapping exists only as `blkadl` → **not matched**
- `HTapk` (13 donations, $330) → mapping exists only as `htapk` → **not matched**  
- `HTinfstrctr` (26 donations, $650) → no mapping at all

This affects all orgs. For MPAC, 33 donations ($1,173) are lost to case mismatch alone.

**Fix**: Change the JOIN in the RPC from `AND t.refcode = rm.refcode` to `AND LOWER(t.refcode) = LOWER(rm.refcode)`.

## Root Cause 3: `net_revenue` field not read from RPC response

The RPC returns both `revenue` (gross) and `net_revenue` (net after fees) per channel, but the frontend `RPCChannel` TypeScript interface omits `net_revenue`. Line 196 of `useActBlueMetrics.ts` sets:
```ts
net: c.revenue || 0, // Approximate - fees not broken down by channel
```

This means the ROI breakdown shows gross revenue as "net" — a ~4% overstatement for most orgs. Not a zero-value bug, but inaccurate.

**Fix**: Add `net_revenue` to the `RPCChannel` interface and use it.

## Files to Change

| File | Change |
|------|--------|
| `supabase/functions/admin-sync-meta/index.ts` | Add null-safe credential validation before `.startsWith()` call |
| New migration SQL | Alter `get_actblue_dashboard_metrics` to use `LOWER()` on the refcode JOIN |
| `src/hooks/useActBlueMetrics.ts` | Add `net_revenue` to `RPCChannel` interface; use `c.net_revenue` for `net` field |
| Database: `client_api_credentials` | Deactivate dummy Meta credentials for 4 test orgs |

## Priority Order

1. **admin-sync-meta crash fix** — unblocks 3 orgs including the largest (Abdul, 100K donations)
2. **Case-insensitive refcode JOIN** — recovers misattributed revenue across all orgs
3. **net_revenue field fix** — corrects minor accuracy issue in ROI display

