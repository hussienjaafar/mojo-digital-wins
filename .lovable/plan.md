
# Portal & Edge Functions Deep Health Check Report

## Executive Summary

I've completed a comprehensive analysis of the portal, edge functions, and scheduled jobs. While the recent fix for `db-proxy`, `get-client-ip`, and `geolocate-ip` has resolved the portal's immediate loading issues, I discovered **significant systemic problems** that require attention.

---

## Issue Categories

### CRITICAL: 40+ Edge Functions Not Registered in config.toml

These functions exist in the filesystem but are **NOT registered** in `supabase/config.toml`, meaning they will never be deployed and will return 404 errors when called.

| Function Name | Purpose | Impact |
|---------------|---------|--------|
| `process-meta-capi-outbox` | Sends conversion events to Meta CAPI | **Meta CAPI broken** |
| `refresh-meta-tokens` | Refreshes expiring OAuth tokens | Tokens will expire |
| `log-user-activity` | Logs user actions for analytics | Activity tracking broken |
| `manage-invitation` | Handles invitation mutations for portal | Portal invitations broken |
| `create-client-user` | Creates client users | User creation may fail |
| `import-gdrive-video` | Imports videos from Google Drive | Video import broken |
| `sync-meta-ad-videos` | Syncs Meta ad videos | Video sync broken |
| `transcribe-meta-ad-video` | Transcribes Meta ad videos | Transcription broken |
| `track-email-interaction` | Tracks email opens/clicks | Email tracking broken |
| `track-state-actions` | Tracks state-level actions | State tracking broken |
| `correlate-trends-campaigns` | Links trends to campaign outcomes | Trend correlation broken |
| `decay-stale-affinities` | Prevents filter bubbles | Affinity decay broken |
| `tag-trend-geographies` | Tags geographic scope of trends | Geo-tagging broken |
| `tag-trend-policy-domains` | Tags policy domains for trends | Policy tagging broken |
| `analyze-creative-motivation` | Analyzes creative motivation | Creative analysis broken |
| `analyze-sms-campaigns` | Analyzes SMS campaigns | SMS analysis broken |
| `backfill-actblue-phone-hashes` | Backfills phone hashes | Phone hash backfill broken |
| `backfill-click-attribution` | Backfills click attribution | Attribution backfill broken |
| `backfill-daily-metrics` | Backfills daily metrics | Metrics backfill broken |
| `backfill-onboarding-state` | Backfills onboarding state | Onboarding backfill broken |
| `backfill-recent-capi` | Backfills recent CAPI events | CAPI backfill broken |
| `backfill-sms-refcodes` | Backfills SMS refcodes | Refcode backfill broken |
| `check-integration-health` | Checks integration health | Health checks broken |
| `cleanup-sms-events` | Cleans up SMS events | SMS cleanup broken |
| `clickid-reconcile` | Reconciles click IDs | ClickID reconciliation broken |
| `compute-decision-scores` | Computes decision scores | Decision scoring broken |
| `detect-ad-fatigue` | Detects ad fatigue | Fatigue detection broken |
| `detect-capi-mismatches` | Detects CAPI mismatches | Mismatch detection broken |
| `extract-campaign-topics` | Extracts campaign topics | Topic extraction broken |
| `extract-trend-entities` | Extracts trend entities | Entity extraction broken |
| `get-trends-for-org` | Gets trends for organization | Trend fetching broken |
| `ltv-refresh` | Refreshes LTV calculations | LTV refresh broken |
| `populate-donor-demographics` | Populates donor demographics | Demographics broken |
| `reconcile-sms-refcodes` | Reconciles SMS refcodes | Refcode reconciliation broken |
| `refresh-demographics-cache` | Refreshes demographics cache | Cache refresh broken |
| `resend-capi-with-full-fbclid` | Resends CAPI with full fbclid | CAPI resend broken |
| `retry-meta-conversions` | Retries failed Meta conversions | Retry logic broken |
| `sync-sms-insights` | Syncs SMS insights | SMS insights broken |
| `update-learning-signals` | Updates learning signals | Learning signals broken |
| `update-org-affinities` | Updates org affinities | Affinity updates broken |
| `update-org-interest-model` | Updates org interest model | Interest model broken |

---

### HIGH: Cron Jobs Using Wrong Auth Headers

The `calculate-bluesky-trends` cron job is failing with **401 Unauthorized** because it uses the anon key in the Authorization header instead of the CRON_SECRET:

**Current (Broken):**
```sql
headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJ..."}'::jsonb
```

**Should Be:**
```sql
headers := jsonb_build_object(
  'Content-Type', 'application/json',
  'x-cron-secret', (SELECT value FROM public.cron_config WHERE key = 'cron_secret')
)
```

Functions affected by incorrect cron headers:
- `calculate-bluesky-trends`
- `correlate-trends-campaigns`
- `decay-stale-affinities`
- `tag-trend-geographies`
- `tag-trend-policy-domains`
- `calculate-donor-ltv`
- `populate-donor-journeys`

---

### HIGH: 9 Scheduled Jobs Currently Failing

