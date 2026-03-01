
# Poll Results Page -- Multi-Poll Architecture

## Overview

Create a `/polls` index page that lists all published polls as cards, with each poll linking to a detail page at `/polls/:slug`. The first entry will be the VA-6 Congressional District poll. This architecture ensures future polls are added by simply creating a new data file and registering it in a central array -- no page component changes needed.

## Page Structure

### `/polls` -- Index Page
A grid of poll summary cards showing title, date, sample size, and a one-line key finding. Clicking a card navigates to the detail page. Uses `Navigation` + `Footer` from the main marketing site.

```text
+--------------------------------------------------+
|  Navigation                                       |
+--------------------------------------------------+
|  Hero: "Community Pulse Polling"                  |
|  Subtitle: "Data-driven insights from Molitico"  |
+--------------------------------------------------+
|  Poll Card Grid                                   |
|  +--------------------+  +--------------------+   |
|  | VA-6 Congressional |  | (future poll)      |   |
|  | Feb 18-22, 2026    |  |                    |   |
|  | 1,031 LV | +/-3%   |  |                    |   |
|  | Key finding...     |  |                    |   |
|  +--------------------+  +--------------------+   |
+--------------------------------------------------+
|  Footer                                           |
+--------------------------------------------------+
```

### `/polls/:slug` -- Detail Page
Full visualization of a single poll's results. Loads data from a typed data file keyed by slug.

```text
+--------------------------------------------------+
|  Navigation                                       |
+--------------------------------------------------+
|  Poll Header (title, date, methodology badge)     |
|  Key Finding callout card                         |
+--------------------------------------------------+
|  Section 1: Ballot Test                           |
|  Grouped horizontal bar (EChartsBarChart)         |
|  Initial vs Post-Info side by side                |
+--------------------------------------------------+
|  Section 2: Rasoul Favorability                   |
|  Stacked horizontal bar (EChartsBarChart)         |
|  Net favorability: +47%                           |
+--------------------------------------------------+
|  Section 3: Candidate Type Preference             |
|  Donut chart (EChartsPieChart variant="donut")    |
+--------------------------------------------------+
|  Section 4: Progressive Figure Favorability       |
|  Horizontal bar chart (EChartsBarChart)           |
+--------------------------------------------------+
|  Section 5: Methodology                           |
|  V3DataTable with demographics + geography note   |
+--------------------------------------------------+
|  Footer                                           |
+--------------------------------------------------+
```

## Data Architecture

Instead of hardcoding data inside a page component, create a typed data module that exports an array of poll objects. Each poll contains all its data sections. Adding a future poll means adding a new object to this array.

```text
src/data/polls/
  index.ts          -- exports the polls array and types
  va6-2026.ts       -- VA-6 poll data
```

### Poll Data Shape (TypeScript)

```typescript
interface PollData {
  slug: string;                    // URL slug
  title: string;                   // "VA-6 Congressional District Poll"
  subtitle: string;                // "Proposed VA-6 Democratic Primary"
  date: string;                    // "February 18-22, 2026"
  sponsor: string;                 // "Unity & Justice Fund"
  sampleSize: number;              // 1031
  marginOfError: number;           // 3
  population: string;              // "Likely Democratic Primary Voters"
  keyFinding: string;              // One-line summary
  sections: PollSection[];         // Chart sections
  methodology: MethodologyData;    // Demographics table
}
```

Each `PollSection` has a `type` field ("grouped-bar", "stacked-bar", "donut", "horizontal-bar") that the detail page component uses to render the correct chart.

## Visualization Choices

| Data Set | Chart Type | Rationale |
|----------|-----------|-----------|
| Ballot Test (Initial vs Post-Info) | Grouped horizontal bar | Gold standard for comparing two measurements per candidate; shift values shown as annotations |
| Rasoul Favorability | Stacked horizontal bar | Shows full opinion spectrum; midpoint clearly separates favorable/unfavorable |
| Candidate Type Preference | Donut chart | Three clean categories; percentages prominent in center |
| Progressive Figure Favorability | Horizontal bar | Simple ranked comparison; descending sort for scannability |
| Methodology Demographics | V3DataTable | Tabular data is clearest as a table |

### Color Choices (Non-Partisan)

- Blue (`--portal-accent-blue`) for Rasoul
- Slate/gray for Perriello
- Purple (`--portal-accent-purple`) for Macy
- Muted gray for Undecided
- Green (`--portal-success`) for favorable ratings
- Amber (`--portal-warning`) for neutral
- Red (`--portal-error`) for unfavorable

This avoids red/blue partisan framing while staying within the V3 design system palette.

## Files to Create

| File | Purpose |
|------|---------|
| `src/data/polls/index.ts` | Poll type definitions and registry array |
| `src/data/polls/va6-2026.ts` | VA-6 poll data (all 5 sections + methodology) |
| `src/pages/Polls.tsx` | Index page -- grid of poll cards |
| `src/pages/PollDetail.tsx` | Detail page -- renders sections based on data type |

## Files to Modify

| File | Change |
|------|---------|
| `src/App.tsx` | Add lazy imports for `Polls` and `PollDetail`, add routes `/polls` and `/polls/:slug`, add to `marketingRoutes` array |
| `src/components/Footer.tsx` | Add "Polling" link to Quick Links section |
| `src/components/landing/LandingFooter.tsx` | Add "Polling" link |

## Technical Details

- Both pages use `Navigation` + `Footer` (matching `Index.tsx` pattern)
- Chart sections wrapped in `portal-theme dark` div so V3 ECharts components render with dark tokens
- All charts use `V3ChartWrapper` for accessibility (ariaLabel, dataSummary)
- `EChartsBarChart` with `horizontal={true}` for all bar charts
- `EChartsPieChart` with `variant="donut"` for candidate type preference
- `V3DataTable` for methodology demographics
- `AnimateOnScroll` for scroll-triggered section reveals
- Helmet SEO tags on both pages
- Responsive: single column on mobile, side-by-side methodology cards on desktop
- Future polls: just create a new data file in `src/data/polls/`, add it to the registry array, and it automatically appears on the index page and gets its own detail route
