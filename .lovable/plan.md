
# Contact Form Submissions Admin Page - V3 Redesign

## Summary

The existing `EnhancedContactManagement` component needs to be redesigned to match the V3 design system used throughout the admin dashboard. The component already exists and is wired to the Admin dashboard but uses older UI patterns (basic Card/Table components) that don't match the premium portal theme aesthetic.

## Current State Analysis

**What Exists:**
- `src/components/EnhancedContactManagement.tsx` (865 lines)
- Already wired to Admin.tsx under the "contacts" tab (line 362)
- Has complete functionality: filtering, bulk operations, notes, CSV export, status/priority management
- Uses some V3 components (V3Button) but mixed with older Card/Table patterns

**Problems:**
1. Uses basic `Card` components instead of V3 portal-themed cards
2. Uses standard `Table` instead of `V3DataTable`
3. Stats cards use old Card pattern, not `AdminStatsGrid`
4. Missing `AdminPageHeader` for consistent page layout
5. Filter inputs don't use `PortalFormInput`/`PortalFormSelect`
6. Missing portal-theme CSS classes throughout
7. Not using portal color variables consistently

## Implementation Plan

### Phase 1: Create New V3 Contact Submissions Page

Create a new standalone admin page at `/admin/contacts` following the pattern of `OrganizationDetail.tsx`:

**File: `src/pages/admin/ContactSubmissions.tsx`**

The new page will:
- Use `AdminDetailShell` wrapper for portal-theme context
- Use `AdminPageHeader` with Mail icon and refresh functionality
- Use `AdminStatsGrid` for the 5 stats cards (Total, New, In Progress, Resolved, Urgent)
- Use `V3DataTable` for the submissions list with proper sorting/pagination
- Use `PortalFormInput` and `PortalFormSelect` for search and filters
- Use `V3Button` and `V3Badge` throughout
- Keep all existing business logic (bulk ops, notes, assignments)

### Phase 2: Update Admin Routing

**File: `src/App.tsx`** (or wherever routes are defined)
- Add route: `/admin/contacts` → `ContactSubmissions`

**File: `src/pages/Admin.tsx`**
- Update the "contacts" tab to navigate to `/admin/contacts` instead of rendering inline

### Phase 3: Update Navigation

**File: `src/components/AdminSidebar.tsx`**
- The "contacts" tab already exists via the keyboard shortcut (g+m)
- Need to add explicit navigation item in the appropriate group

---

## Technical Details

### New Component Structure

```text
src/pages/admin/ContactSubmissions.tsx
├── AdminDetailShell (portal-theme wrapper)
│   ├── AdminPageHeader (Mail icon, title, refresh, actions)
│   ├── AdminStatsGrid (5 stat cards)
│   ├── Filter Bar (PortalFormInput + PortalFormSelect)
│   │   ├── Search input with portal styling
│   │   ├── Status filter dropdown
│   │   └── Priority filter dropdown
│   ├── Bulk Actions Bar (when items selected)
│   │   └── V3Button actions
│   ├── V3DataTable
│   │   ├── Checkbox column
│   │   ├── Name/Email column (primary)
│   │   ├── Message column
│   │   ├── Status column (inline select)
│   │   ├── Priority column (inline select)
│   │   ├── Assigned column (inline select)
│   │   ├── Notes column
│   │   ├── Date column
│   │   └── Actions column
│   └── Dialogs (Notes, Bulk Delete)
```

### V3DataTable Column Definitions

```typescript
const columns: V3Column<SubmissionWithDetails>[] = [
  {
    key: "select",
    header: "",
    width: "48px",
    render: (row) => <Checkbox ... />
  },
  {
    key: "contact",
    header: "Contact",
    primary: true,
    sortable: true,
    render: (row) => (
      <div>
        <p className="font-medium text-[hsl(var(--portal-text-primary))]">{row.name}</p>
        <p className="text-sm text-[hsl(var(--portal-text-muted))]">{row.email}</p>
      </div>
    )
  },
  {
    key: "message",
    header: "Message",
    render: (row) => <p className="truncate max-w-[300px]">{row.message}</p>
  },
  {
    key: "status",
    header: "Status",
    sortable: true,
    render: (row) => <StatusSelect ... />
  },
  // ... more columns
];
```

### Stats Grid Configuration

```typescript
const statItems: AdminStatItem[] = [
  {
    id: "total",
    label: "Total Submissions",
    value: stats.total,
    icon: MessageSquare,
    accent: "blue"
  },
  {
    id: "new",
    label: "New",
    value: stats.new,
    icon: AlertCircle,
    accent: "blue"
  },
  {
    id: "in_progress",
    label: "In Progress",
    value: stats.inProgress,
    icon: Clock,
    accent: "amber"
  },
  {
    id: "resolved",
    label: "Resolved",
    value: stats.resolved,
    icon: CheckCircle2,
    accent: "green"
  },
  {
    id: "urgent",
    label: "Urgent",
    value: stats.urgent,
    icon: Flag,
    accent: "red"
  }
];
```

### Portal-Themed Filter Bar

```typescript
<div className="portal-card p-4">
  <div className="flex flex-col sm:flex-row gap-4">
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
      <PortalFormInput
        placeholder="Search submissions..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="pl-10"
      />
    </div>
    <PortalFormSelect
      value={statusFilter}
      onValueChange={setStatusFilter}
      options={statusOptions}
      placeholder="All Status"
    />
    <PortalFormSelect
      value={priorityFilter}
      onValueChange={setPriorityFilter}
      options={priorityOptions}
      placeholder="All Priority"
    />
    <V3Button variant="secondary" onClick={exportToCSV}>
      <Download className="h-4 w-4 mr-2" />
      Export
    </V3Button>
  </div>
</div>
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/pages/admin/ContactSubmissions.tsx` | Create | New V3 contact submissions page |
| `src/components/AdminSidebar.tsx` | Modify | Add "Contact Submissions" nav item to System or new group |
| `src/pages/Admin.tsx` | Modify | Update contacts case to navigate or lazy-load new page |
| `src/App.tsx` | Modify | Add route for `/admin/contacts` |

---

## Migration Notes

1. The existing `EnhancedContactManagement.tsx` can remain temporarily for reference but will be deprecated
2. All business logic (RPC calls, state management, CRUD operations) will be preserved
3. The `get_submissions_with_details` RPC function continues to work unchanged
4. Bulk operations, notes dialog, and CSV export all carry forward
