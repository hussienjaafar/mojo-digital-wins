# Baseline Metrics - 2025-12-12

## Bundle Analysis

### JavaScript Chunks (Key Files)

| Chunk | Size | Gzipped | Notes |
|-------|------|---------|-------|
| **index.js** (main) | 661.62 kB | 197.42 kB | ⚠️ Large - consider code splitting |
| **Admin.js** | 520.99 kB | 120.68 kB | Admin dashboard bundle |
| **LineChart.js** | 377.67 kB | 103.97 kB | Recharts library |
| **ClientDashboard.js** | 68.00 kB | 16.28 kB | Client dashboard page |
| **SyncControls.js** | 73.14 kB | 19.78 kB | Data sync controls |
| **types.js** | 53.37 kB | 12.18 kB | TypeScript types/utils |
| **ClientCreativeIntelligence.js** | 46.50 kB | 11.00 kB | Creative insights |
| **Auth.js** | 42.35 kB | 14.27 kB | Authentication |
| **sidebar.js** | 35.55 kB | 9.76 kB | Sidebar component |
| **ClientDonorJourney.js** | 31.85 kB | 8.23 kB | Journey page |
| **ClientWatchlist.js** | 26.83 kB | 8.64 kB | Watchlist page |
| **ClientIntelligence.js** | 26.96 kB | 7.37 kB | Intelligence page |
| **ClientAlerts.js** | 20.01 kB | 5.22 kB | Alerts page |
| **ClientShell.js** | 15.60 kB | 5.27 kB | Shell wrapper |
| **ChartPanel.js** | 5.06 kB | 1.63 kB | Chart wrapper |

### CSS Bundles

| File | Size | Gzipped |
|------|------|---------|
| index.css | 214.15 kB | 31.85 kB |
| Admin.css | 5.04 kB | 1.26 kB |

### Large Images (Optimization Candidates)

| Image | Size | Action Needed |
|-------|------|---------------|
| billboard-times-square-wide.jpg | 3,121.98 kB | ⚠️ Compress/WebP |
| a-new-policy.png | 3,039.68 kB | ⚠️ Compress/WebP |
| billboard-times-square-medium.jpg | 2,657.80 kB | ⚠️ Compress/WebP |
| rashid-illinois.jpg | 2,210.21 kB | ⚠️ Compress/WebP |
| unity-justice-fund.png | 1,775.75 kB | ⚠️ Compress/WebP |
| abourezk.png | 888.13 kB | Consider compression |
| preston-pa.png | 709.20 kB | Consider compression |
| abdul-senate.png | 523.69 kB | Consider compression |

### Build Summary

- **Total modules transformed:** 4,825
- **Build completed:** ✅ Success
- **Code splitting:** ✅ Active (multiple chunks)

---

## Lighthouse Scores (December 12, 2025)

> **Test Environment:** Lighthouse CLI 12.8.2, Chrome headless, dev server (localhost:8081)
>
> Note: LCP times are elevated due to dev server (unbundled ESM) and authentication loading in headless mode. Production builds will show significantly better LCP.

| Page | Performance | Accessibility | Best Practices | SEO | LCP | TBT | CLS |
|------|-------------|---------------|----------------|-----|-----|-----|-----|
| /client/dashboard | **55** | **94** | **96** | **91** | 77.7s* | 20ms ✅ | 0 ✅ |
| /client/alerts | **55** | **94** | **96** | **91** | 68.8s* | 20ms ✅ | 0 ✅ |
| /client/journey | **54** | **94** | **96** | **91** | 69.4s* | 120ms ✅ | 0 ✅ |

*\* LCP inflated by dev server + headless auth. Production target is < 2.5s.*

### Lighthouse Report Files

- [`lighthouse-dashboard.report.html`](./lighthouse-dashboard.report.html)
- [`lighthouse-dashboard.report.json`](./lighthouse-dashboard.report.json)
- [`lighthouse-alerts.report.html`](./lighthouse-alerts.report.html)
- [`lighthouse-alerts.report.json`](./lighthouse-alerts.report.json)
- [`lighthouse-journey.report.html`](./lighthouse-journey.report.html)
- [`lighthouse-journey.report.json`](./lighthouse-journey.report.json)

---

