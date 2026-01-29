
# Fix: Persistent "ActBlue Historical Import - Cancelled" Banner Bug

## Problem Summary

The "ActBlue Historical Import - Cancelled" notification keeps reappearing for organizations (like "A New Policy") even though the import was cancelled days ago. This happens because:

1. **No persistence for dismissal**: When users click the "X" to dismiss the banner, it only sets local React state that resets on every page load
2. **No age threshold**: Terminal jobs (cancelled/failed) show indefinitely, regardless of how old they are
3. **Wrong label**: The banner always says "ActBlue Historical Import" even for Meta Ads backfill jobs

## Root Cause Analysis

| Issue | Current Behavior | Expected Behavior |
|-------|-----------------|-------------------|
| Dismissal State | Uses `useState(false)` - resets on mount | Should persist using `localStorage` |
| Age Threshold | No limit - old jobs show forever | Should auto-hide after 24-48 hours |
| Job Type Label | Always shows "ActBlue Historical Import" | Should detect job type from `task_name` |
| Auto-dismiss | Only applies to "completed" jobs | Should also apply to old cancelled/failed jobs |

### Current Code Issues

```text
src/components/client/BackfillStatusBanner.tsx
├── Line 168: const [dismissed, setDismissed] = useState(false)  ← NOT PERSISTED
├── Line 218: job.status === "cancelled" always shows           ← NO AGE CHECK
└── Line 255: Always says "ActBlue Historical Import"           ← WRONG FOR META JOBS
```

## Solution

### Change 1: Persist Dismissal State in localStorage

Replace `useState` with `useLocalStorage` to remember which jobs have been dismissed, keyed by job ID.

**File**: `src/components/client/BackfillStatusBanner.tsx`

```typescript
// Before
const [dismissed, setDismissed] = useState(false);

// After
import { useLocalStorage } from "@/hooks/useLocalStorage";

// Store dismissed job IDs to persist across sessions
const [dismissedJobs, setDismissedJobs] = useLocalStorage<string[]>(
  'backfill-dismissed-jobs',
  []
);
const dismissed = job ? dismissedJobs.includes(job.id) : false;

// When dismissing
const handleDismiss = () => {
  if (job) {
    setDismissedJobs(prev => [...prev, job.id]);
  }
};
```

### Change 2: Add Age-Based Auto-Dismissal for Terminal Jobs

For cancelled/failed jobs, automatically hide them after 24 hours:

```typescript
// New useEffect for age-based hiding
useEffect(() => {
  if (!job) return;
  
  const isTerminal = job.status === "cancelled" || 
                     job.status === "failed" || 
                     job.status === "completed_with_errors";
  
  if (isTerminal && job.completed_at) {
    const completedTime = new Date(job.completed_at).getTime();
    const now = Date.now();
    const hoursElapsed = (now - completedTime) / (1000 * 60 * 60);
    
    // Auto-dismiss terminal jobs older than 24 hours
    const AUTO_DISMISS_HOURS = 24;
    if (hoursElapsed >= AUTO_DISMISS_HOURS && !dismissedJobs.includes(job.id)) {
      setDismissedJobs(prev => [...prev, job.id]);
    }
  }
}, [job?.status, job?.completed_at, job?.id]);
```

### Change 3: Show Correct Import Type Label

Detect whether the job is ActBlue or Meta Ads from the `task_name`:

```typescript
// Derive job type from task_name
const importType = job?.task_name?.startsWith('actblue') 
  ? 'ActBlue Historical Import' 
  : job?.task_name?.startsWith('meta_ads') 
    ? 'Meta Ads Backfill' 
    : 'Data Import';

// In JSX
<span className="font-medium">
  {importType}
</span>
```

### Change 4: Clean Up Old Dismissed Job IDs

Prevent localStorage from growing indefinitely by pruning old dismissed IDs (keep last 50):

```typescript
// When adding a new dismissed job, prune old entries
const handleDismiss = () => {
  if (job) {
    setDismissedJobs(prev => {
      const updated = [...prev, job.id];
      // Keep only the most recent 50 dismissed jobs
      return updated.slice(-50);
    });
  }
};
```

## Files to Modify

| File | Change |
|------|--------|
| `src/components/client/BackfillStatusBanner.tsx` | Add localStorage persistence, age-based auto-dismiss, dynamic job type label |

## Expected Results

After implementing these changes:

| Scenario | Behavior |
|----------|----------|
| User dismisses cancelled banner | Stays dismissed across page loads and sessions |
| Cancelled job is 2+ days old | Auto-hidden without user action |
| Meta Ads backfill job | Shows "Meta Ads Backfill" label instead of "ActBlue" |
| New job starts for same org | Previous dismissal is ignored; new job shows normally |
| User has dismissed 100+ jobs | Only last 50 are remembered (prevents bloat) |

## Testing Plan

1. View "A New Policy" dashboard - verify cancelled banner no longer appears (job is 15+ days old)
2. Click dismiss on any visible cancelled/failed banner - verify it stays dismissed after page refresh
3. Start a new backfill for an org with a previously dismissed job - verify the new job's banner appears
4. Verify Meta Ads backfill jobs show correct "Meta Ads Backfill" label
