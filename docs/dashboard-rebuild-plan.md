# Client Dashboard Rebuild Plan

## Overview

This plan rebuilds the world-class client dashboard based on the original ChatGPT/Claude implementation that was lost. The goal is a highly interactive, accessible, state-of-the-art analytics dashboard.

## Tech Stack

- **React + TypeScript** - Strict types for complex data flows
- **Tailwind CSS + shadcn/ui** - Modern, accessible UI primitives
- **Framer Motion** - Subtle animations for hover, loading, drill-downs
- **Apache ECharts** - High-performance, interactive charts (already installed)
- **TanStack Query** - Async data with caching, background refresh
- **Zustand** - Lightweight global state for filters, selections, highlights
- **Tremor** - Dashboard chart wrappers (already installed)

---

## Phase 1: Foundation (dashboardStore + Query Hooks)

### 1.1 Enhanced Zustand Store (`src/stores/dashboardStore.ts`)

Extend existing store with:

```typescript
interface DashboardState {
  // Existing
  organizationId: string | null;
  dateRange: DateRange;
  comparisonEnabled: boolean;

  // New: KPI interaction state
  selectedKpiKey: KpiKey | null;
  highlightedKpiKey: KpiKey | null;
  highlightedSeriesKey: SeriesKey | null;
  highlightedDate: string | null;

  // Chart state
  visibleSeries: Record<SeriesKey, boolean>;
  expandedSections: SectionId[];

  // Realtime
  isRealtimeConnected: boolean;
}

// KPI to series mapping for cross-highlighting
export const KPI_TO_SERIES_MAP: Record<KpiKey, SeriesKey | SeriesKey[]> = {
  netRevenue: 'netDonations',
  uniqueDonors: 'donations',
  netRoi: ['metaSpend', 'smsSpend'],
  recurringRate: 'donations',
  refundRate: 'refunds',
  recurringHealth: 'donations',
};
```

### 1.2 Query Hooks

- `useDonationsQuery` - with realtime subscription + reconnection logic
- `useKpiAggregates` - compute KPIs from donation data
- `usePreviousDonationsQuery` - for comparison period (memoized)

---

## Phase 2: ExpandableKpiCard Component

### Location: `src/components/dashboard/ExpandableKpiCard.tsx`

### Features:
- Click to reveal breakdown bars, detail metrics, trend chart
- Keyboard accessible (Enter/Space to expand, Escape to close)
- Sparkline with min/max axis context
- Trend indicator with invertTrend support
- Cross-highlighting support (isHighlighted prop)

### Props Interface:
```typescript
interface ExpandableKpiCardProps {
  kpiKey: KpiKey;
  label: string;
  value: string;
  change: number;
  subtitle?: string;
  tooltip?: string;
  icon: LucideIcon;
  sparklineData: { date: string; value: number }[];
  invertTrend?: boolean;
  breakdown?: BreakdownItem[];
  trendData?: TimeSeriesDataPoint[];
  trendDataKey?: string;
  detailMetrics?: DetailMetric[];
  isSelected?: boolean;
  isHighlighted?: boolean;
  onSelect?: (key: KpiKey | null) => void;
  onHoverStart?: (key: KpiKey) => void;
  onHoverEnd?: () => void;
}
```

### Helper Components:
- `SparklineAxisContext` - shows min/max values below sparkline
- `TrendIndicator` - up/down arrows with color coding

---

## Phase 3: EnhancedLineChart Component

### Location: `src/components/charts/EnhancedLineChart.tsx`

### Features:
- Comparison overlay (dashed lines for previous period)
- Brush selection for time range zoom
- WCAG AA colorblind-safe palette
- 400ms chart animations with custom tooltips
- Cross-highlighting support (dim non-highlighted series)

### Props Interface:
```typescript
interface EnhancedLineChartProps {
  data: DataPoint[];
  lines: LineConfig[];
  comparisonData?: DataPoint[];
  comparisonLines?: LineConfig[];
  height?: number;
  valueType?: 'currency' | 'number' | 'percent';
  showBrush?: boolean;
  highlightedKpiKey?: KpiKey | null;
  onDataPointClick?: (data: DataPoint, index: number) => void;
  onSeriesHover?: (seriesKey: SeriesKey | null) => void;
  onDateHover?: (date: string | null) => void;
}
```

### Colorblind-Safe Palette:
```typescript
const COLORBLIND_SAFE_PALETTE = {
  blue: '#0077BB',
  cyan: '#33BBEE',
  teal: '#009988',
  orange: '#EE7733',
  red: '#CC3311',
  magenta: '#EE3377',
  grey: '#BBBBBB',
  green: '#228833',
};
```

---

