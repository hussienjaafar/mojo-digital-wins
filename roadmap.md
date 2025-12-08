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
- [ ] **Sprint 5: Hardening & backfills**
  - Backfill jobs (refcode_mappings reconciliation, SMS hash backfill, recurring status backfill).
  - Alerts for attribution quality drops and SMS opt-out spikes; runbooks for syncs.

## Recently Completed (main)
- Migration: `20251210150000_sprint1_attribution_sms_identity.sql` (click_id/fbclid, phone_hash, secure view).
- ActBlue webhook: click_id/fbclid extraction from custom fields.
- Switchboard sync: per-recipient messages + sms_events with phone_hash and event_type derivation.
- Donor Intelligence UI: deterministic attribution quality badge + filter for platform/topic charts.
- Sprint 2/3 UI: recurring health KPIs, refund-aware channel summaries, journeys tab, SMS funnel and CAC.
- Sprint 4 (partial): refcode and click_id reconciliation functions, heuristic LTV table + UI placeholder.

## Next Actions
- Wire scheduled jobs for refcode/click_id reconciliation and LTV refresh.
- Improve LTV model quality (beyond heuristic) and surface creative/topic ROAS once costs ingested.
- Add alerts for attribution quality drops and SMS opt-out spikes.
