# Client Dashboard Architecture

> **Last Updated:** December 2024
> **Status:** Production-ready
> **Stack:** React 18, TypeScript 5.8, TanStack Query, Zustand, Tailwind CSS

---

## Overview

The Mojo Digital Wins client dashboard is a world-class political fundraising analytics platform built for accessibility, performance, and maintainability. It provides real-time insights across donation channels (Meta Ads, SMS, ActBlue) with cross-highlighting, drill-down analytics, and AI-powered recommendations.

### High-Level Goals

| Goal | Implementation |
|------|---------------|
| **Accessibility** | WCAG 2.1 AA compliance, skip navigation, ARIA roles, reduced motion support |
| **Modern Data Stack** | TanStack Query for caching, Zustand for global state, real-time Supabase subscriptions |
| **Consistent UX** | Token-based design system, shared card components, unified loading/error states |
| **Developer Experience** | Type-safe queries, ESLint guardrails, comprehensive test coverage |

---

## Core Layout

### ClientShell

Every client-facing page wraps its content with `ClientShell` ([`src/components/client/ClientShell.tsx`](../src/components/client/ClientShell.tsx)), which provides:

| Feature | Description |
|---------|-------------|
| **Sidebar Navigation** | Collapsible `AppSidebar` with organization branding and navigation groups |
| **Skip Navigation** | `SkipNavigation` component for keyboard users to jump to main content |
| **Header** | Organization logo, page title, date range picker, theme toggle, logout |
| **Admin Access** | "Back to Admin" button visible when user has admin role or is impersonating |
| **Impersonation Banner** | Visible indicator when admin is viewing a client organization |

#### Usage Example

```tsx
import { ClientShell } from "@/components/client/ClientShell";

export default function DashboardOverview() {
  return (
    <ClientShell pageTitle="Dashboard Overview" showDateControls>
      <HeroKpiGrid />
      <ChannelMetrics />
    </ClientShell>
  );
}
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | required | Page content |
| `pageTitle` | `string` | undefined | Optional breadcrumb/header text |
| `showDateControls` | `boolean` | `true` | Show/hide date range picker |
| `contentClassName` | `string` | undefined | Additional class for main content wrapper |

### Authentication Flow

`ClientShell` handles authentication internally:

1. Subscribes to `supabase.auth.onAuthStateChange`
2. Redirects unauthenticated users to `/client-login` (unless impersonating)
3. Loads user organizations via `client_organizations` table
4. Admins see all organizations; regular users see only their assigned orgs

---

## ChartPanel & Hero KPIs

### ChartPanel

`ChartPanel` ([`src/components/client/ChartPanel.tsx`](../src/components/client/ChartPanel.tsx)) is the standardized container for all dashboard charts. It handles:

| State | Behavior |
|-------|----------|
| **Loading** | Shows skeleton placeholder, hides children |
| **Error** | Displays error message with optional retry button |
| **Empty** | Shows customizable empty state message |
| **Ready** | Renders children with proper ARIA roles |

#### Usage Example

```tsx
import { ChartPanel } from "@/components/client/ChartPanel";

<ChartPanel
  title="Donation Trends"
  description="Daily donations over the selected period"
  isLoading={query.isLoading}
  error={query.error?.message}
  isEmpty={!data?.length}
  emptyMessage="No donations in this period"
  onRetry={query.refetch}
>
  <DonationChart data={data} />
</ChartPanel>
```

### HeroKpiCard

`HeroKpiCard` ([`src/components/client/HeroKpiCard.tsx`](../src/components/client/HeroKpiCard.tsx)) displays key metrics with:

- **Accent colors**: `blue`, `green`, `purple`, `amber`, `red`, `default`
- **Sparkline**: Mini trend chart using Recharts
- **Cross-highlighting**: Hover/click syncs with charts via `dashboardStore`
- **Accessibility**: `role="button"`, `aria-pressed`, `aria-label` with value and trend

#### Cross-Highlighting System

```
┌─────────────┐     hover/click     ┌─────────────┐
│ HeroKpiCard │ ◄─────────────────► │ TimeChart   │
└─────────────┘                     └─────────────┘
       │                                   │
       │  setHighlightedKpiKey()           │  useHighlightedSeriesKeys()
       │                                   │
       └──────────► dashboardStore ◄───────┘