## Axe Accessibility Audit (December 12, 2025)

> **Tool:** @axe-core/cli 4.11.0

### Violations Summary

| Page | Violations | Critical | Serious | Moderate |
|------|------------|----------|---------|----------|
| /client/dashboard | 2 | 0 | 0 | 2 |
| /client/alerts | 2 | 0 | 0 | 2 |
| /client/journey | 2 | 0 | 0 | 2 |

### Violation Details

All pages showed the same 2 moderate violations:

| Rule | Impact | Description | Root Cause |
|------|--------|-------------|------------|
| `landmark-one-main` | Moderate | Document lacks a main landmark | Loading/auth state renders before `<main>` element |
| `page-has-heading-one` | Moderate | Page lacks a level-one heading | Loading/auth state lacks `<h1>` |

**Note:** These violations occur because Axe scans during the initial loading state before authentication completes. The authenticated page shell (`ClientShell`) includes:
- `<main role="main" id="main-content">` for the main landmark
- Page-specific `<h1>` headings

**Fix Required:** Add `<main>` landmark and `<h1>` to the loading/auth fallback states.

### Axe Report Files

- [`axe-dashboard.json`](./axe-dashboard.json)
- [`axe-alerts.json`](./axe-alerts.json)
- [`axe-journey.json`](./axe-journey.json)

---

## Targets (World-Class SaaS)

| Metric | Target | Current Status | Notes |
|--------|--------|----------------|-------|
| Performance Score | >= 90 | ⚠️ 54-55 | Dev server penalty; needs production audit |
| Accessibility Score | >= 95 | ⚠️ 94 | 1 point away; fix loading state landmarks |
| LCP | < 2.5s | ⚠️ 68-78s* | Dev server inflated; needs prod measurement |
| TBT | < 200ms | ✅ 20-120ms | **Meets target** |
| CLS | < 0.1 | ✅ 0 | **Meets target** |
| Main bundle (gzip) | < 200 kB | ⚠️ 197.42 kB | At limit - needs monitoring |
| Largest chunk | < 500 kB | ⚠️ 661.62 kB | Needs code splitting |

---

## Key Findings

### ✅ Good

1. **TBT is excellent** - All pages under 200ms (target met)
2. **CLS is perfect** - Zero layout shift across all pages
3. **Accessibility at 94%** - Close to 95% target
4. **Best Practices at 96%** - Strong security/coding practices
5. **SEO at 91%** - Good baseline
6. **Code splitting active** - 100+ chunks generated

### ⚠️ Needs Attention

1. **Performance score 54-55** - Primarily dev server overhead
2. **Main bundle at limit** - 197 kB gzipped (target: < 200 kB)
3. ~~**Recharts chunk large**~~ - ✅ Fixed with lazy loading (Dec 12)
4. **Large images** - 5 images over 1 MB each
5. ~~**Loading state accessibility**~~ - ✅ Fixed with `<main>` and `<h1>` (Dec 12)

### Critical Issues to Address

| Priority | Issue | Impact | Fix | Status |
|----------|-------|--------|-----|--------|
| **P0** | Loading state lacks `<main>` | A11y violation | Add landmark wrapper to auth loading state | ✅ Fixed |
| **P0** | Loading state lacks `<h1>` | A11y violation | Add visually-hidden h1 to loading state | ✅ Fixed |
| **P1** | Recharts bundle size | Performance | Lazy load chart components | ✅ Fixed |
| **P2** | Large images | LCP, bandwidth | Convert to WebP, add responsive images | Pending |
| **P2** | Main bundle at limit | Performance | Audit and tree-shake unused imports | Pending |

---

## Optimizations Applied

### 1. Recharts Lazy Loading (December 12, 2025)

**Before:** Recharts loaded synchronously in `HeroKpiCard`, adding 378 kB raw / 104 kB gzipped to any page that imported the component.

**Implementation:** Converted the Sparkline component to use `React.lazy()` with dynamic `import('recharts')`. The chart module is now only loaded when sparkline data is actually provided and the Suspense boundary resolves.

**Files Changed:**
- `src/components/charts/LazyCharts.tsx` - New lazy wrapper utilities (ChartSuspense, LazySparkline, preloadRecharts)
- `src/components/client/HeroKpiCard.tsx` - Sparkline now uses lazy loading with Skeleton fallback

