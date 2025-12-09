# Client Dashboard Implementation Plan (UX/UI + Data Viz)

Tracking the sprint plan and status for improving readability, IA, and insights. Checkboxes reflect what’s shipped on `main`.

## Sprint Plan & Status
- [x] **Sprint 1: Chart Readability & Interaction Baseline**
  - [x] Legend with series toggle for line/bar charts; distinct colorblind-safe palette and dash patterns.
  - [x] Currency/date formatting and improved chart padding.
  - [x] Compare-to-previous-period overlay on Fundraising chart.
- [ ] **Sprint 2: KPI Hierarchy & Information Architecture**
  - [ ] Revamp hero row to surface net revenue, refund/fee rate, attribution quality %, ROAS, recurring health.
  - [ ] Add deterministic attribution badge near channel charts; date/org context pill and quick ranges.
  - [ ] Consolidate channel info (Channel Performance + Conversion Sources) into one coherent section.
- [ ] **Sprint 3: Data Visualization Enhancements**
  - [ ] Refunds as negative/area encoding; net vs gross toggle; share % in Conversion Sources with date label.
  - [ ] Creative/topic performance with CPA/ROAS and deterministic %.
  - [ ] Benchmarks/baselines (targets or prior-period ghost) in relevant charts/tooltips.
- [ ] **Sprint 4: Donor & Retention Integration**
  - [ ] Retention/churn mini-cohort card on main dashboard; links into Donor Intelligence.
  - [ ] KPI cards clickable to open filtered trends; new vs returning split in channel/creative views.
  - [ ] LTV/recurring health quick stat with link to full LTV view.
- [ ] **Sprint 5: Accessibility, States, Hardening**
  - [ ] Contrast/touch target/font-size tuning for WCAG AA; responsive stress test.
  - [ ] Robust empty/error/loading states with next steps.
  - [ ] Screen reader labels, keyboard focus states for filters/controls.

## Notes
- Cross-sprint: shared chart components for legend toggles, compare mode, net/gross toggle, attribution badges; design tokens update for palette and spacing.
- Keep package.json/lock unchanged unless explicitly needed; untracked docs/scripts remain untouched unless requested.