```

---

## Data Layer

### Query Hook Patterns

All data fetching uses TanStack Query hooks in [`src/queries/`](../src/queries/). Each hook follows a consistent pattern:

```
src/queries/
├── index.ts                    # Re-exports all hooks and types
├── queryKeys.ts                # Key factory functions
├── useClientAlertsQuery.ts     # Example: Alerts feature
├── useDonorJourneyQuery.ts     # Example: Donor journey feature
└── ...
```

#### Naming Convention

| Pattern | Example | Purpose |
|---------|---------|---------|
| `use[Feature]Query` | `useClientAlertsQuery` | Main data fetch |
| `use[Action][Feature]` | `useMarkAlertRead` | Mutation hook |
| `[feature]Keys` | `clientAlertsKeys` | Query key factory |

#### Query Key Structure

Query keys follow the factory pattern from TanStack Query docs:

```typescript
// src/queries/queryKeys.ts
export const donationKeys = {
  all: ['donations'] as const,
  list: (orgId: string, dateRange: DateRange) =>
    [...donationKeys.all, 'list', orgId, dateRange] as const,
  metrics: (orgId: string, dateRange: DateRange) =>
    [...donationKeys.all, 'metrics', orgId, dateRange] as const,
  detail: (orgId: string, transactionId: string) =>
    [...donationKeys.all, 'detail', orgId, transactionId] as const,
};
```

#### Standard Hook Structure

```typescript
// src/queries/useClientAlertsQuery.ts

// 1. Types
export interface ClientAlert { /* ... */ }
export interface ClientAlertsData { alerts: ClientAlert[]; stats: AlertStats; }

// 2. Query keys
export const clientAlertsKeys = {
  all: ["clientAlerts"] as const,
  list: (orgId: string) => [...clientAlertsKeys.all, "list", orgId] as const,
};

// 3. Fetch function
async function fetchClientAlerts(orgId: string): Promise<ClientAlertsData> {
  const { data, error } = await supabase
    .from("client_entity_alerts")
    .select("*")
    .eq("organization_id", orgId);
  if (error) throw error;
  return { alerts: data, stats: calculateStats(data) };
}

// 4. Query hook
export function useClientAlertsQuery(orgId: string | undefined) {
  return useQuery({
    queryKey: clientAlertsKeys.list(orgId || ""),
    queryFn: () => fetchClientAlerts(orgId!),
    enabled: !!orgId,
    staleTime: 30_000,  // 30 seconds
    gcTime: 5 * 60_000, // 5 minutes
  });
}

// 5. Mutation hooks
export function useMarkAlertRead(orgId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (alertId: string) => { /* ... */ },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientAlertsKeys.list(orgId || "") });
    },
  });
}
```

### Dashboard Store

`dashboardStore` ([`src/stores/dashboardStore.ts`](../src/stores/dashboardStore.ts)) manages global dashboard state:

| State | Purpose |
|-------|---------|
| `dateRange` | Selected date range (persisted) |
| `selectedChannel` | Filter: `'all' | 'meta' | 'sms' | 'donations'` |
| `selectedKpiKey` | Clicked KPI for drill-down |
| `highlightedKpiKey` | Hovered KPI for cross-highlighting |
| `highlightedDate` | Hovered date on chart |

#### Selector Hooks

```typescript
// Optimized selectors to prevent unnecessary re-renders
export const useDateRange = () => useDashboardStore((s) => s.dateRange);
export const useSelectedKpiKey = () => useDashboardStore((s) => s.selectedKpiKey);
export const useHighlightedSeriesKeys = (): SeriesKey[] => { /* ... */ };
```

### useIsAdmin Hook

`useIsAdmin` ([`src/hooks/useIsAdmin.ts`](../src/hooks/useIsAdmin.ts)) checks admin permissions:

```typescript
const { isAdmin, isLoading } = useIsAdmin();
// Uses supabase.rpc('has_role', { _user_id, _role: 'admin' })
```

---

## Design Tokens

The design system uses CSS custom properties defined in:

- **CSS Variables**: [`src/styles/portal-theme.css`](../src/styles/portal-theme.css)
- **TypeScript Tokens**: [`src/lib/design-tokens.ts`](../src/lib/design-tokens.ts)

### Using Tokens in Components

```typescript
import { cssVar, colors, spacing } from "@/lib/design-tokens";