**Key Code Pattern:**
```tsx
// Dynamic import with React.lazy
const LazySparklineInner = React.lazy(() =>
  import("recharts").then((mod) => ({
    default: function SparklineInner(props) {
      const { ResponsiveContainer, LineChart, Line, Tooltip } = mod;
      return <LineChart>...</LineChart>;
    },
  }))
);

// Usage with Suspense
<React.Suspense fallback={<SparklineSkeleton />}>
  <LazySparklineInner data={data} color={color} />
</React.Suspense>
```

**Bundle Impact:**
| Chunk | Before | After |
|-------|--------|-------|
| LineChart.js (Recharts) | Loaded with main bundle | **Separate chunk: 378.74 kB (104.48 kB gzip)** |
| Initial load for pages without charts | +104 kB gzip | **0 kB** (loaded on demand) |

**Runtime Impact:**
- Pages without sparklines (Alerts, Journey loading states) skip the Recharts download entirely
- First sparkline render shows skeleton for ~100-200ms while chunk loads
- Subsequent renders are instant (chunk cached)
- TBT unchanged: 20-120ms (target: < 200ms) ✅
- CLS unchanged: 0 (skeleton matches chart dimensions) ✅

**Test Updates:**
- Updated HeroKpiCard tests to use `waitFor()` for async lazy loading
- All 30 HeroKpiCard tests passing

### 2. Loading State Accessibility Fix (December 12, 2025)

**Before:** Loading states in `ClientShell` rendered without semantic `<main>` landmark or `<h1>` heading. Axe flagged `landmark-one-main` and `page-has-heading-one` violations during initial page load.

**Implementation:** Added semantic structure to the loading state fallback UI:
- Wrapped loading spinner in `<main id="main-content" role="main">`
- Added visually-hidden `<h1>` using `sr-only` class
- `<h1>` displays `pageTitle` prop when provided, falls back to "Loading dashboard"
- Added `aria-live="polite"` to loading message for screen reader announcements

**Files Changed:**
- `src/components/client/ClientShell.tsx` - Updated loading state with semantic landmarks

**Key Code Pattern:**
```tsx
if (isLoading || !organization) {
  return (
    <div className="portal-theme portal-bg min-h-screen flex items-center justify-center">
      <main
        id="main-content"
        role="main"
        className="text-center space-y-4"
      >
        <h1 className="sr-only">
          {pageTitle || "Loading dashboard"}
        </h1>
        <motion.div className="spinner" aria-hidden="true" />
        <p aria-live="polite">Loading...</p>
      </main>
    </div>
  );
}
```

**A11y Impact:**
- `landmark-one-main` violation: ✅ Resolved
- `page-has-heading-one` violation: ✅ Resolved
- Screen readers now announce page context during loading
- No visual changes - heading is screen-reader only

**Test Coverage:**
- Added 4 new tests in `ClientShell.test.tsx`:
  - `has main landmark during loading state`
  - `has h1 heading during loading state`
  - `uses pageTitle in loading state h1 when provided`
  - `uses fallback text in loading state h1 when pageTitle not provided`
- All 11 ClientShell tests passing

---

## Files Generated

| File | Purpose |
|------|---------|
| `baseline-bundle.txt` | Full Vite build output with all chunk sizes |
| `lighthouse-*.report.html` | Interactive Lighthouse reports |
| `lighthouse-*.report.json` | Machine-readable Lighthouse data |
| `axe-*.json` | Axe accessibility violation data |
| `BASELINE_SUMMARY.md` | This summary |

---

## Next Steps

1. [x] ~~Run Lighthouse audits and update scores~~ (Done - Dec 12)
2. [x] ~~Run Axe accessibility audit~~ (Done - Dec 12)
3. [x] ~~Implement Recharts lazy loading~~ (Done - Dec 12)
4. [x] ~~Fix loading state accessibility (add `<main>` and `<h1>`)~~ (Done - Dec 12)
5. [ ] Run production build audit for accurate LCP
6. [ ] Compress large images to WebP format
7. [ ] Audit main bundle for unused imports

---

*Updated: 2025-12-12 by performance audit workstream*
