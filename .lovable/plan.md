
# Fix: Admin Dashboard Blank Page - Missing React Imports

## Root Cause Analysis

The entire admin dashboard (and by extension the whole app when viewing `/admin`) is crashing because multiple components reference the `React` namespace without importing it. When JavaScript tries to access `React.ComponentType` or `React.ReactNode` without React being in scope, it throws a `ReferenceError: React is not defined`, which crashes the entire component tree before anything can render.

## Why No Console Logs?

The crash happens during module loading/parsing, before React even mounts to the DOM. This is why:
- No console logs are visible (the app never gets to execute any runtime code)
- No network requests appear (Supabase queries never fire)
- The page is completely blank (React never renders anything)

## Affected Files (Priority Order)

| File | Issue | Impact |
|------|-------|--------|
| `src/components/AdminSidebar.tsx` | Uses `React.ComponentType` (lines 64, 77) | **CRITICAL** - Breaks entire admin layout |
| `src/components/dashboard/widgets/MetricsWidget.tsx` | Uses `React.ReactNode` (line 11) | Breaks admin dashboard widgets |
| `src/components/charts/USChoroplethMap.tsx` | Uses `React.ReactNode`, `React.MouseEvent` (lines 84, 193, etc.) | Breaks choropleth maps |
| `src/components/admin/VoterImpactDataImport.tsx` | Uses `React.ChangeEvent` (lines 474, 488) | Breaks voter data import |
| `src/components/client/OrgBulkInvite.tsx` | Uses `React.ChangeEvent` (line 103) | Breaks bulk invite feature |
| `src/components/admin/forms/LogoUploadField.tsx` | Uses `React.DragEvent`, `React.ChangeEvent` (lines 107, 112) | Breaks logo uploads |

## Solution

Add `import React from 'react';` to each affected file. For files that already import from React (like `useState`, `useCallback`), update the import to include the default export.

### 1. AdminSidebar.tsx (CRITICAL - fixes main dashboard)

**Current (line 1):**
```typescript
import { useEffect, useState, useRef, useCallback } from "react";
```

**Fixed:**
```typescript
import React, { useEffect, useState, useRef, useCallback } from "react";
```

### 2. MetricsWidget.tsx

**Add at line 1:**
```typescript
import React from 'react';
```

### 3. USChoroplethMap.tsx

**Current (line 1):**
```typescript
import { useMemo, useState, useCallback } from "react";
```

**Fixed:**
```typescript
import React, { useMemo, useState, useCallback } from "react";
```

### 4. VoterImpactDataImport.tsx

**Current (line 8):**
```typescript
import { useState, useCallback } from "react";
```

**Fixed:**
```typescript
import React, { useState, useCallback } from "react";
```

### 5. OrgBulkInvite.tsx

Needs React import added (will check exact current import statement during implementation).

### 6. LogoUploadField.tsx

Needs React import added (will check exact current import statement during implementation).

## Technical Details

### Why This Happens

Vite uses the automatic JSX runtime (`@vitejs/plugin-react-swc`), which means:
- JSX like `<div>` is automatically transformed without needing `import React`
- However, explicit references to the `React` namespace (like `React.FC`, `React.ReactNode`, `React.ChangeEvent`) still require the import
- TypeScript compiles these to `React.ComponentType` at runtime, which fails if React isn't in scope

### Vite Config Status

The recent `vite.config.ts` changes for MapLibre bundling are correct and are NOT causing this issue:
```typescript
optimizeDeps: {
  include: ['maplibre-gl', 'react-map-gl'],
},
build: {
  commonjsOptions: {
    include: [/maplibre-gl/, /node_modules/],
  },
},
```

### After Fix

Once the React imports are added:
1. The admin dashboard will render immediately
2. All sidebar navigation will work
3. Dashboard widgets and charts will display
4. The Voter Impact Map will load correctly
5. All file upload/import features will function

## Files to Modify

1. `src/components/AdminSidebar.tsx` - Line 1
2. `src/components/dashboard/widgets/MetricsWidget.tsx` - Line 1
3. `src/components/charts/USChoroplethMap.tsx` - Line 1
4. `src/components/admin/VoterImpactDataImport.tsx` - Line 8
5. `src/components/client/OrgBulkInvite.tsx` - Check and fix import
6. `src/components/admin/forms/LogoUploadField.tsx` - Check and fix import
