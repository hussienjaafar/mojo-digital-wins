# Client Dashboard Implementation Plan (UX/UI + Data Viz)

Tracking the sprint plan and status for improving readability, IA, and insights. Checkboxes reflect what’s shipped on `main`.

## Sprint Plan & Status
- [x] **Sprint 1: Chart Readability & Interaction Baseline**
  - [x] Legend with series toggle for line/bar charts; distinct colorblind-safe palette and dash patterns.
  - [x] Currency/date formatting and improved chart padding.
  - [x] Compare-to-previous-period overlay on Fundraising chart.
- [x] **Sprint 2: KPI Hierarchy & Information Architecture**
  - [x] Revamp hero row to surface net revenue, refund rate, attribution quality %, ROI, recurring health.
  - [x] Add deterministic attribution badge near channel charts; date context pill.
  - [x] Consolidate channel info (Channel Performance + Conversion Sources) into one coherent section.
- [ ] **Sprint 3: Data Visualization Enhancements**
  - [ ] Refunds as negative/area encoding; net vs gross toggle; share % in Conversion Sources with date label.
  - [ ] Creative/topic performance with CPA/ROAS and deterministic %.
  - [ ] Benchmarks/baselines (targets or prior-period ghost) in relevant charts/tooltips.
- [x] **Sprint 4: Donor & Retention Integration**
  - [x] Retention/churn mini-cohort card on main dashboard; links into Donor Intelligence.
  - [x] KPI cards clickable to open filtered trends; new vs returning split surfaced in KPIs and topics.
  - [x] LTV/recurring health quick stat with link to full LTV view.
- [x] **Sprint 5: Accessibility, States, Hardening**
  - [x] Font-size tuning for chart ticks; keyboard/ARIA for clickable KPI cards.
  - [x] Empty-state handling on charts; aria-label support on charts.
  - [ ] Contrast/touch target tuning for WCAG AA; responsive stress test.
  - [ ] Screen reader labels and focus for filters/controls (filters still pending).

## Notes
- Cross-sprint: shared chart components for legend toggles, compare mode, net/gross toggle, attribution badges; design tokens update for palette and spacing.
- Keep package.json/lock unchanged unless explicitly needed; untracked docs/scripts remain untouched unless requested.
