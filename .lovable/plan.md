
# Add "Last Donation Date" Column to Donor List Table

## Overview

Add a new sortable column showing the date of each donor's most recent donation. This field (`last_donation_date`) already exists in the data model and is being fetched from the database - it just needs to be displayed in the UI.

## Changes

### File: `src/components/client/DonorSegmentResults.tsx`

**1. Add to SortField type (line 41)**
```typescript
type SortField = 'name' | 'email' | 'phone' | 'state' | 'total_donated' | 'donation_count' | 'segment' | 'churn_risk_label' | 'last_donation_date';
```

**2. Add date formatting helper function (after line 39)**
```typescript
// Format date to readable format (e.g., "Jan 15, 2026")
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
```

**3. Update columns array (lines 492-501)**

Add new column and adjust widths to accommodate:
| Column | Old Width | New Width |
|--------|-----------|-----------|
| Name | 17% | 15% |
| Email | 18% | 16% |
| Phone | 12% | 11% |
| State | 7% | 6% |
| Lifetime $ | 11% | 10% |
| Donations | 9% | 8% |
| **Last Gift** | — | **9%** (new) |
| Segment | 14% | 14% |
| Risk | 8% | 7% |

**4. Update sorting logic (around line 461)**

Add date comparison handling:
```typescript
// Date comparison
if (sortField === 'last_donation_date') {
  const aDate = aVal ? new Date(aVal).getTime() : 0;
  const bDate = bVal ? new Date(bVal).getTime() : 0;
  return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
}
```

**5. Add column rendering in row (after line 621)**
```typescript
<div style={{ width: '9%' }} className="text-sm text-[hsl(var(--portal-text-muted))]">
  {formatDate(donor.last_donation_date)}
</div>
```

---

### File: `src/components/client/DonorListSheet.tsx`

**1. Add to SortField type**
```typescript
type SortField = 'name' | 'email' | 'phone' | 'state' | 'city' | 'total_donated' | 'donation_count' | 'segment' | 'churn_risk_label' | 'employer' | 'last_donation_date';
```

**2. Add same date formatting helper function**

**3. Update columns array**

Add new column and adjust widths:
```typescript
const columns = [
  { key: 'name' as SortField, label: 'Name', width: '13%' },
  { key: 'email' as SortField, label: 'Email', width: '15%' },
  { key: 'phone' as SortField, label: 'Phone', width: '10%' },
  { key: 'state' as SortField, label: 'State', width: '5%' },
  { key: 'city' as SortField, label: 'City', width: '9%' },
  { key: 'total_donated' as SortField, label: 'Lifetime $', width: '8%' },
  { key: 'donation_count' as SortField, label: 'Donations', width: '6%' },
  { key: 'last_donation_date' as SortField, label: 'Last Gift', width: '9%' },  // NEW
  { key: 'segment' as SortField, label: 'Segment', width: '10%' },
  { key: 'churn_risk_label' as SortField, label: 'Risk', width: '6%' },
  { key: 'employer' as SortField, label: 'Employer', width: '9%' },
];
```

**4. Update sorting logic for date field**

**5. Add column rendering in row**

**6. Update CSV export headers and data**
```typescript
const headers = ['Name', 'Email', 'Phone', 'State', 'City', 'ZIP', 'Lifetime $', 'Donations', 'Last Donation Date', 'Segment', 'Churn Risk', 'Employer', 'Occupation'];
const rows = sortedDonors.map(d => [
  // ... existing fields
  d.last_donation_date || '',  // NEW
  // ...
]);
```

## Summary of Files to Modify

| File | Changes |
|------|---------|
| `src/components/client/DonorSegmentResults.tsx` | Add SortField type, date formatter, column definition, sorting logic, row rendering |
| `src/components/client/DonorListSheet.tsx` | Add SortField type, date formatter, column definition, sorting logic, row rendering, CSV export |

## Expected Result

- New "Last Gift" column appears in both inline table and pop-out sheet
- Column is sortable (newest/oldest first)
- Dates display in readable format: "Jan 15, 2026"
- CSV export includes the last donation date
