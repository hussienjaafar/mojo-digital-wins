# World-Class Dashboard Implementation Plan (Ultrathink Analysis)

## Executive Summary

This plan restores and enhances the dashboard to the target state from the ChatGPT conversation, incorporating modern libraries and best practices.

**Key Finding:** Much of the infrastructure already exists but is NOT WIRED UP:
- `chartInteractionStore` exists but cross-highlighting not connected
- `V3KPIDrilldownDrawer` exists (161 lines) but NEVER USED
- `analytics.ts` has anomaly detection but no `useInsights` hook
- Tremor NOT installed despite docs claiming otherwise

---

## Current State vs Target State

| Feature | Current State | Target State |
|---------|--------------|--------------|
| KPI Cards | V3KPICardWithSparkline (scrolls only) | ExpandableKpiCard (click to expand drilldown) |
| Cross-highlighting | Store exists, NOT wired | KPI hover dims unrelated chart series |
| Smart Insights | analytics.ts functions exist | InsightsCard with anomaly alerts |
| Drilldown Drawer | V3KPIDrilldownDrawer (orphaned) | Wired to KPI cards |
| Chart Library | ECharts + Recharts | ECharts + Tremor (dashboard charts) |

---

## Tech Stack (Final)

| Category | Library | Purpose |
|----------|---------|---------|
| State | Zustand 5.0.9 | Global UI state with persist |
| Data Fetching | TanStack Query 5.83.0 | Server state, caching, background refresh |
| Charts (Dashboard) | **Tremor** (to install) | Hero charts, KPI sparklines, donuts |
| Charts (Advanced) | ECharts 6.0.0 | Heatmaps, brush/zoom, complex interactions |
| Animation | Framer Motion 12.23.26 | Page transitions, micro-interactions |
| UI Primitives | shadcn/ui (Radix) | Dialogs, sheets, popovers |

---

## Phase 0: Install Tremor (15 min)

```bash
npm install @tremor/react --legacy-peer-deps
```

**Create Tremor Wrappers:**
- `src/components/charts/tremor/TremorAreaChart.tsx`
- `src/components/charts/tremor/TremorBarChart.tsx`
- `src/components/charts/tremor/TremorDonutChart.tsx`
- `src/components/charts/tremor/index.ts`

---

## Phase 1: Enhanced Dashboard Store (1 hour)

**Extend `src/stores/dashboardStore.ts`:**

```typescript
// New state
highlightedKpiKey: KpiKey | null;
selectedKpiKey: KpiKey | null;

// New actions
setHighlightedKpiKey: (key: KpiKey | null) => void;
setSelectedKpiKey: (key: KpiKey | null) => void;
```

**Add KPI-to-Series Mapping:**

```typescript
export type KpiKey =
  | 'netRevenue'
  | 'netRoi'
  | 'refundRate'
  | 'recurringHealth'
  | 'attributionQuality'
  | 'uniqueDonors';

export type SeriesKey =
  | 'donations'
  | 'netDonations'
  | 'refunds'
  | 'metaSpend'
  | 'smsSpend';

export const KPI_TO_SERIES_MAP: Record<KpiKey, SeriesKey[]> = {
  netRevenue: ['netDonations'],
  netRoi: ['metaSpend', 'smsSpend'],
  refundRate: ['refunds'],
  recurringHealth: ['donations'],
  attributionQuality: [],
  uniqueDonors: ['donations'],
};
```

---

## Phase 2: ExpandableKpiCard Component (2-3 hours)

**Create `src/components/dashboard/ExpandableKpiCard.tsx`:**

```typescript
interface ExpandableKpiCardProps {
  kpiKey: KpiKey;
  label: string;
  value: string;
  change: number;
  subtitle?: string;
  tooltip?: string;
  icon: LucideIcon;
  sparklineData: number[];
  invertTrend?: boolean;
  accent?: V3KPIAccent;

  // Cross-highlighting
  isSelected?: boolean;
  isHighlighted?: boolean;
  onSelect?: (key: KpiKey | null) => void;
  onHoverStart?: (key: KpiKey) => void;
  onHoverEnd?: () => void;
}
```

**Features:**
- Click → Opens V3KPIDrilldownDrawer with breakdown data
- Hover → Sets highlightedKpiKey in store
- Visual states: isHighlighted (glow ring), isSelected (solid ring)
- Keyboard accessible: Enter/Space to select, Escape to close

**Create `src/queries/useKpiDrilldownQuery.ts`:**

Returns breakdown data for drilldown drawer:
- Time series for trend chart
- Breakdown by channel/source
- Comparison to previous period

---

## Phase 3: Cross-Highlighting Wiring (2 hours)

**Wire KPI → Chart:**
1. KPI card `onMouseEnter` → `chartInteractionStore.setHighlightedSeries(KPI_TO_SERIES_MAP[kpiKey])`
2. KPI card `onMouseLeave` → `chartInteractionStore.setHighlightedSeries(null)`

**Wire Chart → KPI:**
1. EChartsLineChart `onSeriesHover` → Find KPI with matching series
2. Set `dashboardStore.setHighlightedKpiKey(matchingKpi)`

