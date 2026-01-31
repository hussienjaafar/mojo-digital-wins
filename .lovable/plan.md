
# Fix: Voter Impact Map Blank Page

## Root Cause Analysis

The blank page is caused by **missing React imports** in three voter-impact components. These components reference `React.FC` or `React.ReactNode` without importing React, which throws a runtime `ReferenceError: React is not defined` and crashes the entire page before any UI renders.

### Affected Files

| File | Issue | Line |
|------|-------|------|
| `src/components/voter-impact/MapLegend.tsx` | Uses `React.FC` without import | Line 8 |
| `src/components/voter-impact/MapControls.tsx` | Uses `React.ReactNode` without import | Line 54 |
| `src/components/voter-impact/RegionSidebar.tsx` | Uses `React.ReactNode` without import | Line 140 |

### Why This Happens

The project uses Vite with the automatic JSX runtime, which means you don't need to import React just to use JSX. However, if you explicitly reference the `React` namespace (like `React.FC` or `React.ReactNode`), you must import it.

## Solution

Add the missing React import to each affected file:

### 1. MapLegend.tsx
Add at line 1:
```typescript
import React from 'react';
```

### 2. MapControls.tsx
Change line 8 from:
```typescript
import { useCallback, useMemo } from "react";
```
To:
```typescript
import React, { useCallback, useMemo } from "react";
```

### 3. RegionSidebar.tsx
Add at line 1:
```typescript
import React from 'react';
```

## Technical Details

### Current State
- Network requests show 200 OK for database tables (data is loading correctly)
- The error occurs at component initialization before any rendering
- Browser console may show "React is not defined" but logs aren't captured because the crash happens early

### Vite Config Assessment
The recent `vite.config.ts` changes for MapLibre bundling are correctly configured and are not causing this issue. The `optimizeDeps.include` and `build.commonjsOptions` settings are appropriate for MapLibre 5.x.

### After Fix
Once the React imports are added:
1. The page will render the header, controls, and sidebar
2. The map will load with GeoJSON data
3. States will be colored according to impact scores (previously fixed with `["to-string", ["id"]]` expression)
4. Console logs will show diagnostic output confirming data flow
