# Data & Attribution Roadmap (Mojo Digital Wins)

This living doc tracks the phased plan to get optimal use of ActBlue, Meta, and Switchboard data. Checkboxes show what's shipped on `main`.

## Phase / Sprint Plan

- [x] **Sprint 1: Deterministic attribution scaffolding & SMS identity**
  - [x] Capture click IDs (click_id/fbclid) on ActBlue transactions and expose in secure view.
  - [x] Add `phone_hash` to `sms_events` and ingest per-recipient events (sent/delivered/clicked/replied/opted_out/failed).
  - [x] Deterministic attribution filter and quality badge in Donor Intelligence.
- [x] **Sprint 2: Recurring health & refund-aware insights**
  - [x] Track recurring state (active/paused/failed) and next_charge_date from ActBlue; surface churn/recurring health KPIs.
  - [x] Wire chargebacks/failed payments (if available) and net-LTV; extend channel/attribution views with refund overlays (fundraising chart already net/refund-aware).
- [x] **Sprint 3: Donor journeys & SMS effectiveness**
  - [x] Donor journeys view joining sms_events (by phone hash), attribution_touchpoints, and donations (donor_id_hash/phone hash).
  - [x] SMS funnel widget (sent > delivered > clicked > donated > opt-out) with rates; per-recipient cost estimation.
- [ ] **Sprint 4: Creative/topic and deterministic uplift**
  - [x] Backfill/refcode reconciliation function (Meta creatives + refcode_mappings).
  - [x] Stronger linkage using click_id/fbclid when refcodes are absent.
  - [x] Simple retention/LTV predictions (90/180-day repeat probability) and net revenue forecasts; creative/topic performance cards with deterministic attribution %.
  - [x] **AUDIT FIX**: Removed fake Meta touchpoints (aggregated data was incorrectly stored as per-donor events).
  - [x] **AUDIT FIX**: Added `is_deterministic` flag to `campaign_attribution` for explicit attribution type tracking.
  - [x] **AUDIT FIX**: Hardened probabilistic attribution to never overwrite deterministic results.
  - [x] **AUDIT FIX**: Updated UI labels to reflect actual data capabilities (no false precision).
- [ ] **Sprint 5: Hardening & backfills**
  - Backfill jobs (refcode_mappings reconciliation, SMS hash backfill, recurring status backfill).
  - Alerts for attribution quality drops and SMS opt-out spikes; runbooks for syncs.
  - Run `match-touchpoints-to-donors` to populate `donor_identity_links` table.

## Recently Completed (main)
- Migration: `20251210150000_sprint1_attribution_sms_identity.sql` (click_id/fbclid, phone_hash, secure view).
- ActBlue webhook: click_id/fbclid extraction from custom fields.
- Switchboard sync: per-recipient messages + sms_events with phone_hash and event_type derivation.
- Donor Intelligence UI: deterministic attribution quality badge + filter for platform/topic charts.
- Sprint 2/3 UI: recurring health KPIs, refund-aware channel summaries, journeys tab, SMS funnel and CAC.
- Sprint 4 (partial): refcode and click_id reconciliation functions, heuristic LTV table + UI placeholder.
- **Attribution Audit (2026-01-03)**: Removed fake Meta touchpoints, added `is_deterministic`/`attribution_type` columns, updated UI labels.

## Attribution System Limitations (Documented 2026-01-03)

### What We CAN Attribute (Deterministic)
- **ActBlue refcodes**: When a donor clicks a link with `?refcode=xyz`, we can trace the donation to the campaign that generated that link.
- **click_id / fbclid**: When Meta passes these through ActBlue custom fields, we can match to Meta campaigns.
- **SMS phone-hash**: When a donor gives us their phone during donation, we can link SMS events to that donor via hash matching.

### What We CANNOT Attribute (No Per-Donor Data)
- **Meta impressions**: The Marketing API only provides aggregated totals (e.g., "Campaign X had 10,000 impressions"). We cannot know which specific donors saw the ad.
- **Meta clicks without refcode**: If someone clicks a Meta ad but the landing page doesn't capture a refcode/click_id in ActBlue, we cannot link the click to a donation.
- **View-through conversions**: Meta tracks these but doesn't share per-user data — only aggregates.

### Why This Matters
Previously, the system was creating "fake" per-donor touchpoints from aggregated Meta data, which made it appear we had per-donor attribution when we didn't. This has been removed to prevent misleading users.

## Regression Protection (Added 2026-01-03)

### Backend Guardrails
1. **sync-meta-ads**: Header comment explicitly prohibits creating attribution_touchpoints. Code logs "[DEPRECATED]" when skipping fake touchpoint creation.
2. **probabilistic-attribution**: Header comment documents scope constraints. Code checks `is_deterministic=true` before processing and never overwrites deterministic records.
3. **campaign_attribution table**: `is_deterministic` flag distinguishes hard matches from probabilistic guesses.

### UI Safeguards
1. **AttributionChart**: Shows warning banner about refcode-only attribution.
2. **ClientAttribution**: Uses "Match Type" labels instead of misleading "Confidence %" badges.
3. **ClientDonorJourney**: Page description updated to "Refcode-based attribution".
4. **DonorIntelligence**: Tooltip explains Meta aggregated data limitation.

### Audit Verification (run periodically)
```sql
-- Check for any fake Meta touchpoints (should return 0)
SELECT COUNT(*) FROM attribution_touchpoints 
WHERE touchpoint_type LIKE 'meta_ad%' AND donor_email IS NULL;

-- Verify deterministic/probabilistic split
SELECT is_deterministic, attribution_type, COUNT(*) 
FROM campaign_attribution 
GROUP BY is_deterministic, attribution_type;
```

## Next Actions
- Wire scheduled jobs for refcode/click_id reconciliation and LTV refresh.
- Run identity linking job to populate `donor_identity_links` from ActBlue phone numbers.
- Improve LTV model quality (beyond heuristic) and surface creative/topic ROAS once costs ingested.
- Add alerts for attribution quality drops and SMS opt-out spikes.
