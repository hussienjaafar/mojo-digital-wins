# V3 Dashboard Design System

This document describes the V3 design system used for the Mojo Digital Wins client dashboard.

## Overview

The V3 design system provides a cohesive, modern, and accessible UI for the dashboard. It emphasizes:

- **Consistency**: Unified visual language across all components
- **Accessibility**: ARIA labels, keyboard navigation, focus states
- **Performance**: Optimized rendering with React Query and memoization
- **Motion**: Thoughtful animations with Framer Motion
- **Responsiveness**: Mobile-first design that scales to desktop

## Core Components

### Layout Components

#### `V3PageContainer`
Top-level wrapper for all dashboard pages.

```tsx
import { V3PageContainer } from "@/components/v3";

<V3PageContainer
  icon={LayoutDashboard}
  title="Dashboard"
  description="Overview of your campaign performance"
  actions={<V3DateRangePicker />}
>
  {/* Page content */}
</V3PageContainer>
```

**Props:**
- `icon`: LucideIcon - Page icon
- `title`: string - Page title
- `description?`: string - Page subtitle
- `actions?`: ReactNode - Header actions (date picker, buttons)
- `breadcrumbs?`: ReactNode - Breadcrumb navigation
- `animate?`: boolean - Enable page animations (default: true)

#### `V3SectionHeader`
Section headers with consistent styling.

```tsx
<V3SectionHeader
  title="Key Performance Indicators"
  subtitle="Real-time metrics for your campaign"
  icon={TrendingUp}
  actions={<Button>Export</Button>}
/>
```

**Props:**
- `title`: string
- `subtitle?`: string
- `icon?`: LucideIcon
- `actions?`: ReactNode
- `size?`: "sm" | "md" | "lg"

### Card Components

#### `V3Card`
Base card component with accent colors.

```tsx
<V3Card accent="blue" interactive>
  <V3CardHeader>
    <V3CardTitle>Revenue</V3CardTitle>
    <V3CardDescription>Total donations this period</V3CardDescription>
  </V3CardHeader>
  <V3CardContent>
    {/* Content */}
  </V3CardContent>
</V3Card>
```

**Accents:** `blue`, `green`, `purple`, `amber`, `red`

#### `V3KPICard`
Specialized card for KPI display with trends.

```tsx
<V3KPICard
  icon={DollarSign}
  label="Total Raised"
  value="$125,430"
  subtitle="+12.5% from last period"
  trend={{ direction: "up", value: 12.5 }}
  accent="green"
/>
```

### State Components

#### `V3LoadingState`
Skeleton loaders for different content types.

```tsx
<V3LoadingState variant="kpi" />      // Single KPI skeleton
<V3LoadingState variant="kpi-grid" /> // Grid of KPI skeletons
<V3LoadingState variant="chart" />    // Chart skeleton
<V3LoadingState variant="table" />    // Table skeleton
<V3LoadingState variant="channel" />  // Channel card skeleton
```

#### `V3ErrorState`
Error display with retry functionality.

```tsx
<V3ErrorState
  title="Failed to load data"
  message="Please try again"
  onRetry={() => refetch()}
/>
```

#### `V3EmptyState`
Empty state with guidance.

```tsx
<V3EmptyState
  icon={Inbox}
  title="No donations yet"
  description="Donations will appear here once they're received"
  action={<Button>Import Data</Button>}
/>
```

### Chart Components

#### `V3ChartWrapper`
Accessible wrapper for all charts.

```tsx
<V3ChartWrapper
  title="Donation Trends"
  description="Daily donations over time"
  ariaLabel="Line chart showing donation trends"
>
  <ResponsiveContainer>
    <LineChart data={data}>
      {/* Chart content */}
    </LineChart>
  </ResponsiveContainer>
</V3ChartWrapper>
```

### Form Components

#### `V3DateRangePicker`
Global date range picker connected to Zustand store.

```tsx
<V3DateRangePicker showPresets />
```

## State Management

### Zustand Store

The dashboard uses Zustand for global UI state:

