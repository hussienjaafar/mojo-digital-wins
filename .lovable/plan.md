

# Enhanced Donor List Table with Sorting, Filtering, Pop-Out View, and Phone Numbers

## Summary

This plan adds four major improvements to the Donor Intelligence page's donor list table:
1. **Column Sorting** - Clickable headers to sort by any column
2. **In-table Search/Filter** - Quick search within the current results
3. **Pop-Out View** - Expand the table to a full-screen sheet with more details
4. **Phone Numbers** - Display phone data (already available for ~42% of donors)

---

## Current State

- **Table View**: Basic virtualized list with 7 columns (Name, Email, State, Lifetime $, Donations, Segment, Risk)
- **Phone Data**: Already exists in the database - 13,698 of 32,417 donors (42%) have phone numbers
- **No Sorting**: Columns are not clickable; data is always sorted by `total_donated DESC`
- **No In-table Filter**: Users must use the main segment builder to filter

---

## Technical Implementation

### 1. Update Type Definitions

**File: `src/types/donorSegment.ts`**

Add `phone` field to `SegmentDonor` interface:
```typescript
export interface SegmentDonor {
  id: string;
  donor_key: string;
  email: string | null;
  phone: string | null;  // NEW
  name: string | null;
  // ... rest unchanged
}
```

### 2. Update Query to Fetch Phone Numbers

**File: `src/queries/useDonorSegmentQuery.ts`**

Add `phone` to the select statement:
```typescript
let query = supabase
  .from('donor_demographics')
  .select(`
    id,
    donor_key,
    donor_email,
    phone,  // ADD THIS
    first_name,
    last_name,
    ...
  `)
```

Update the `transformToDonor` function to include phone:
```typescript
function transformToDonor(row: any, ltvData: any, attribution?: DonorAttribution): SegmentDonor {
  return {
    // ...
    phone: row.phone || null,  // ADD THIS
    // ...
  };
}
```

### 3. Enhanced Table Component with Sorting

**File: `src/components/client/DonorSegmentResults.tsx`**

Replace the basic `TableView` with an enhanced version that includes:

```typescript
type SortField = 'name' | 'email' | 'phone' | 'state' | 'total_donated' | 'donation_count' | 'segment' | 'churn_risk_label';
type SortDirection = 'asc' | 'desc';

function TableView({ donors, onExpandClick }: { donors: SegmentDonor[]; onExpandClick: () => void }) {
  const [sortField, setSortField] = useState<SortField>('total_donated');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchTerm, setSearchTerm] = useState('');

  // Filter by search term
  const filteredDonors = useMemo(() => {
    if (!searchTerm) return donors;
    const lower = searchTerm.toLowerCase();
    return donors.filter(d => 
      d.name?.toLowerCase().includes(lower) ||
      d.email?.toLowerCase().includes(lower) ||
      d.phone?.includes(searchTerm)
    );
  }, [donors, searchTerm]);

  // Sort filtered results
  const sortedDonors = useMemo(() => {
    return [...filteredDonors].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      // Handle nulls, compare values, apply direction
    });
  }, [filteredDonors, sortField, sortDirection]);

  // Clickable column headers
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };
}
```

**Column Headers** with sort indicators:
```typescript
<div onClick={() => handleSort('total_donated')} className="cursor-pointer flex items-center gap-1">
  Lifetime $
  {sortField === 'total_donated' && (
    <ChevronUp className={cn("h-3 w-3", sortDirection === 'desc' && "rotate-180")} />
  )}
</div>
```

### 4. Pop-Out Sheet Component

**File: `src/components/client/DonorListSheet.tsx` (NEW)**

Create a full-screen sheet that displays the donor list with enhanced features:

```typescript
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Expand, Search, ChevronUp, ChevronDown } from "lucide-react";

interface DonorListSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  donors: SegmentDonor[];
  totalCount: number;
}

export function DonorListSheet({ open, onOpenChange, donors, totalCount }: DonorListSheetProps) {
  // Same sorting/filtering logic as inline table
  // Full-height virtualized list
  // Additional columns: Phone, City, ZIP, Employer, Occupation
  // Export button within sheet
}
```

### 5. Integration in Results Component

**File: `src/components/client/DonorSegmentResults.tsx`**

Add pop-out button and sheet:

```typescript
function TableView({ donors }: { donors: SegmentDonor[] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <>
      <V3Card>
        <V3CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <V3CardTitle>Donor List ({donors.length.toLocaleString()})</V3CardTitle>
            <div className="flex items-center gap-2">
              {/* Search input */}
              <Input 
                placeholder="Search donors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {/* Expand button */}
              <V3Button variant="ghost" size="sm" onClick={() => setIsExpanded(true)}>
                <Expand className="h-4 w-4" />
              </V3Button>
            </div>
          </div>
        </V3CardHeader>
        {/* ... table content */}
      </V3Card>
      
      <DonorListSheet 
        open={isExpanded} 
        onOpenChange={setIsExpanded}
        donors={donors}
        totalCount={donors.length}
      />
    </>
  );
}
```

### 6. Update Column Configuration

Add Phone column to both inline and pop-out views:

```typescript
const columns = [
  { key: 'name', label: 'Name', width: '18%', sortable: true },
  { key: 'email', label: 'Email', width: '18%', sortable: true },
  { key: 'phone', label: 'Phone', width: '12%', sortable: true },  // NEW
  { key: 'state', label: 'State', width: '7%', sortable: true },
  { key: 'total_donated', label: 'Lifetime $', width: '11%', sortable: true },
  { key: 'donation_count', label: 'Donations', width: '9%', sortable: true },
  { key: 'segment', label: 'Segment', width: '13%', sortable: true },
  { key: 'churn_risk', label: 'Risk', width: '8%', sortable: true },
];
```

---

## UI/UX Design

### Inline Table Enhancements
- **Search Bar**: Small input above the table for quick filtering
- **Sortable Headers**: Cursor pointer on hover, up/down chevron indicating sort direction
- **Expand Button**: Icon button to pop out the table

### Pop-Out Sheet
- **Full Width**: Uses `max-w-7xl` instead of default `sm:max-w-sm`
- **Additional Columns**: Shows Phone, City, ZIP, Employer, Occupation
- **Sticky Header**: Table header stays visible while scrolling
- **Export Button**: In-sheet export for convenience

### Phone Display
- Format: `(555) 123-4567` or raw if invalid format
- Shows "—" for missing phone numbers
- Clickable for mobile: `tel:` link

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/types/donorSegment.ts` | Modify | Add `phone` field to `SegmentDonor` |
| `src/queries/useDonorSegmentQuery.ts` | Modify | Fetch phone column, include in transform |
| `src/components/client/DonorSegmentResults.tsx` | Modify | Add sorting, search, expand button, phone column |
| `src/components/client/DonorListSheet.tsx` | Create | Full-screen pop-out sheet component |

---

## Expected Outcome

After implementation:
1. **Sorting**: Click any column header to sort ascending/descending
2. **Search**: Type in the search box to filter by name, email, or phone
3. **Pop-Out**: Click expand icon to open full-screen sheet with more columns
4. **Phone Numbers**: Visible for ~42% of donors who provided phone data

