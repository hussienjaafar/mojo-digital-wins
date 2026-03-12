

# Export All Filtered Donors (Not Just Current Page)

## Problem
The export currently dumps `data.donors` — which is only the 100 rows on the current page. Users need to export **all** donors matching the active filters.

## Plan

### 1. Add an export-specific RPC call in `handleExport` (`DonorUniverse.tsx`)

Instead of exporting `data.donors`, the export button will:
1. Show a loading toast ("Exporting X donors...")
2. Call `get_donor_universe` with the **same filters** but `_page: 1` and `_page_size: total_count` (or a large cap like 50,000)
3. Use the returned full dataset for the CSV export
4. Include the new motivation fields (`topics`, `pain_points`, `values_appealed`) in the export columns

This avoids needing a separate RPC — we reuse the existing one with a larger page size.

### 2. Add loading state for export

- Add `exporting` state boolean
- Disable the export button while fetching
- Show spinner or "Exporting..." label

### Files changed

| File | Change |
|------|--------|
| `src/components/admin/DonorUniverse.tsx` | Refactor `handleExport` to fetch all filtered rows via RPC before exporting; add exporting state; add motivation columns to CSV |