```tsx
import { useDashboardStore, useDateRange } from "@/stores/dashboardStore";

// In components:
const dateRange = useDateRange();
const { setDateRange, triggerRefresh } = useDashboardStore();
```

**Store Shape:**
```ts
{
  dateRange: { startDate: string, endDate: string },
  selectedChannel: 'all' | 'meta' | 'sms' | 'donations',
  viewMode: 'overview' | 'detailed',
  comparisonEnabled: boolean,
  selectedKPI: string | null,
  refreshKey: number,
}
```

## Data Architecture

### Query Key Factories

All queries use factory functions for consistent keys:

```tsx
import { dashboardKeys, donationKeys, metaKeys } from "@/queries/queryKeys";

// Usage in hooks:
queryKey: dashboardKeys.kpis(orgId, dateRange)
queryKey: donationKeys.metrics(orgId, dateRange)
```

### TanStack Query Hooks

Domain-specific query hooks:

```tsx
import { 
  useDashboardKPIsQuery,
  useDonationMetricsQuery,
  useChannelSummariesQuery,
} from "@/queries";

// Usage:
const { data, isLoading, error, refetch } = useDashboardKPIsQuery(organizationId);
```

**Configuration:**
- `staleTime`: 2 minutes (data considered fresh)
- `gcTime`: 10 minutes (garbage collection)
- Automatic background refetch
- Parallel queries where possible

## CSS Variables

The design system uses CSS variables for theming:

```css
--portal-bg-base          /* Page background */
--portal-bg-elevated      /* Card backgrounds */
--portal-bg-hover         /* Hover states */
--portal-text-primary     /* Primary text */
--portal-text-secondary   /* Secondary text */
--portal-text-muted       /* Muted text */
--portal-border           /* Borders */
--portal-accent-blue      /* Blue accent */
--portal-accent-purple    /* Purple accent */
--portal-success          /* Success/green */
--portal-warning          /* Warning/amber */
--portal-error            /* Error/red */
```

## Animation Patterns

### Staggered Sections
```tsx
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};
```

### Expand/Collapse
```tsx
const contentVariants = {
  collapsed: { height: 0, opacity: 0 },
  expanded: { height: "auto", opacity: 1 },
};
```

### Micro-interactions
```tsx
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
>
```

## Accessibility Guidelines

1. **ARIA Labels**: All interactive elements have descriptive labels
2. **Keyboard Navigation**: Full keyboard support with visible focus states
3. **Color Contrast**: WCAG AA compliant contrast ratios
4. **Screen Readers**: Semantic HTML and role attributes
5. **Reduced Motion**: Respects `prefers-reduced-motion`

## File Structure

```
src/
├── components/v3/
│   ├── index.ts              # Exports all V3 components
│   ├── V3Card.tsx            # Card system
│   ├── V3KPICard.tsx         # KPI display
│   ├── V3PageContainer.tsx   # Page wrapper
│   ├── V3SectionHeader.tsx   # Section headers
│   ├── V3ChartWrapper.tsx    # Chart wrapper
│   ├── V3DateRangePicker.tsx # Date range picker
│   ├── V3LoadingState.tsx    # Loading skeletons
│   ├── V3ErrorState.tsx      # Error display
│   ├── V3EmptyState.tsx      # Empty states
│   └── V3TrendIndicator.tsx  # Trend arrows
├── stores/
│   ├── index.ts              # Store exports
│   └── dashboardStore.ts     # Zustand store
├── queries/
│   ├── index.ts              # Query exports
│   ├── queryKeys.ts          # Query key factories
│   ├── useDashboardKPIsQuery.ts
│   ├── useDonationMetricsQuery.ts
│   └── useChannelSummariesQuery.ts
└── styles/
    └── portal-theme.css      # CSS variables
```

## TODOs / P2 Enhancements

- [ ] Add Meta ads query hook with creative performance
- [ ] Add SMS metrics query hook
- [ ] Implement cross-highlighting between charts and tables
- [ ] Add brush/zoom for time series charts
- [ ] Implement calendar heatmap for time-of-day analysis
- [ ] Add comparison mode toggle UI
- [ ] Implement query prefetching on hover
