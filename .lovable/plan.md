
# Final Fix: Register tag-trend-geographies Edge Function

## Problem Found

During the deep health check, I discovered **1 remaining edge function** that exists in the filesystem but is not registered in `supabase/config.toml`:

| Function | Purpose | Status |
|----------|---------|--------|
| `tag-trend-geographies` | Tags geographic scope (state/local/national/international) for trend events | **NOT DEPLOYED** |

This function is called by the trend analysis pipeline to enrich trend events with geographic context.

---

## Overall Health Status: GOOD

After the earlier fixes that registered 41+ missing functions, the portal and scheduled jobs are now working well:

**Working Components:**
- Portal (`portal.molitico.com`) - db-proxy responding
- Health check - database, email, environment all passing
- 35+ scheduled jobs running successfully
- Meta CAPI outbox processing
- SMS sync and analysis
- Attribution calculations
- Creative learnings
- Integration health monitoring
- Token refresh

**Jobs Previously Failing, Now Working:**
- `correlate-social-news` - Now returning 200
- `batch-analyze-content` - Now returning 200  
- `calculate-creative-learnings` - Now returning 200
- `sync-sms-insights` - Now returning 200
- `analyze-sms-campaigns` - Now returning 200
- `backfill-recent-capi` - Now returning 200

---

## Implementation

### Step 1: Add Missing Registration to config.toml

Add the following entry to `supabase/config.toml`:

```toml
# --- TREND ANALYSIS FUNCTIONS (continued) ---
[functions.tag-trend-geographies]
verify_jwt = false  # Uses CRON_SECRET auth internally
```

### Step 2: Deploy the Function

After adding the registration, deploy `tag-trend-geographies` to make it available.

---

## Summary

| Category | Status |
|----------|--------|
| Portal Functions | ✅ All working |
| Meta CAPI Functions | ✅ All 6 registered and deployed |
| SMS Functions | ✅ All 5 registered and deployed |
| Attribution Functions | ✅ All 2 registered and deployed |
| Donor/LTV Functions | ✅ All 3 registered and deployed |
| Creative/Ad Functions | ✅ All 5 registered and deployed |
| Learning/AI Functions | ✅ All 4 registered and deployed |
| Backfill Functions | ✅ All 3 registered and deployed |
| Tracking Functions | ✅ All 2 registered and deployed |
| Trend Analysis Functions | ⚠️ 1 missing (tag-trend-geographies) |

After this final fix, all edge functions will be properly registered and the portal will be fully operational.
