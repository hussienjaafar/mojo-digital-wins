
# Remove Search, Min Population Filter, and Fix Sidebar Empty State

## What Changes

### 1. Simplify MapControls to metric toggle only
**File: `src/components/voter-impact/MapControls.tsx`**
- Remove the search input, min population slider, clear filters button, and all dividers
- Remove unused imports: `Search`, `X`, `Input`, `Slider`, `Button`
- Remove props: `filters`, `onFiltersChange`, `maxVoters`
- Remove helpers: `formatVoterCount`, `hasActiveFilters`, `handleSearchChange`, `handleMinVotersChange`, `handleClearFilters`
- Keep only the metric toggle radio group

### 2. Remove filter types and logic
**File: `src/types/voter-impact.ts`**
- Remove `MapFilters` interface
- Remove `DEFAULT_MAP_FILTERS` constant
- Remove `applyFilters` function

### 3. Remove filter state from page
**File: `src/pages/admin/VoterImpactMap.tsx`**
- Remove `filters` state, `initialFilters` memo, `maxVoters` memo, `filteredDistricts` memo, `hasActiveFilters` memo
- Remove filter-related URL param syncing (`minVoters`, `q`)
- Remove filter-related imports (`MapFilters`, `DEFAULT_MAP_FILTERS`, `applyFilters`)
- Simplify `MapControls` props (only `activeMetric` and `onMetricChange`)
- Remove `filters`, `filteredDistrictCount`, `hasActiveFilters`, `onClearFilters` props from `ImpactMap`

### 4. Remove filter props from ImpactMap
**File: `src/components/voter-impact/ImpactMap.tsx`**
- Remove `filters` from props interface
- Remove `filteredDistrictCount`, `hasActiveFilters`, `onClearFilters` props
- Remove the "No districts found" empty state overlay (lines ~541-561)
- Remove `MapFilters` import

### 5. Fix sidebar empty state -- remove "Use presets" tip
**File: `src/components/voter-impact/RegionSidebar.tsx`**
- Remove the third tip card that says "Use presets / Find high-impact targets" (lines 572-580)
- Keep only the "Click a state" and "Zoom in" tips, which are still accurate

### 6. Update tests
- Update any test files referencing `MapFilters`, search inputs, slider, or the preset text
