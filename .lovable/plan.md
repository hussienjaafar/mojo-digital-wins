

# Unified Smart Refresh for All Organizations

## Current State Summary

Your system **already has** automatic syncing for all organizations:

| Data Source | Current Schedule | Status |
|-------------|-----------------|--------|
| Meta Ads | Every 30 min via `tiered-meta-sync` | Active |
| SMS/Switchboard | Every 30 min via `sync-switchboard-sms` | Active |
| ActBlue CSV | Every 6 hours via `sync-actblue-csv` | Inactive |

**Key Finding**: The backend syncs ARE running, but when they complete, **connected clients don't automatically refresh their dashboard data**. The `data_freshness` table updates (and the freshness indicators update via realtime), but the TanStack Query caches remain stale until users manually click refresh.

---

## The Gap

```text
Backend Sync Completes
        │
        ▼
data_freshness table updated
        │
        ▼
useDataFreshness sees realtime event
        │
        ▼
Freshness status bar updates ✓
        │
        ✗ Dashboard data caches NOT invalidated
        ✗ User sees stale numbers until manual refresh
```

---

## Solution: Automatic Cache Invalidation on Sync Completion

Create a hook that bridges the gap: when the backend sync completes and updates `data_freshness`, automatically trigger dashboard cache invalidation so all sections show fresh data.

### Architecture After Implementation

```text
Backend Sync Completes (every 30 min)
        │
        ▼
data_freshness table updated
        │
        ▼
useAutoRefreshOnSync (NEW)
        │
        ├── Detects source update via realtime
        ├── Invalidates all related query keys
        └── Shows toast: "Data updated"
        │
        ▼
All dashboard sections refresh automatically ✓
```

---

## Implementation Plan

### Step 1: Create `useAutoRefreshOnSync` Hook

A new hook that listens to `data_freshness` changes and triggers comprehensive cache invalidation when syncs complete for the current organization.

**File**: `src/hooks/useAutoRefreshOnSync.ts`

```typescript
/**
 * Automatically invalidates dashboard caches when backend syncs complete.
 * Bridges the gap between scheduled syncs and client-side data freshness.
 */
export function useAutoRefreshOnSync(organizationId: string | undefined) {
  const queryClient = useQueryClient();
  const lastSyncRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!organizationId) return;

    const channel = supabase
      .channel(`auto-refresh-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'data_freshness',
          filter: `organization_id=eq.${organizationId}`,
        },
        async (payload) => {
          const { source, last_synced_at, last_sync_status } = payload.new;
          
          // Only react to successful syncs
          if (last_sync_status !== 'success') return;
          
          // Prevent duplicate refreshes for same sync
          if (lastSyncRef.current[source] === last_synced_at) return;
          lastSyncRef.current[source] = last_synced_at;
          
          // Invalidate relevant caches based on source
          await invalidateCachesForSource(queryClient, source);
          
          toast.success(`${sourceLabels[source]} data updated`, { 
            duration: 3000 
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, queryClient]);
}
```

### Step 2: Source-Specific Cache Mapping

Map each data source to the query keys it affects:

```typescript
const SOURCE_QUERY_KEYS: Record<string, string[][]> = {
  meta: [
    ['meta'],
    ['meta-metrics'],
    ['single-day-meta'],
    ['creative-intelligence'],
    ['hourly-metrics'],
  ],
  actblue_webhook: [
    ['actblue'],
    ['donations'],
    ['recurring-health'],
    ['recurring-health-v2'],
    ['hourly-metrics'],
  ],
  actblue_csv: [
    ['actblue'],
    ['donations'],
    ['recurring-health'],
    ['recurring-health-v2'],
  ],
  switchboard: [
    ['sms'],
    ['channels'],
  ],
};

async function invalidateCachesForSource(
  queryClient: QueryClient, 
  source: string
) {
  const keys = SOURCE_QUERY_KEYS[source] || [];
  
  // Always invalidate dashboard summary
  await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  
  // Invalidate source-specific keys
  await Promise.all(
    keys.map(key => queryClient.invalidateQueries({ queryKey: key }))
  );
}
```

### Step 3: Integrate into Dashboard Layout

Add the hook to the main dashboard layout so it's active on all dashboard pages:

**File**: `src/components/client/ClientDashboardLayout.tsx` (or similar)

```typescript
export function ClientDashboardLayout({ children }) {
  const { organizationId } = useOrganization();
  
  // Auto-refresh when backend syncs complete
  useAutoRefreshOnSync(organizationId);
  
  return (
    <div className="dashboard-layout">
      {children}
    </div>
  );
}
```

### Step 4: Enable Unified Scheduled Job (Optional)

If you want Meta + SMS to sync as a single coordinated job (rather than two separate jobs), add a new entry to `scheduled_jobs`:

```sql
-- Create unified smart refresh job (runs every 30 minutes)
INSERT INTO public.scheduled_jobs (
  job_name,
  job_type,
  schedule,
  is_active,
  endpoint
) VALUES (
  'Smart Refresh All Orgs',
  'edge_function',
  '*/30 * * * *',
  true,
  'smart-refresh-all-orgs'
);

-- Deactivate individual jobs (optional - unified job handles them)
UPDATE public.scheduled_jobs 
SET is_active = false 
WHERE job_type IN ('sync_meta_ads', 'sync_switchboard_sms');
```

**Note**: The current setup where Meta and SMS run separately every 30 minutes is functionally equivalent. The main fix is the client-side auto-refresh hook.

---

## Files to Create/Modify

| Action | File | Purpose |
|--------|------|---------|
| **Create** | `src/hooks/useAutoRefreshOnSync.ts` | Auto-invalidate caches when backend syncs complete |
| **Modify** | `src/components/client/ClientDashboardLayout.tsx` | Integrate auto-refresh hook |
| **Optional** | Database SQL | Enable unified scheduled job |

---

## Expected Results

| Scenario | Before | After |
|----------|--------|-------|
| Backend sync completes | Freshness bar updates, data stays stale | All dashboard sections auto-refresh |
| User on Today View when Meta syncs | Must manually refresh | Hourly metrics auto-update |
| User on Intelligence page when ActBlue syncs | Must manually refresh | Attribution data auto-updates |
| ActBlue CSV sync (every 6 hours) | Remains on original schedule | Unchanged - triggers auto-refresh when it runs |

---

## Technical Details

### Throttling and Deduplication

To prevent rapid-fire refreshes if multiple sources sync simultaneously:

```typescript
// Debounce multiple source updates within 5 seconds
const lastRefreshRef = useRef<number>(0);
const REFRESH_COOLDOWN_MS = 5000;

const handleSyncUpdate = async (source: string) => {
  const now = Date.now();
  if (now - lastRefreshRef.current < REFRESH_COOLDOWN_MS) {
    // Queue sources, batch invalidate after cooldown
    return;
  }
  lastRefreshRef.current = now;
  await invalidateAllDashboardCaches(queryClient);
};
```

### RLS Consideration

The realtime subscription filters by `organization_id`, ensuring users only receive sync updates for their own organization.

---

## Summary

The backend scheduled syncs are already running correctly every 30 minutes. The fix needed is a **client-side auto-refresh hook** that listens to `data_freshness` table updates and triggers cache invalidation, ensuring all dashboard sections show fresh data without requiring manual user intervention.

