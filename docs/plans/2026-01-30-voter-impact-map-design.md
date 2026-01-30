# Muslim Voter Impact Map - Design Document

**Date:** 2026-01-30
**Status:** Approved
**Route:** `/admin/voter-impact-map`
**Access:** Admin role only

## Overview

A UX/UI masterpiece data visualization tool for analyzing Muslim voter distribution and election impact potential across the United States. Features smooth zooming from national to congressional district level, dark mode data dashboard aesthetic, and comprehensive filtering/comparison capabilities.

## Data Sources

| File | Rows | Granularity | Key Fields |
|------|------|-------------|------------|
| CD_GOTV_ANALYSIS | 436 | Congressional Districts | Election results, Muslim voter counts, registration, turnout, impact potential, cost estimates |
| National_Analysis | 49 | States | Muslim voters, households, registration rates, voting rates, donors, activists |

## Architecture

```
/admin/voter-impact-map
├── VoterImpactMap.tsx (main page component)
├── components/voter-impact/
│   ├── ImpactMap.tsx (MapLibre GL container)
│   ├── MapControls/
│   │   ├── SearchBar.tsx
│   │   ├── FilterDropdowns.tsx
│   │   ├── ThresholdSlider.tsx
│   │   └── Presets.tsx
│   ├── RegionSidebar.tsx
│   ├── ComparisonPanel.tsx
│   └── MapLegend.tsx
├── hooks/voter-impact/
│   ├── useVoterImpactData.ts
│   ├── useMapLayers.ts
│   └── useRegionSelection.ts
├── api/admin/voter-impact/
│   ├── states.ts
│   └── districts.ts
└── data/geojson/
    ├── us-states.json
    └── congressional-districts-118.json
```

## Visual Design

### Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ◀ Back to Admin    MUSLIM VOTER IMPACT MAP           [Metric Toggle ▼] │
├─────────────────────────────────────────────────────────────────────────┤
│ [🔍 Search...] [Party ▼] [Impact ▼] [Threshold ━━●━━] [Presets ▼]       │
├───────────────────────────────────────────────────────┬─────────────────┤
│                                                       │                 │
│                                                       │  REGION NAME    │
│                    MAP AREA                           │  Details...     │
│                 (MapLibre GL)                         │                 │
│                                                       │  [+ Compare]    │
├───────────────────────────────────────────────────────┴─────────────────┤
│  ◄ NO IMPACT ════════════════════════════════════► HIGH IMPACT          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Dark Theme Palette

| Element | Color |
|---------|-------|
| Background | `#0a0f1a` (deep navy-black) |
| Card/Sidebar | `#141b2d` (elevated surface) |
| Borders | `#1e2a45` (subtle separation) |
| Text primary | `#e2e8f0` (off-white) |
| Text secondary | `#64748b` (muted) |
| Accent glow | `#3b82f6` (blue) |
| Impact - No | `#ef4444` (red) |
| Impact - Medium | `#eab308` (yellow) |
| Impact - High | `#22c55e` (green) |

## Map Interaction

### Zoom Levels & Layer Visibility

| Zoom Level | Visible | Behavior |
|------------|---------|----------|
| 3-5 (national) | State boundaries only | States colored by aggregated impact |
| 5-7 (regional) | States + CD boundaries fade in | Transition zone |
| 7+ (state detail) | Congressional districts prominent | States become subtle outlines |

### Interaction States

- **Hover:** Region glows with accent blue border, tooltip shows name + key metric
- **Selected:** Solid accent border, sidebar populates with full details
- **Compared:** Secondary selection color (purple), added to comparison panel
- **Filtered out:** 20% opacity, non-interactive

### Transitions

- 300ms ease-out for color/opacity changes
- 1.5s flyTo animations for zoom
- Layer opacity synced to zoom level

## Sidebar Content

### Single Region View