| Job Name | Endpoint | Failures |
|----------|----------|----------|
| Analyze Articles | `/functions/v1/analyze-articles` | 1 |
| Analyze SMS Campaigns | `analyze-sms-campaigns` | 1 (not registered) |
| Batch Analyze Content | `batch-analyze-content` | 1 |
| Calculate Creative Learnings | `/functions/v1/calculate-creative-learnings` | 1 |
| capi-backfill-hourly | `backfill-recent-capi` | 1 (not registered) |
| Correlate Social & News | `/functions/v1/correlate-social-news` | 1 |
| Recover Stuck Backfill Chunks | `recover-stuck-chunks` | 1 |
| Sync SMS Insights | `sync-sms-insights` | 1 (not registered) |
| TTL Cleanup | `ttl-cleanup` | 1 |

---

### MEDIUM: Security Linter Warnings

- **34 linter issues** detected
- **11+ Security Definer Views** - Views with SECURITY DEFINER property bypass RLS
- **1 RLS Enabled No Policy** - Table with RLS enabled but no policies

---

## Working Components (Confirmed)

| Component | Status |
|-----------|--------|
| Portal login page (`portal.molitico.com`) | Working |
| `db-proxy` edge function | Working |
| `health-check` edge function | Healthy |
| `run-scheduled-jobs` orchestrator | Running |
| `tiered-meta-sync` | Running |
| `bluesky-stream` | Running |
| Database connectivity | Healthy (134ms latency) |
| Email configuration | Configured |

---

## Implementation Plan

### Phase 1: Register Missing Edge Functions (Critical)

Add the following registrations to `supabase/config.toml`:

```toml
# --- MISSING CRON/SCHEDULED FUNCTIONS ---
[functions.process-meta-capi-outbox]
verify_jwt = false

[functions.refresh-meta-tokens]
verify_jwt = false

[functions.correlate-trends-campaigns]
verify_jwt = false

[functions.decay-stale-affinities]
verify_jwt = false

[functions.tag-trend-geographies]
verify_jwt = false

[functions.tag-trend-policy-domains]
verify_jwt = false

[functions.analyze-sms-campaigns]
verify_jwt = false

[functions.backfill-recent-capi]
verify_jwt = false

[functions.sync-sms-insights]
verify_jwt = false

[functions.cleanup-sms-events]
verify_jwt = false

[functions.clickid-reconcile]
verify_jwt = false

[functions.ltv-refresh]
verify_jwt = false

[functions.extract-trend-entities]
verify_jwt = false

[functions.extract-campaign-topics]
verify_jwt = false

[functions.detect-ad-fatigue]
verify_jwt = false

[functions.detect-capi-mismatches]
verify_jwt = false

[functions.update-learning-signals]
verify_jwt = false

[functions.update-org-affinities]
verify_jwt = false

[functions.update-org-interest-model]
verify_jwt = false

[functions.compute-decision-scores]
verify_jwt = false

[functions.retry-meta-conversions]
verify_jwt = false

[functions.resend-capi-with-full-fbclid]
verify_jwt = false

[functions.reconcile-sms-refcodes]
verify_jwt = false

[functions.refresh-demographics-cache]
verify_jwt = false

[functions.populate-donor-demographics]
verify_jwt = false

[functions.backfill-sms-refcodes]
verify_jwt = false

[functions.backfill-click-attribution]
verify_jwt = false

[functions.backfill-daily-metrics]
verify_jwt = false

[functions.backfill-onboarding-state]
verify_jwt = false

[functions.backfill-actblue-phone-hashes]
verify_jwt = false

[functions.check-integration-health]
verify_jwt = false

# --- PORTAL/CLIENT FUNCTIONS ---
[functions.log-user-activity]
verify_jwt = false

[functions.manage-invitation]
verify_jwt = false

[functions.create-client-user]
verify_jwt = false

[functions.get-trends-for-org]
verify_jwt = false

# --- VIDEO/CREATIVE FUNCTIONS ---
[functions.import-gdrive-video]
verify_jwt = true

[functions.sync-meta-ad-videos]
verify_jwt = false

[functions.transcribe-meta-ad-video]
verify_jwt = true

[functions.analyze-creative-motivation]
verify_jwt = true

# --- TRACKING FUNCTIONS ---
[functions.track-email-interaction]
verify_jwt = false

[functions.track-state-actions]
verify_jwt = false
```

### Phase 2: Fix Cron Job Auth Headers

Update the following cron jobs to use `x-cron-secret` instead of JWT Bearer tokens:

- `calculate-bluesky-trends`
- `correlate-trends-campaigns`
- `decay-stale-affinities`
- `tag-trend-geographies`
- `tag-trend-policy-domains`
- `calculate-donor-ltv`
- `populate-donor-journeys`

### Phase 3: Deploy All Functions

After updating config.toml, deploy all newly registered functions.

---

## Summary

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 40+ | Edge functions not deployed (missing config.toml registration) |
| HIGH | 7 | Cron jobs with wrong auth headers (401 errors) |
| HIGH | 9 | Scheduled jobs failing |
| MEDIUM | 34 | Database linter security warnings |

The portal is now loading, but significant backend functionality is broken due to missing function registrations. Recommend implementing Phase 1 immediately to restore critical Meta CAPI and analytics functionality.
