# V3 Dashboard Design System: Complete page modernization

This PR introduces the **Dashboard V3 Design System** and applies it across the main client dashboard experience.

### Core V3 Components (new in `src/components/v3`)

- **`V3Card`** – Standardized card container with accent variants (`blue`, `green`, `purple`, `amber`, `red`).
- **`V3KPICard`** – KPI card with icon, value, trend indicator, and optional sparkline.
- **`V3TrendIndicator`** – Shared up/down/flat trend component (icon + color + accessible label).
- **`V3ChartWrapper`** – Accessible chart container (`role="figure"`, `aria-label`, title, icon).
- **`V3LoadingState`** – Skeleton patterns for KPI rows, charts, tables, and channel sections.
- **`V3ErrorState`** – Standardized error presentation with message + retry action.
- **`V3EmptyState`** – Empty-state component with icon, title, and next-step guidance.
- **`V3SectionHeader`** – Consistent section titles with optional subtitle + actions.
- **`index.ts`** – Barrel export for all V3 components.

These components are built on **React + TypeScript + Tailwind + shadcn/ui + Framer Motion** and use the existing portal theme tokens (e.g. `--portal-accent-blue`, `--portal-text-primary`).

---

## Pages & Components Updated

### Channel Metrics

- `ConsolidatedChannelMetrics.tsx`
- `DonationMetrics.tsx`
- `MetaAdsMetrics.tsx`
- `SMSMetrics.tsx`
- `SyncControls.tsx`

Key changes:

- Replace legacy `PortalCard` / Card usage with `V3Card` + accent variants.
- Introduce consistent KPI layouts via `V3KPICard`.
- Wrap charts in `V3ChartWrapper` with `role="figure"` and descriptive `aria-label`s.
- Add `V3LoadingState` for KPI rows, charts, and channel sections.
- Add more explicit error/empty states where appropriate.
- Modernize `SyncControls` with:
  - `V3Card` wrapper
  - Framer Motion microinteractions for sync buttons (hover/tap, spinners)
  - Status badges for per-platform sync health
  - Integration with `DataFreshnessIndicator`.

### Dashboard Pages

- `ClientDashboard.tsx`
- `ClientOpportunities.tsx`
- `ClientActions.tsx`
- `ClientWatchlist.tsx`
- `Analytics.tsx`
- `MagicMomentCard.tsx`

Key changes:

- Apply V3 design system so all dashboard views share:
  - Unified card styling and spacing
  - Consistent section headers (`V3SectionHeader`)
  - Staggered entrance animations for lists/grids (via Framer Motion)
  - Improved visual hierarchy and alignment
- Preserve existing data fetching and business logic; changes are UI/UX only.

---

## Non-Goals

- No business logic or query-layer changes.
- No changes to Supabase RPCs, functions, or schema.
- No routing/URL structure changes.

---

## How to Test

1. **Client Dashboard**
   - Navigate to the main client dashboard.
   - Verify:
     - Hero KPIs render correctly and update with date range.
     - Fundraising performance and channel charts render inside V3 cards.
     - Channel breakdown + SyncControls visually match the V3 system.

2. **Channel Metrics**
   - Open the channel details section and per-channel pages (Meta, SMS, Donations).
   - Confirm:
     - KPI rows use consistent V3 KPI cards.
     - Charts are wrapped in `V3ChartWrapper` and have sensible titles and aria labels.
     - Loading states show skeletons instead of layout jumps.
     - Error/empty states appear when you simulate failures or no data.

3. **Sync Controls**
   - On the main dashboard, use the Data Sync card:
     - Trigger each sync action (Meta, SMS, ActBlue, Backfill, ROI, Sync All) in a test org.
     - Verify button states: spinner while syncing, badge after success/failure.
     - Confirm `DataFreshnessIndicator` updates after sync.

4. **Secondary Pages**
   - Visit:
     - Client Opportunities
     - Client Actions
     - Client Watchlist
     - Analytics
   - Check:
     - V3Card + V3SectionHeader usage
     - Framer Motion list/grid animations feel smooth (and not distracting)
     - Layout holds up on smaller screen widths.

5. **Accessibility Smoke Test**
   - Keyboard:
     - Tab through main dashboard and verify focus is visible on cards, buttons, and interactive elements.
   - Screen reader (optional quick pass):
     - Confirm charts are announced with human-readable descriptions.
     - KPI / status sections read as understandable regions/status where applicable.

---

## Review Checklist

**Design & UX**

- [ ] Cards, spacing, and typography feel consistent across all upgraded pages.
- [ ] No legacy `PortalCard`/ad-hoc Card usage where V3Card should be used.
- [ ] Motion is smooth and subtle (no jank, no over-animation).

**Accessibility**

- [ ] All charts are wrapped with `role="figure"` and meaningful `aria-label`s.
- [ ] Interactive elements are keyboard-focusable with visible focus rings.
- [ ] Trend indicators don't rely on color alone (icon/text give direction).

**Code Quality**

- [ ] New V3 components are cohesive and not over-specialized.
- [ ] No obvious duplication between channel metrics components.
- [ ] Framer Motion usage is guarded from causing unnecessary re-renders.

**Behavior**

- [ ] Data remains correct before/after this PR (no regressions on metrics).
- [ ] Sync operations behave as before (just with improved UI).
- [ ] No console errors/warnings in normal usage.

---

## Notes

- This PR intentionally **does not** modify the underlying data layer beyond UI wiring.
- Future work could include:
  - Centralized global date-range control.
  - Shared "freshness" indicator pattern across all analytic views.
  - Mobile-specific layout refinements and reduced-motion support.

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