**Visual Feedback:**
```typescript
// In EChartsLineChart - dim non-highlighted series
series.map(s => ({
  ...s,
  itemStyle: {
    opacity: highlightedSeries && !highlightedSeries.includes(s.dataKey) ? 0.25 : 1,
  }
}))
```

---

## Phase 4: Smart Insights System (3 hours)

**Create `src/queries/useInsightsQuery.ts`:**

```typescript
interface Insight {
  id: string;
  type: 'positive_spike' | 'negative_spike' | 'warning' | 'milestone' | 'trend';
  kpiKey?: KpiKey;
  date: string | null;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical' | 'success';
}

const CONFIG = {
  Z_SCORE_THRESHOLD: 2.5,
  PERCENT_CHANGE_THRESHOLD: 75,
  REFUND_WARNING_THRESHOLD: 5,
  ROI_WARNING_THRESHOLD: 1.0,
  MAX_INSIGHTS: 5,
};
```

**Detection Rules:**
1. Z-score > 2.5 → Anomaly spike
2. Refund rate > 5% → Warning
3. ROI < 1.0x → Warning
4. Day-over-day > 75% change → Trend alert
5. Revenue milestones → Celebration

**Create `src/components/dashboard/InsightsCard.tsx`:**
- Color-coded by severity
- Click insight → cross-highlight KPI + date
- Empty state when no insights

---

## Phase 5: DataPointDetailSheet (1-2 hours)

**Create `src/components/dashboard/DataPointDetailSheet.tsx`:**

```typescript
interface DataPointDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  data: {
    donations: number;
    netDonations: number;
    refunds: number;
    metaSpend: number;
    smsSpend: number;
    metaConversions: number;
    smsConversions: number;
  };
}
```

**Trigger:** Chart data point click opens sheet with:
- Date's metrics breakdown
- Channel contribution
- Comparison to period average

---

## Phase 6: Accessibility Polish (2 hours)

**Checklist:**
- [ ] All cards keyboard navigable (Enter/Space/Escape)
- [ ] Focus rings visible on all interactive elements
- [ ] ARIA labels on charts and cards
- [ ] Screen reader descriptions
- [ ] Reduced motion respected (useReducedMotion hook)
- [ ] Color contrast WCAG AA

---

## Phase 7: Final Integration (1 hour)

**Update ClientDashboardMetrics.tsx:**
1. Replace V3KPICardWithSparkline → ExpandableKpiCard
2. Add InsightsCard to layout
3. Wire chart click → DataPointDetailSheet
4. Connect all cross-highlighting

**Layout:**
```
+----------------------------------+
|  KPI  |  KPI  |  KPI  |  KPI  |  KPI  |  KPI  |  (expandable)
+----------------------------------+
|                                  |
|     EChartsLineChart             |  Channel
|     (with brush, comparison)     |  Performance
|                                  |
+----------------------------------+
| Smart Insights    | Campaign Health           |
+----------------------------------+
```

---

## Files to Create/Modify

### New Files
| File | Description |
|------|-------------|
| `src/components/charts/tremor/TremorAreaChart.tsx` | Tremor wrapper |
| `src/components/charts/tremor/TremorBarChart.tsx` | Tremor wrapper |
| `src/components/charts/tremor/TremorDonutChart.tsx` | Tremor wrapper |
| `src/components/dashboard/ExpandableKpiCard.tsx` | Main KPI component |
| `src/components/dashboard/InsightsCard.tsx` | Smart insights display |
| `src/components/dashboard/DataPointDetailSheet.tsx` | Detail slide-in |
| `src/queries/useKpiDrilldownQuery.ts` | Drilldown data hook |
| `src/queries/useInsightsQuery.ts` | Anomaly detection hook |

### Modified Files
| File | Changes |
|------|---------|
| `src/stores/dashboardStore.ts` | Add highlightedKpiKey, selectedKpiKey |
| `src/stores/index.ts` | Export new selectors |
| `src/components/charts/echarts/EChartsLineChart.tsx` | Accept highlightedSeries prop |
| `src/components/client/ClientDashboardMetrics.tsx` | Wire everything together |

---

## Success Criteria

1. **Performance**: Initial load < 2s, interactions < 100ms
2. **Accessibility**: WCAG AA, full keyboard navigation
3. **Cross-highlighting**: Seamless KPI ↔ chart interaction
4. **Insights**: Meaningful, non-spammy automated observations
5. **Build**: `npm run build` passes with no errors

---

## Estimated Effort

| Phase | Hours |
|-------|-------|
| Phase 0: Tremor | 0.25 |
| Phase 1: Store | 1 |
| Phase 2: ExpandableKpiCard | 2-3 |
| Phase 3: Cross-highlighting | 2 |
| Phase 4: Insights | 3 |
| Phase 5: DetailSheet | 1-2 |
| Phase 6: Accessibility | 2 |
| Phase 7: Integration | 1 |
| **Total** | **12-14 hours** |

---

*Generated by Claude Ultrathink Analysis - 2025-12-10*