## Phase 4: Cross-Highlighting System

### Zustand Actions:
```typescript
setHighlightedKpiKey: (key: KpiKey | null) => void;
setHighlightedSeriesKey: (key: SeriesKey | null) => void;
setHighlightedDate: (date: string | null) => void;
clearAllHighlights: () => void;
```

### Behavior:
1. **KPI Card Hover** → Highlight related chart series (dim others to 25% opacity)
2. **Chart Series Hover** → Subtle glow on related KPI card
3. **Chart Date Hover** → Set highlightedDate for potential reference line
4. **Selected state** (clicked) takes precedence over highlighted state (hover)

---

## Phase 5: Smart Insights / Anomaly Detection

### Location: `src/queries/useInsights.ts`

### Detection Methods:
1. **Z-score anomalies** (threshold: 2.5 std deviations)
2. **Day-over-day spikes** (threshold: 75% change, min $100 baseline)
3. **Threshold breaches** (refund rate >5%, ROI <1.0x, churn >10%)
4. **Milestones** (revenue/donor count achievements)

### Configuration:
```typescript
const CONFIG = {
  Z_SCORE_THRESHOLD: 2.5,
  PERCENT_CHANGE_THRESHOLD: 75,
  MIN_SAMPLE_SIZE: 10,
  MIN_BASELINE_VALUE: 100,
  MAX_INSIGHTS: 5,
};
```

### Insight Types:
```typescript
type InsightType = 'positive_spike' | 'negative_spike' | 'warning' | 'milestone' | 'trend';

interface Insight {
  id: string;
  type: InsightType;
  date: string | null;
  primaryKpiKey?: KpiKey;
  title: string;
  description?: string;
}
```

### InsightsCard Component: `src/components/dashboard/InsightsCard.tsx`
- Color-coded rows by type
- Keyboard accessible
- Empty state when no insights
- Click triggers cross-highlighting

---

## Phase 6: DataPointDetailSheet

### Location: `src/components/dashboard/DataPointDetailSheet.tsx`

### Features:
- Slide-in panel for chart data point details
- Focus trapping when open
- Body scroll lock
- Keyboard accessible (Escape to close)
- Shows breakdown of selected date's data

---

## Phase 7: Accessibility & Reduced Motion

### useReducedMotion Hook: `src/hooks/useReducedMotion.ts`

```typescript
export function useReducedMotion(): boolean;
export function useMotionHoverTap(): { whileHover?: object; whileTap?: object };
export function useMotionVariants<T>(variants: T): T;
export function useStaggerVariants(): { container: Variants; item: Variants };
```

### Requirements:
- All Framer Motion components respect prefers-reduced-motion
- Focus rings on all interactive elements
- Screen reader labels on charts and cards
- ARIA attributes (role, aria-expanded, aria-label, etc.)

---

## Phase 8: Final Integration

### ClientDashboardMetricsV2 Component

Wire everything together:
1. Hero KPIs grid (4-6 expandable cards)
2. Main chart with comparison toggle
3. Smart Insights card
4. Channel Performance section
5. Campaign Health section

### Layout:
```
+----------------------------------+
|  KPI  |  KPI  |  KPI  |  KPI     |  (expandable)
+----------------------------------+
|                                  |
|     EnhancedLineChart            |
|     (with brush, comparison)     |
|                                  |
+----------------------------------+
| Smart Insights | Channel Perf    |
+----------------------------------+
| Campaign Health                  |
+----------------------------------+
```

---

## Files to Create

| File | Description |
|------|-------------|
| `src/stores/dashboardStore.ts` | Enhanced Zustand store (extend existing) |
| `src/queries/useKpiAggregates.ts` | KPI computation hook |
| `src/queries/useKpiDrilldown.ts` | Drilldown data for expanded cards |
| `src/queries/useInsights.ts` | Anomaly detection hook |
| `src/components/dashboard/ExpandableKpiCard.tsx` | Expandable KPI card |
| `src/components/dashboard/InsightsCard.tsx` | Smart insights display |
| `src/components/dashboard/DataPointDetailSheet.tsx` | Detail slide-in panel |
| `src/components/charts/EnhancedLineChart.tsx` | Enhanced chart with brush |
| `src/hooks/useReducedMotion.ts` | Motion preference hooks |
| `src/components/client/ClientDashboardMetricsV2.tsx` | Main dashboard container |

---

## Success Criteria

1. **Performance**: Initial load <2s, interactions <100ms
2. **Accessibility**: WCAG AA compliant, full keyboard navigation
3. **Insights**: Meaningful, non-spammy automated observations
4. **Cross-highlighting**: Seamless connection between KPIs and charts
5. **Polish**: Consistent animations, professional appearance