```
┌─────────────────────────┐
│  STATE · CD-CODE        │
│  ●━━ IMPACT STATUS ━━●  │
├─────────────────────────┤
│  MUSLIM VOTERS          │
│  [count]                │
│  ├─ Registered: X       │
│  └─ Unregistered: Y     │
├─────────────────────────┤
│  2024 TURNOUT           │
│  [progress bar] XX%     │
│  X voted / Y didn't     │
├─────────────────────────┤
│  ELECTION MARGIN        │
│  X votes (Y%)           │
│  ▲ Winner (Party)       │
│  ▼ Runner-up (Party)    │
├─────────────────────────┤
│  MOBILIZATION           │
│  Votes needed: X        │
│  Est. cost: $XXX        │
├─────────────────────────┤
│  [+ Add to Compare]     │
└─────────────────────────┘
```

### Comparison Mode

- Max 4 regions side-by-side
- Auto-highlight "best" option based on selected metric
- Click to remove from comparison

## Filtering System

### Controls

1. **Search Bar** - Autocomplete for states/CDs, fly to on select
2. **Party Filter** - All / Democrat / Republican / Close races (<5%)
3. **Impact Filter** - All / High impact / Can impact / No impact
4. **Voter Threshold Slider** - Filter by minimum Muslim voter count
5. **Quick Presets:**
   - Swing Districts (margin <2%, has impact)
   - High ROI Targets (low cost, high potential)
   - Low Turnout Opportunities (turnout <50%, can impact)
   - Top 20 by Population

### Behavior

- Filters combine with AND logic
- Active filters show as removable pills
- URL updates with filter state (shareable)

## Data Layer

### Database Schema

```sql
-- State-level aggregates
CREATE TABLE voter_impact_states (
  state_code VARCHAR(2) PRIMARY KEY,
  state_name VARCHAR(50),
  muslim_voters INT,
  registered INT,
  vote_2024 INT,
  vote_2024_pct DECIMAL(5,4),
  political_donors INT,
  political_activists INT
);

-- Congressional district details
CREATE TABLE voter_impact_districts (
  cd_code VARCHAR(10) PRIMARY KEY,
  state_code VARCHAR(2),
  district_num INT,
  winner VARCHAR(100),
  winner_party VARCHAR(20),
  winner_votes INT,
  runner_up VARCHAR(100),
  runner_up_party VARCHAR(20),
  runner_up_votes INT,
  margin_votes INT,
  margin_pct DECIMAL(8,6),
  muslim_voters INT,
  muslim_registered INT,
  muslim_unregistered INT,
  voted_2024 INT,
  didnt_vote_2024 INT,
  turnout_pct DECIMAL(5,4),
  can_impact BOOLEAN,
  votes_needed INT,
  cost_estimate DECIMAL(12,2)
);
```

### API Endpoints

```
GET /api/admin/voter-impact/states
  → GeoJSON with state geometries + voter data

GET /api/admin/voter-impact/districts
  → GeoJSON with CD geometries + voter data

GET /api/admin/voter-impact/district/:cdCode
  → Full detail for single district
```

### GeoJSON Sources

- States: US Census Bureau TIGER shapefiles (public domain)
- Congressional Districts: census.gov 118th Congress boundaries

## Technical Stack

### Dependencies

```json
{
  "maplibre-gl": "^4.x",
  "react-map-gl": "^7.x",
  "@turf/turf": "^7.x"
}
```

### Map Tiles

- Primary: Stadia Maps Alidade Smooth Dark
- Fallback: MapTiler Dark Matter
- No API key required for low-volume admin usage

### Performance

- GeoJSON files loaded once and cached
- Simplified geometries for zoom <7
- MapLibre native clustering if needed

## Metrics

### Primary (Hero View)

**Impact Potential** - Composite of margin closeness + Muslim voter population + turnout gap

### Toggleable Views

1. Muslim voter population (raw count)
2. Impact potential (default)
3. Untapped voters (didn't vote + unregistered)
4. Composite priority score

## Route & Access

- **Route:** `/admin/voter-impact-map`
- **Auth:** Existing admin role check (no new permissions needed)
- **Mobile:** Sidebar becomes bottom drawer on <1024px screens