// In Tailwind classes
<div className="bg-[hsl(var(--portal-bg-primary))]" />

// In inline styles
<div style={{ color: cssVar(colors.text.primary) }} />

// With alpha
<div style={{ background: cssVar(colors.accent.blue, 0.1) }} />
```

See [`docs/design-tokens.md`](./design-tokens.md) for the complete token reference.

---

## Extending the Dashboard

### Adding a New Page

1. **Create the query hook** in `src/queries/use[Feature]Query.ts`:
   ```typescript
   export const featureKeys = {
     all: ['feature'] as const,
     list: (orgId: string) => [...featureKeys.all, 'list', orgId] as const,
   };

   export function useFeatureQuery(orgId: string | undefined) {
     return useQuery({
       queryKey: featureKeys.list(orgId || ''),
       queryFn: () => fetchFeatureData(orgId!),
       enabled: !!orgId,
     });
   }
   ```

2. **Export from index** in `src/queries/index.ts`:
   ```typescript
   export {
     useFeatureQuery,
     featureKeys,
     type FeatureData,
   } from './useFeatureQuery';
   ```

3. **Create the page component**:
   ```typescript
   import { ClientShell } from "@/components/client/ClientShell";
   import { ChartPanel } from "@/components/client/ChartPanel";
   import { useFeatureQuery } from "@/queries";

   export default function FeaturePage() {
     const { data, isLoading, error } = useFeatureQuery(orgId);

     return (
       <ClientShell pageTitle="New Feature">
         <ChartPanel
           title="Feature Data"
           isLoading={isLoading}
           error={error?.message}
         >
           <FeatureContent data={data} />
         </ChartPanel>
       </ClientShell>
     );
   }
   ```

4. **Add route** in your router configuration

5. **Add sidebar link** in `AppSidebar` if needed

---

## How We Keep It Stable

### Testing

| Layer | Tool | Coverage |
|-------|------|----------|
| **Query Hooks** | Vitest + MSW | Unit tests for all query/mutation hooks |
| **Components** | Vitest + React Testing Library | Smoke tests for shared components |
| **Integration** | Coming soon | E2E with Playwright |

Run tests:
```bash
npm run test:run          # Single run
npm run test:coverage     # With coverage report
```

### Lint Guardrails

**ESLint rule for raw colors**: The codebase includes a custom ESLint rule that warns against raw `hsl()` values in component files:

```javascript
// eslint.config.js
'no-restricted-syntax': [
  'warn',
  {
    selector: 'Literal[value=/^hsl\\(/]',
    message: 'Use design tokens (portal-* CSS vars) instead of raw hsl() values',
  },
],
```

This ensures all colors use the tokenized system for consistency.

### Code Quality

```bash
npm run lint              # Run ESLint
npm run lint:fix          # Auto-fix issues
npm run build             # Type-check + build
```

---

## Related Documentation

- [Design Tokens Reference](./design-tokens.md) - Complete token catalog
- [World-Class Assessment](./WORLD_CLASS_ASSESSMENT.md) - Feature audit and scores
- [Dashboard Rebuild Plan](./dashboard-rebuild-plan.md) - Implementation roadmap
