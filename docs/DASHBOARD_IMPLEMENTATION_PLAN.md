# World-Class Analytics Dashboard Implementation Plan

## Status Legend
✅ = Complete | 🔲 = Pending | 🔄 = In Progress

---

## Phase 1: Advanced Charting Infrastructure 
**Priority: P1 | Effort: Medium**

### 1.1 Install Apache ECharts
✅ Add `echarts` and `echarts-for-react` packages

### 1.2 Create ECharts Components (`src/components/charts/echarts/`)
✅ `EChartsBase.tsx` - Base wrapper with theme, responsive sizing, loading states
✅ `EChartsLineChart.tsx` - Time series with zoom/brush, toggleable series
🔲 `EChartsBarChart.tsx` - Horizontal bars for rankings/comparisons
🔲 `EChartsCalendarHeatmap.tsx` - Day-of-week/hour analysis
🔲 `EChartsPieChart.tsx` - Composition with drill-down
✅ `index.ts` - Exports

---

## Phase 2: KPI Cards with Sparklines 
**Priority: P0 | Effort: Low** ✅ COMPLETE

### 2.1 Create V3KPICardWithSparkline Component
✅ Create `src/components/v3/V3KPICardWithSparkline.tsx`
✅ Use Recharts tiny line for sparkline
✅ Add smooth animation on data load

### 2.2 Update Dashboard Metrics Query
✅ Extend `useClientDashboardMetricsQuery` to return `sparklineData`:
  - Net Revenue last N days
  - ROI last N days
  - Refund Rate last N days
  - Recurring Health last N days
  - Unique Donors last N days
  - Attribution Quality last N days

### 2.3 Integrate into ClientDashboardMetrics
✅ Replace hero `V3KPICard` with `V3KPICardWithSparkline`
✅ Sparkline data flows to each KPI card

---

## Phase 3: Cross-Highlighting & Brushing
**Priority: P0 | Effort: Medium**

### 3.1 Create Chart Interaction Store
✅ Create `src/stores/chartInteractionStore.ts`

### 3.2 Implement Cross-Highlighting
🔲 Update charts to dispatch hover events to store
🔲 Sync hover states across all charts for same date
🔲 Highlight corresponding table rows on chart hover
🔲 Highlight chart points on table row hover

### 3.3 Implement Brushing
🔲 Add brush component to ECharts time series
🔲 On brush end, update `selectedTimeRange` in store
🔲 Optionally sync brush selection to dashboardStore.dateRange

---

## Phase 4: Enhanced Analytics Utilities
**Priority: P1 | Effort: Medium**

### 4.1 Extend `src/lib/analytics.ts`
🔲 `computeRollingAverage(data, window, field)`
🔲 `calculateTrendline(data)` - Linear regression
🔲 `detectAnomaliesWithContext(data, threshold)`
🔲 `forecastNextPeriod(data, days, confidence)`
🔲 `calculateCumulativeSum(data, field)`
🔲 `calculatePercentChange(data, field)`

### 4.2 Create Analytics Hooks
🔲 `useAnomalyDetection(data, options)`
🔲 `useTrendAnalysis(data)`

---

## Phase 5: Calendar Heatmaps & Time Analysis
**Priority: P2 | Effort: Medium**

### 5.1 Create CalendarHeatmap Component
🔲 Create `src/components/charts/CalendarHeatmap.tsx`
🔲 Day-of-week × Hour grid
🔲 Color intensity = metric value
🔲 Click to filter by day/hour

### 5.2 Add Day/Hour Analysis Section
🔲 Best performing hours heatmap
🔲 Day-of-week patterns
🔲 Campaign send time optimization insights

---

## Phase 6: Advanced Period Comparison
**Priority: P2 | Effort: Medium**

### 6.1 Enhance V3DateRangePicker
🔲 Add comparison period selector
🔲 Previous period (same length)
🔲 Same period last month/year
🔲 Custom comparison range

### 6.2 Comparison Visualization Modes
🔲 Toggle between overlay and side-by-side
🔲 Dual-axis charts
🔲 Percentage change waterfall chart

---

## Phase 7: Progressive Disclosure & Drill-Down
**Priority: P3 | Effort: High**

### 7.1 Dashboard Hierarchy
🔲 Level 1: Executive Summary (KPIs with sparklines)
🔲 Level 2: Channel Overview (detailed charts + tables)
🔲 Level 3: Detailed Metrics (full tables, exports)

### 7.2 Implementation
🔲 KPI cards expand to show detailed breakdown
🔲 "View Details" opens modal/drawer
🔲 Table row click shows detail view
🔲 Breadcrumb navigation

---

## Phase 8: Performance & Polish
**Priority: P3 | Effort: Medium**

### 8.1 Performance Optimizations
🔲 Virtualized tables (react-window)
🔲 Chart data downsampling for 1000+ points
🔲 Memoize all chart configurations
🔲 Lazy load advanced analytics sections

### 8.2 Accessibility & UX
🔲 Full keyboard navigation for charts
🔲 Screen reader descriptions
🔲 Reduced motion mode support
🔲 Print-friendly styles

---

## Phase 9: Real-Time Enhancements
**Priority: P3 | Effort: Medium**

### 9.1 Live Updates
🔲 Pulse animation on new donations (partial)
🔲 Live counter with increment animation
🔲 Toast notifications for significant events

### 9.2 Activity Feed
🔲 Recent donations ticker
🔲 Campaign milestone alerts
🔲 Anomaly notifications

---

## Files Created/Modified

### Phase 2 (Complete):
- ✅ `src/components/v3/V3KPICardWithSparkline.tsx` (new)
- ✅ `src/components/v3/index.ts` (updated)
- ✅ `src/queries/useClientDashboardMetricsQuery.ts` (updated)
- ✅ `src/components/client/ClientDashboardMetrics.tsx` (updated)

### Phase 1 (In Progress):
- ✅ `src/components/charts/echarts/EChartsBase.tsx` (new)
- ✅ `src/components/charts/echarts/EChartsLineChart.tsx` (new)
- ✅ `src/components/charts/echarts/index.ts` (new)

### Phase 3 (In Progress):
- ✅ `src/stores/chartInteractionStore.ts` (new)
