# Muslim Voter Impact Map - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an admin-only interactive map visualization showing Muslim voter distribution and election impact potential across US states and congressional districts.

**Architecture:** MapLibre GL for smooth-zooming map, Supabase for data storage/API, React Query for data fetching, dark theme dashboard aesthetic with right sidebar for region details and comparison mode.

**Tech Stack:** MapLibre GL, react-map-gl, Supabase (PostgreSQL + Edge Functions), TanStack React Query, Tailwind CSS, Vitest

---

## Phase 1: Database & Data Import

### Task 1: Create Database Tables

**Files:**
- Create: `supabase/migrations/20260130120000_create_voter_impact_tables.sql`

**Step 1: Write the migration**

```sql
-- Muslim voter impact data tables
-- State-level aggregates from National_Analysis
CREATE TABLE IF NOT EXISTS voter_impact_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code VARCHAR(2) UNIQUE NOT NULL,
  state_name VARCHAR(50) NOT NULL,
  muslim_voters INT NOT NULL DEFAULT 0,
  households INT NOT NULL DEFAULT 0,
  cell_phones INT NOT NULL DEFAULT 0,
  registered INT NOT NULL DEFAULT 0,
  registered_pct DECIMAL(8,6) NOT NULL DEFAULT 0,
  vote_2024 INT NOT NULL DEFAULT 0,
  vote_2024_pct DECIMAL(8,6) NOT NULL DEFAULT 0,
  vote_2022 INT NOT NULL DEFAULT 0,
  vote_2022_pct DECIMAL(8,6) NOT NULL DEFAULT 0,
  political_donors INT NOT NULL DEFAULT 0,
  political_activists INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Congressional district details from CD_GOTV_ANALYSIS
CREATE TABLE IF NOT EXISTS voter_impact_districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cd_code VARCHAR(10) UNIQUE NOT NULL,  -- e.g., "CA-13"
  state_code VARCHAR(2) NOT NULL REFERENCES voter_impact_states(state_code),
  district_num INT NOT NULL,
  winner VARCHAR(100),
  winner_party VARCHAR(20),
  winner_votes INT,
  runner_up VARCHAR(100),
  runner_up_party VARCHAR(20),
  runner_up_votes INT,
  margin_votes INT,
  margin_pct DECIMAL(10,8),
  total_votes INT,
  muslim_voters INT NOT NULL DEFAULT 0,
  muslim_registered INT NOT NULL DEFAULT 0,
  muslim_unregistered INT NOT NULL DEFAULT 0,
  voted_2024 INT NOT NULL DEFAULT 0,
  didnt_vote_2024 INT NOT NULL DEFAULT 0,
  turnout_pct DECIMAL(8,6) NOT NULL DEFAULT 0,
  can_impact BOOLEAN NOT NULL DEFAULT FALSE,
  votes_needed INT,
  cost_estimate DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_voter_impact_districts_state ON voter_impact_districts(state_code);
CREATE INDEX idx_voter_impact_districts_can_impact ON voter_impact_districts(can_impact);
CREATE INDEX idx_voter_impact_districts_margin ON voter_impact_districts(margin_pct);

-- Enable RLS
ALTER TABLE voter_impact_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE voter_impact_districts ENABLE ROW LEVEL SECURITY;

-- Admin-only read policy (users with admin role can read)
CREATE POLICY "Admin users can read voter_impact_states"
  ON voter_impact_states FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM client_user_roles cur
      JOIN client_roles cr ON cur.role_id = cr.id
      WHERE cur.user_id = auth.uid()
      AND cr.name = 'admin'
    )
  );

CREATE POLICY "Admin users can read voter_impact_districts"
  ON voter_impact_districts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM client_user_roles cur
      JOIN client_roles cr ON cur.role_id = cr.id
      WHERE cur.user_id = auth.uid()
      AND cr.name = 'admin'
    )
  );
```

**Step 2: Apply the migration**

Run: `npx supabase db push` or `npx supabase migration up`
Expected: Migration applied successfully

**Step 3: Commit**

```bash
git add supabase/migrations/20260130120000_create_voter_impact_tables.sql
git commit -m "feat(db): add voter impact tables for Muslim voter data"
```

---

### Task 2: Create Data Import Script

**Files:**
- Create: `scripts/import-voter-impact-data.ts`

**Step 1: Write the import script**

```typescript
/**
 * Import voter impact data from Excel files into Supabase
 *
 * Usage: npx tsx scripts/import-voter-impact-data.ts
 *
 * Expects files at:
 * - /Users/hussienjaafar/Downloads/CD_GOTV_ANALYSIS (1).xlsx
 * - /Users/hussienjaafar/Downloads/National_Analysis_20251021 (1).xlsx
 */

import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import * as path from 'path';

// Initialize Supabase client with service role for admin operations
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// File paths
const NATIONAL_FILE = '/Users/hussienjaafar/Downloads/National_Analysis_20251021 (1).xlsx';
const CD_FILE = '/Users/hussienjaafar/Downloads/CD_GOTV_ANALYSIS (1).xlsx';

interface NationalRow {
  State: string;
  'Muslim Voters': number;
  Households: number;
  'Cell Phones': number;
  Registered: number;
  'Registered % ': number;
  'Vote 2024 ': number;
  'Vote 2024 %': number;
  'Vote 2022 ': number;
  'Vote 2022 % ': number;
  'Political Donors': number;
  'Political Activists': number;
}

interface CDRow {
  State: string;
  'State Code': string;
  District: number;
  CD_CODE: string;
  WINNER: string;
  Party: string;
  Votes: number;
  'Runner-Up': string;
  'Runner-Up Party': string;
  'Runner-Up Votes': number;
  'Margin (Votes)': number;
  'Margin (%)': number;
  'Total Votes': number;
  MUSLIM: string | number;
  'MUS-REG': string | number;
  'MUS-UNREG': string | number;
  MUS_VOTED24: string | number;
  "MUS_DIDN'TVOTE24": string | number;
  NEWREG_TURNOUT: string | number;
  ' CAN IMPACT': string;
  'ADD MUSLIM VOTES NEEDED': number;
  'COST (~ $70 PER VOTE)': number;
}

function parseNumber(val: string | number | undefined): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return val;
  const cleaned = String(val).replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// State name to code mapping
const STATE_CODES: Record<string, string> = {
  'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR',
  'CALIFORNIA': 'CA', 'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE',
  'FLORIDA': 'FL', 'GEORGIA': 'GA', 'HAWAII': 'HI', 'IDAHO': 'ID',
  'ILLINOIS': 'IL', 'INDIANA': 'IN', 'IOWA': 'IA', 'KANSAS': 'KS',
  'KENTUCKY': 'KY', 'LOUISIANA': 'LA', 'MAINE': 'ME', 'MARYLAND': 'MD',
  'MASSACHUSETTS': 'MA', 'MICHIGAN': 'MI', 'MINNESOTA': 'MN', 'MISSISSIPPI': 'MS',
  'MISSOURI': 'MO', 'MONTANA': 'MT', 'NEBRASKA': 'NE', 'NEVADA': 'NV',
  'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ', 'NEW MEXICO': 'NM', 'NEW YORK': 'NY',
  'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', 'OHIO': 'OH', 'OKLAHOMA': 'OK',
  'OREGON': 'OR', 'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
  'SOUTH DAKOTA': 'SD', 'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT',
  'VERMONT': 'VT', 'VIRGINIA': 'VA', 'WASHINGTON': 'WA', 'WEST VIRGINIA': 'WV',
  'WISCONSIN': 'WI', 'WYOMING': 'WY', 'DISTRICT OF COLUMBIA': 'DC',
  'CA': 'CA', 'NY': 'NY', 'TX': 'TX', 'FL': 'FL', 'IL': 'IL', 'PA': 'PA',
  'OH': 'OH', 'GA': 'GA', 'NC': 'NC', 'MI': 'MI', // Handle already-abbreviated
};

function getStateCode(stateName: string): string {
  const upper = stateName.toUpperCase().trim();
  return STATE_CODES[upper] || upper.slice(0, 2);
}

async function importNationalData() {
  console.log('Reading National Analysis data...');
  const workbook = XLSX.readFile(NATIONAL_FILE);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data: NationalRow[] = XLSX.utils.sheet_to_json(sheet);

  console.log(`Found ${data.length} state records`);

  const states = data
    .filter(row => row.State && row.State !== 'NATIONAL')
    .map(row => {
      const stateCode = getStateCode(row.State);
      return {
        state_code: stateCode,
        state_name: row.State,
        muslim_voters: parseNumber(row['Muslim Voters']),
        households: parseNumber(row.Households),
        cell_phones: parseNumber(row['Cell Phones']),
        registered: parseNumber(row.Registered),
        registered_pct: parseNumber(row['Registered % ']),
        vote_2024: parseNumber(row['Vote 2024 ']),
        vote_2024_pct: parseNumber(row['Vote 2024 %']),
        vote_2022: parseNumber(row['Vote 2022 ']),
        vote_2022_pct: parseNumber(row['Vote 2022 % ']),
        political_donors: parseNumber(row['Political Donors']),
        political_activists: parseNumber(row['Political Activists']),
      };
    });

  console.log(`Upserting ${states.length} states...`);

  const { error } = await supabase
    .from('voter_impact_states')
    .upsert(states, { onConflict: 'state_code' });

  if (error) {
    console.error('Error importing states:', error);
    throw error;
  }

  console.log('States imported successfully');
}

async function importDistrictData() {
  console.log('Reading Congressional District data...');
  const workbook = XLSX.readFile(CD_FILE);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data: CDRow[] = XLSX.utils.sheet_to_json(sheet);

  console.log(`Found ${data.length} district records`);

  const districts = data.map(row => {
    const muslimVoters = parseNumber(row.MUSLIM);
    const muslimRegistered = parseNumber(row['MUS-REG']);
    const voted2024 = parseNumber(row.MUS_VOTED24);
    const didntVote2024 = parseNumber(row["MUS_DIDN'TVOTE24"]);
    const turnoutPct = muslimRegistered > 0 ? voted2024 / muslimRegistered : 0;

    return {
      cd_code: row.CD_CODE,
      state_code: row['State Code'],
      district_num: row.District,
      winner: row.WINNER,
      winner_party: row.Party,
      winner_votes: parseNumber(row.Votes),
      runner_up: row['Runner-Up'],
      runner_up_party: row['Runner-Up Party'],
      runner_up_votes: parseNumber(row['Runner-Up Votes']),
      margin_votes: parseNumber(row['Margin (Votes)']),
      margin_pct: parseNumber(row['Margin (%)']),
      total_votes: parseNumber(row['Total Votes']),
      muslim_voters: muslimVoters,
      muslim_registered: muslimRegistered,
      muslim_unregistered: parseNumber(row['MUS-UNREG']),
      voted_2024: voted2024,
      didnt_vote_2024: didntVote2024,
      turnout_pct: turnoutPct,
      can_impact: row[' CAN IMPACT']?.toString().toUpperCase() === 'YES',
      votes_needed: parseNumber(row['ADD MUSLIM VOTES NEEDED']),
      cost_estimate: parseNumber(row['COST (~ $70 PER VOTE)']),
    };
  });

  console.log(`Upserting ${districts.length} districts...`);

  // Batch upsert in chunks of 100
  const chunkSize = 100;
  for (let i = 0; i < districts.length; i += chunkSize) {
    const chunk = districts.slice(i, i + chunkSize);
    const { error } = await supabase
      .from('voter_impact_districts')
      .upsert(chunk, { onConflict: 'cd_code' });

    if (error) {
      console.error(`Error importing districts chunk ${i}:`, error);
      throw error;
    }
    console.log(`Imported districts ${i + 1} to ${Math.min(i + chunkSize, districts.length)}`);
  }

  console.log('Districts imported successfully');
}

async function main() {
  try {
    await importNationalData();
    await importDistrictData();
    console.log('\nData import complete!');
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

main();
```

**Step 2: Install xlsx dependency**

Run: `npm install xlsx`
Expected: Package installed

**Step 3: Run the import**

Run: `SUPABASE_SERVICE_ROLE_KEY=<key> npx tsx scripts/import-voter-impact-data.ts`
Expected: "Data import complete!" with state and district counts

**Step 4: Verify data in Supabase**

Run: `npx supabase db query "SELECT COUNT(*) FROM voter_impact_states; SELECT COUNT(*) FROM voter_impact_districts;"`
Expected: ~48 states, ~436 districts

**Step 5: Commit**

```bash
git add scripts/import-voter-impact-data.ts package.json package-lock.json
git commit -m "feat(scripts): add voter impact data import from Excel"
```

---

## Phase 2: API Layer

### Task 3: Create Query Keys

**Files:**
- Modify: `src/queries/queryKeys.ts`

**Step 1: Add voter impact query keys**

Add to the file:

```typescript
export const voterImpactKeys = {
  all: ['voter-impact'] as const,
  states: () => [...voterImpactKeys.all, 'states'] as const,
  districts: () => [...voterImpactKeys.all, 'districts'] as const,
  districtsByState: (stateCode: string) =>
    [...voterImpactKeys.districts(), stateCode] as const,
  district: (cdCode: string) =>
    [...voterImpactKeys.all, 'district', cdCode] as const,
};
```

**Step 2: Commit**

```bash
git add src/queries/queryKeys.ts
git commit -m "feat(queries): add voter impact query keys"
```

---

### Task 4: Create Data Fetching Hooks

**Files:**
- Create: `src/queries/useVoterImpactQueries.ts`

**Step 1: Write the query hooks**

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { voterImpactKeys } from './queryKeys';

// Types
export interface VoterImpactState {
  id: string;
  state_code: string;
  state_name: string;
  muslim_voters: number;
  households: number;
  cell_phones: number;
  registered: number;
  registered_pct: number;
  vote_2024: number;
  vote_2024_pct: number;
  vote_2022: number;
  vote_2022_pct: number;
  political_donors: number;
  political_activists: number;
}

export interface VoterImpactDistrict {
  id: string;
  cd_code: string;
  state_code: string;
  district_num: number;
  winner: string | null;
  winner_party: string | null;
  winner_votes: number | null;
  runner_up: string | null;
  runner_up_party: string | null;
  runner_up_votes: number | null;
  margin_votes: number | null;
  margin_pct: number | null;
  total_votes: number | null;
  muslim_voters: number;
  muslim_registered: number;
  muslim_unregistered: number;
  voted_2024: number;
  didnt_vote_2024: number;
  turnout_pct: number;
  can_impact: boolean;
  votes_needed: number | null;
  cost_estimate: number | null;
}

// Fetch all states
async function fetchVoterImpactStates(): Promise<VoterImpactState[]> {
  const { data, error } = await supabase
    .from('voter_impact_states')
    .select('*')
    .order('state_name');

  if (error) throw error;
  return data || [];
}

// Fetch all districts
async function fetchVoterImpactDistricts(): Promise<VoterImpactDistrict[]> {
  const { data, error } = await supabase
    .from('voter_impact_districts')
    .select('*')
    .order('cd_code');

  if (error) throw error;
  return data || [];
}

// Fetch districts by state
async function fetchDistrictsByState(stateCode: string): Promise<VoterImpactDistrict[]> {
  const { data, error } = await supabase
    .from('voter_impact_districts')
    .select('*')
    .eq('state_code', stateCode)
    .order('district_num');

  if (error) throw error;
  return data || [];
}

// Fetch single district
async function fetchDistrict(cdCode: string): Promise<VoterImpactDistrict | null> {
  const { data, error } = await supabase
    .from('voter_impact_districts')
    .select('*')
    .eq('cd_code', cdCode)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// Hooks
export function useVoterImpactStates() {
  return useQuery({
    queryKey: voterImpactKeys.states(),
    queryFn: fetchVoterImpactStates,
    staleTime: 10 * 60 * 1000, // 10 minutes - data doesn't change often
  });
}

export function useVoterImpactDistricts() {
  return useQuery({
    queryKey: voterImpactKeys.districts(),
    queryFn: fetchVoterImpactDistricts,
    staleTime: 10 * 60 * 1000,
  });
}

export function useDistrictsByState(stateCode: string | null) {
  return useQuery({
    queryKey: voterImpactKeys.districtsByState(stateCode || ''),
    queryFn: () => fetchDistrictsByState(stateCode!),
    enabled: !!stateCode,
    staleTime: 10 * 60 * 1000,
  });
}

export function useVoterImpactDistrict(cdCode: string | null) {
  return useQuery({
    queryKey: voterImpactKeys.district(cdCode || ''),
    queryFn: () => fetchDistrict(cdCode!),
    enabled: !!cdCode,
    staleTime: 10 * 60 * 1000,
  });
}
```

**Step 2: Export from queries index**

Add to `src/queries/index.ts`:

```typescript
export * from './useVoterImpactQueries';
```

**Step 3: Commit**

```bash
git add src/queries/useVoterImpactQueries.ts src/queries/index.ts
git commit -m "feat(queries): add voter impact data fetching hooks"
```

---

### Task 5: Create GeoJSON Data Files

**Files:**
- Create: `public/geojson/us-states.json`
- Create: `public/geojson/congressional-districts-118.json`

**Step 1: Download US states GeoJSON**

Run:
```bash
mkdir -p public/geojson
curl -o public/geojson/us-states.json "https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json"
```

**Step 2: Download Congressional Districts GeoJSON**

Note: The 118th Congress district boundaries are available from Census Bureau. For this implementation, we'll use a simplified version.

Run:
```bash
curl -o public/geojson/congressional-districts-118.json "https://theunitedstates.io/districts/cds/2022/all.geojson"
```

If the above URL fails, use this alternative approach:

```bash
# Alternative: Download from Census Bureau and simplify
curl -o /tmp/cd118.zip "https://www2.census.gov/geo/tiger/TIGER2023/CD/tl_2023_us_cd118.zip"
unzip /tmp/cd118.zip -d /tmp/cd118
# Convert to GeoJSON using ogr2ogr or mapshaper
npx mapshaper /tmp/cd118/tl_2023_us_cd118.shp -simplify 10% -o format=geojson public/geojson/congressional-districts-118.json
```

**Step 3: Verify GeoJSON files**

Run: `head -100 public/geojson/us-states.json`
Expected: Valid GeoJSON with state features

**Step 4: Commit**

```bash
git add public/geojson/
git commit -m "feat(data): add US states and congressional districts GeoJSON"
```

---

## Phase 3: Map Component

### Task 6: Install MapLibre Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install packages**

Run:
```bash
npm install maplibre-gl react-map-gl @turf/turf
npm install -D @types/mapbox__point-geometry
```

**Step 2: Verify installation**

Run: `npm ls maplibre-gl react-map-gl`
Expected: Packages listed with versions

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(deps): add MapLibre GL and react-map-gl"
```

---

### Task 7: Create Map Types

**Files:**
- Create: `src/types/voter-impact.ts`

**Step 1: Write type definitions**

```typescript
import type { VoterImpactState, VoterImpactDistrict } from '@/queries/useVoterImpactQueries';

export type MetricType = 'impact' | 'population' | 'untapped' | 'turnout';

export type PartyFilter = 'all' | 'democrat' | 'republican' | 'close';
export type ImpactFilter = 'all' | 'high' | 'can-impact' | 'no-impact';
export type PresetFilter = 'none' | 'swing' | 'high-roi' | 'low-turnout' | 'top-population';

export interface MapFilters {
  party: PartyFilter;
  impact: ImpactFilter;
  minVoters: number;
  preset: PresetFilter;
  searchQuery: string;
}

export interface RegionSelection {
  type: 'state' | 'district';
  id: string;
  data: VoterImpactState | VoterImpactDistrict;
}

export interface ComparisonItem {
  type: 'state' | 'district';
  id: string;
  data: VoterImpactState | VoterImpactDistrict;
}

export interface MapViewState {
  longitude: number;
  latitude: number;
  zoom: number;
}

// Impact score calculation
export function calculateImpactScore(district: VoterImpactDistrict): number {
  if (!district.can_impact) return 0;

  // Factors: close margin + high muslim population + low turnout = high impact
  const marginScore = district.margin_pct
    ? Math.max(0, 1 - (district.margin_pct * 10)) // Closer margins score higher
    : 0;

  const populationScore = Math.min(1, district.muslim_voters / 50000); // Normalize to 50k

  const turnoutGap = 1 - district.turnout_pct; // Higher gap = more opportunity

  // Weighted combination
  return (marginScore * 0.4) + (populationScore * 0.3) + (turnoutGap * 0.3);
}

// State aggregate impact score
export function calculateStateImpactScore(
  state: VoterImpactState,
  districts: VoterImpactDistrict[]
): number {
  const stateDistricts = districts.filter(d => d.state_code === state.state_code);
  if (stateDistricts.length === 0) return 0;

  const impactDistricts = stateDistricts.filter(d => d.can_impact);
  const avgScore = impactDistricts.length > 0
    ? impactDistricts.reduce((sum, d) => sum + calculateImpactScore(d), 0) / impactDistricts.length
    : 0;

  return avgScore;
}

// Color scale for impact (red -> yellow -> green)
export function getImpactColor(score: number): string {
  if (score <= 0) return '#374151'; // gray for no impact
  if (score < 0.33) return '#ef4444'; // red
  if (score < 0.66) return '#eab308'; // yellow
  return '#22c55e'; // green
}

// Filter functions
export function applyFilters(
  districts: VoterImpactDistrict[],
  filters: MapFilters
): VoterImpactDistrict[] {
  return districts.filter(d => {
    // Party filter
    if (filters.party === 'democrat' && d.winner_party !== 'DEMOCRAT') return false;
    if (filters.party === 'republican' && d.winner_party !== 'REPUBLICAN') return false;
    if (filters.party === 'close' && d.margin_pct && d.margin_pct > 0.05) return false;

    // Impact filter
    if (filters.impact === 'high' && calculateImpactScore(d) < 0.66) return false;
    if (filters.impact === 'can-impact' && !d.can_impact) return false;
    if (filters.impact === 'no-impact' && d.can_impact) return false;

    // Min voters filter
    if (d.muslim_voters < filters.minVoters) return false;

    // Presets
    if (filters.preset === 'swing' && (d.margin_pct === null || d.margin_pct > 0.02 || !d.can_impact)) return false;
    if (filters.preset === 'high-roi' && (d.cost_estimate === null || d.cost_estimate > 200000)) return false;
    if (filters.preset === 'low-turnout' && (d.turnout_pct > 0.5 || !d.can_impact)) return false;

    // Search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const matchesCd = d.cd_code.toLowerCase().includes(query);
      const matchesState = d.state_code.toLowerCase().includes(query);
      if (!matchesCd && !matchesState) return false;
    }

    return true;
  });
}
```

**Step 2: Commit**

```bash
git add src/types/voter-impact.ts
git commit -m "feat(types): add voter impact map types and utilities"
```

---

### Task 8: Create Impact Map Component

**Files:**
- Create: `src/components/voter-impact/ImpactMap.tsx`

**Step 1: Write the map component**

```typescript
import React, { useCallback, useMemo, useState, useEffect } from 'react';
import Map, { Source, Layer, NavigationControl, type MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { VoterImpactState, VoterImpactDistrict } from '@/queries/useVoterImpactQueries';
import type { MapFilters, MapViewState, MetricType } from '@/types/voter-impact';
import { calculateImpactScore, calculateStateImpactScore, getImpactColor, applyFilters } from '@/types/voter-impact';

const INITIAL_VIEW: MapViewState = {
  longitude: -98.5795,
  latitude: 39.8283,
  zoom: 3.5,
};

// Zoom threshold for showing congressional districts
const CD_ZOOM_THRESHOLD = 5.5;

interface ImpactMapProps {
  states: VoterImpactState[];
  districts: VoterImpactDistrict[];
  filters: MapFilters;
  metric: MetricType;
  selectedRegion: string | null;
  onRegionSelect: (regionId: string | null, type: 'state' | 'district') => void;
  onRegionHover: (regionId: string | null, type: 'state' | 'district') => void;
}

export const ImpactMap: React.FC<ImpactMapProps> = ({
  states,
  districts,
  filters,
  metric,
  selectedRegion,
  onRegionSelect,
  onRegionHover,
}) => {
  const mapRef = React.useRef<MapRef>(null);
  const [viewState, setViewState] = useState<MapViewState>(INITIAL_VIEW);
  const [statesGeoJson, setStatesGeoJson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [districtsGeoJson, setDistrictsGeoJson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);

  // Load GeoJSON files
  useEffect(() => {
    fetch('/geojson/us-states.json')
      .then(res => res.json())
      .then(setStatesGeoJson)
      .catch(console.error);

    fetch('/geojson/congressional-districts-118.json')
      .then(res => res.json())
      .then(setDistrictsGeoJson)
      .catch(console.error);
  }, []);

  // Filter districts
  const filteredDistricts = useMemo(() =>
    applyFilters(districts, filters),
    [districts, filters]
  );

  // Create state-level color mapping
  const stateColors = useMemo(() => {
    const colors: Record<string, string> = {};
    states.forEach(state => {
      const score = calculateStateImpactScore(state, filteredDistricts);
      colors[state.state_code] = getImpactColor(score);
    });
    return colors;
  }, [states, filteredDistricts]);

  // Create district-level color mapping
  const districtColors = useMemo(() => {
    const colors: Record<string, string> = {};
    filteredDistricts.forEach(district => {
      const score = calculateImpactScore(district);
      colors[district.cd_code] = getImpactColor(score);
    });
    return colors;
  }, [filteredDistricts]);

  // Determine if we should show districts based on zoom
  const showDistricts = viewState.zoom >= CD_ZOOM_THRESHOLD;

  // Enrich GeoJSON with color data
  const enrichedStatesGeoJson = useMemo(() => {
    if (!statesGeoJson) return null;
    return {
      ...statesGeoJson,
      features: statesGeoJson.features.map(feature => ({
        ...feature,
        properties: {
          ...feature.properties,
          fillColor: stateColors[feature.properties?.STATE || feature.properties?.STUSPS] || '#374151',
          isFiltered: filteredDistricts.some(d =>
            d.state_code === (feature.properties?.STATE || feature.properties?.STUSPS)
          ),
        },
      })),
    };
  }, [statesGeoJson, stateColors, filteredDistricts]);

  const enrichedDistrictsGeoJson = useMemo(() => {
    if (!districtsGeoJson) return null;
    return {
      ...districtsGeoJson,
      features: districtsGeoJson.features.map(feature => {
        const cdCode = feature.properties?.CD118FP
          ? `${feature.properties.STATEFP}-${feature.properties.CD118FP}`
          : feature.properties?.id;
        return {
          ...feature,
          properties: {
            ...feature.properties,
            cdCode,
            fillColor: districtColors[cdCode] || '#374151',
            isFiltered: cdCode in districtColors,
          },
        };
      }),
    };
  }, [districtsGeoJson, districtColors]);

  // Handle map click
  const handleClick = useCallback((event: maplibregl.MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    if (!feature) {
      onRegionSelect(null, 'state');
      return;
    }

    if (showDistricts && feature.layer?.id === 'districts-fill') {
      const cdCode = feature.properties?.cdCode;
      onRegionSelect(cdCode, 'district');
    } else if (feature.layer?.id === 'states-fill') {
      const stateCode = feature.properties?.STATE || feature.properties?.STUSPS;
      onRegionSelect(stateCode, 'state');

      // Zoom to state
      if (mapRef.current && stateCode) {
        // Find state center and zoom
        const state = states.find(s => s.state_code === stateCode);
        if (state) {
          mapRef.current.flyTo({
            zoom: 6,
            duration: 1500,
          });
        }
      }
    }
  }, [showDistricts, onRegionSelect, states]);

  // Handle hover
  const handleMouseMove = useCallback((event: maplibregl.MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    if (!feature) {
      setHoveredRegion(null);
      onRegionHover(null, 'state');
      return;
    }

    if (showDistricts && feature.layer?.id === 'districts-fill') {
      const cdCode = feature.properties?.cdCode;
      setHoveredRegion(cdCode);
      onRegionHover(cdCode, 'district');
    } else if (feature.layer?.id === 'states-fill') {
      const stateCode = feature.properties?.STATE || feature.properties?.STUSPS;
      setHoveredRegion(stateCode);
      onRegionHover(stateCode, 'state');
    }
  }, [showDistricts, onRegionHover]);

  const handleMouseLeave = useCallback(() => {
    setHoveredRegion(null);
    onRegionHover(null, 'state');
  }, [onRegionHover]);

  return (
    <Map
      ref={mapRef}
      {...viewState}
      onMove={evt => setViewState(evt.viewState)}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      interactiveLayerIds={['states-fill', 'districts-fill']}
      style={{ width: '100%', height: '100%' }}
      mapStyle="https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json"
      attributionControl={false}
    >
      <NavigationControl position="top-left" />

      {/* States layer */}
      {enrichedStatesGeoJson && (
        <Source id="states" type="geojson" data={enrichedStatesGeoJson}>
          <Layer
            id="states-fill"
            type="fill"
            paint={{
              'fill-color': ['get', 'fillColor'],
              'fill-opacity': [
                'case',
                ['==', ['get', 'isFiltered'], false], 0.2,
                showDistricts ? 0.1 : 0.7,
              ],
            }}
          />
          <Layer
            id="states-outline"
            type="line"
            paint={{
              'line-color': [
                'case',
                ['==', ['get', 'STATE'], selectedRegion], '#3b82f6',
                ['==', ['get', 'STUSPS'], selectedRegion], '#3b82f6',
                ['==', ['get', 'STATE'], hoveredRegion], '#60a5fa',
                ['==', ['get', 'STUSPS'], hoveredRegion], '#60a5fa',
                '#1e2a45',
              ],
              'line-width': [
                'case',
                ['==', ['get', 'STATE'], selectedRegion], 3,
                ['==', ['get', 'STUSPS'], selectedRegion], 3,
                ['==', ['get', 'STATE'], hoveredRegion], 2,
                ['==', ['get', 'STUSPS'], hoveredRegion], 2,
                1,
              ],
            }}
          />
        </Source>
      )}

      {/* Districts layer - only visible when zoomed in */}
      {showDistricts && enrichedDistrictsGeoJson && (
        <Source id="districts" type="geojson" data={enrichedDistrictsGeoJson}>
          <Layer
            id="districts-fill"
            type="fill"
            paint={{
              'fill-color': ['get', 'fillColor'],
              'fill-opacity': [
                'case',
                ['==', ['get', 'isFiltered'], false], 0.1,
                0.7,
              ],
            }}
          />
          <Layer
            id="districts-outline"
            type="line"
            paint={{
              'line-color': [
                'case',
                ['==', ['get', 'cdCode'], selectedRegion], '#3b82f6',
                ['==', ['get', 'cdCode'], hoveredRegion], '#60a5fa',
                '#1e2a45',
              ],
              'line-width': [
                'case',
                ['==', ['get', 'cdCode'], selectedRegion], 3,
                ['==', ['get', 'cdCode'], hoveredRegion], 2,
                0.5,
              ],
            }}
          />
        </Source>
      )}
    </Map>
  );
};

export default ImpactMap;
```

**Step 2: Commit**

```bash
git add src/components/voter-impact/ImpactMap.tsx
git commit -m "feat(map): add MapLibre-based ImpactMap component"
```

---

### Task 9: Create Map Controls Component

**Files:**
- Create: `src/components/voter-impact/MapControls.tsx`

**Step 1: Write the controls component**

```typescript
import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Slider } from '@/components/ui/slider';
import { Search, Filter, Zap, X } from 'lucide-react';
import type { MapFilters, PartyFilter, ImpactFilter, PresetFilter } from '@/types/voter-impact';

interface MapControlsProps {
  filters: MapFilters;
  onFiltersChange: (filters: MapFilters) => void;
  maxVoters: number;
}

export const MapControls: React.FC<MapControlsProps> = ({
  filters,
  onFiltersChange,
  maxVoters,
}) => {
  const updateFilter = <K extends keyof MapFilters>(key: K, value: MapFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      party: 'all',
      impact: 'all',
      minVoters: 0,
      preset: 'none',
      searchQuery: '',
    });
  };

  const hasActiveFilters =
    filters.party !== 'all' ||
    filters.impact !== 'all' ||
    filters.minVoters > 0 ||
    filters.preset !== 'none' ||
    filters.searchQuery !== '';

  return (
    <div className="flex items-center gap-3 p-4 bg-[#141b2d] border-b border-[#1e2a45]">
      {/* Search */}
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748b]" />
        <Input
          placeholder="Search state or district..."
          value={filters.searchQuery}
          onChange={e => updateFilter('searchQuery', e.target.value)}
          className="pl-9 bg-[#0a0f1a] border-[#1e2a45] text-[#e2e8f0] placeholder:text-[#64748b]"
        />
      </div>

      {/* Party Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="bg-[#0a0f1a] border-[#1e2a45] text-[#e2e8f0]">
            <Filter className="h-4 w-4 mr-2" />
            Party
            {filters.party !== 'all' && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-[#3b82f6] rounded">
                {filters.party}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-[#141b2d] border-[#1e2a45]">
          <DropdownMenuRadioGroup
            value={filters.party}
            onValueChange={v => updateFilter('party', v as PartyFilter)}
          >
            <DropdownMenuRadioItem value="all" className="text-[#e2e8f0]">
              All Parties
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="democrat" className="text-[#e2e8f0]">
              Democrat Held
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="republican" className="text-[#e2e8f0]">
              Republican Held
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="close" className="text-[#e2e8f0]">
              Close Races (&lt;5%)
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Impact Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="bg-[#0a0f1a] border-[#1e2a45] text-[#e2e8f0]">
            Impact
            {filters.impact !== 'all' && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-[#22c55e] rounded">
                {filters.impact}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-[#141b2d] border-[#1e2a45]">
          <DropdownMenuRadioGroup
            value={filters.impact}
            onValueChange={v => updateFilter('impact', v as ImpactFilter)}
          >
            <DropdownMenuRadioItem value="all" className="text-[#e2e8f0]">
              All Districts
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="high" className="text-[#e2e8f0]">
              High Impact
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="can-impact" className="text-[#e2e8f0]">
              Can Impact
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="no-impact" className="text-[#e2e8f0]">
              No Impact
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Voter Threshold Slider */}
      <div className="flex items-center gap-2 min-w-[200px]">
        <span className="text-xs text-[#64748b] whitespace-nowrap">
          {filters.minVoters.toLocaleString()}+ voters
        </span>
        <Slider
          value={[filters.minVoters]}
          onValueChange={([v]) => updateFilter('minVoters', v)}
          max={maxVoters}
          step={1000}
          className="w-24"
        />
      </div>

      {/* Presets */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="bg-[#0a0f1a] border-[#1e2a45] text-[#e2e8f0]">
            <Zap className="h-4 w-4 mr-2" />
            Presets
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-[#141b2d] border-[#1e2a45]">
          <DropdownMenuRadioGroup
            value={filters.preset}
            onValueChange={v => updateFilter('preset', v as PresetFilter)}
          >
            <DropdownMenuRadioItem value="none" className="text-[#e2e8f0]">
              None
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="swing" className="text-[#e2e8f0]">
              ★ Swing Districts
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="high-roi" className="text-[#e2e8f0]">
              ★ High ROI Targets
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="low-turnout" className="text-[#e2e8f0]">
              ★ Low Turnout Opportunities
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="top-population" className="text-[#e2e8f0]">
              ★ Top 20 by Population
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="text-[#64748b] hover:text-[#e2e8f0]"
        >
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
};

export default MapControls;
```

**Step 2: Commit**

```bash
git add src/components/voter-impact/MapControls.tsx
git commit -m "feat(map): add MapControls with filters and presets"
```

---

### Task 10: Create Region Sidebar Component

**Files:**
- Create: `src/components/voter-impact/RegionSidebar.tsx`

**Step 1: Write the sidebar component**

```typescript
import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Plus, X } from 'lucide-react';
import type { VoterImpactState, VoterImpactDistrict } from '@/queries/useVoterImpactQueries';
import { calculateImpactScore } from '@/types/voter-impact';

interface RegionSidebarProps {
  selectedRegion: {
    type: 'state' | 'district';
    data: VoterImpactState | VoterImpactDistrict;
  } | null;
  comparisonItems: Array<{
    type: 'state' | 'district';
    data: VoterImpactState | VoterImpactDistrict;
  }>;
  onAddToCompare: () => void;
  onRemoveFromCompare: (id: string) => void;
  onClearComparison: () => void;
}

const formatNumber = (n: number) => n.toLocaleString();
const formatPercent = (n: number) => `${(n * 100).toFixed(1)}%`;
const formatCurrency = (n: number) => `$${n.toLocaleString()}`;

function isDistrict(data: VoterImpactState | VoterImpactDistrict): data is VoterImpactDistrict {
  return 'cd_code' in data;
}

const ImpactBadge: React.FC<{ canImpact: boolean; score: number }> = ({ canImpact, score }) => {
  if (!canImpact) {
    return <Badge variant="secondary" className="bg-[#374151] text-[#9ca3af]">NO IMPACT</Badge>;
  }
  if (score >= 0.66) {
    return <Badge className="bg-[#22c55e] text-white">HIGH IMPACT</Badge>;
  }
  if (score >= 0.33) {
    return <Badge className="bg-[#eab308] text-black">MEDIUM IMPACT</Badge>;
  }
  return <Badge className="bg-[#ef4444] text-white">LOW IMPACT</Badge>;
};

const DistrictDetails: React.FC<{ district: VoterImpactDistrict }> = ({ district }) => {
  const impactScore = calculateImpactScore(district);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#e2e8f0]">{district.cd_code}</h3>
          <ImpactBadge canImpact={district.can_impact} score={impactScore} />
        </div>
      </div>

      {/* Muslim Voters */}
      <Card className="p-3 bg-[#0a0f1a] border-[#1e2a45]">
        <div className="text-xs text-[#64748b] uppercase tracking-wide mb-1">Muslim Voters</div>
        <div className="text-2xl font-bold text-[#e2e8f0] tabular-nums">
          {formatNumber(district.muslim_voters)}
        </div>
        <div className="mt-2 space-y-1 text-sm">
          <div className="flex justify-between text-[#64748b]">
            <span>Registered</span>
            <span className="text-[#e2e8f0]">{formatNumber(district.muslim_registered)}</span>
          </div>
          <div className="flex justify-between text-[#64748b]">
            <span>Unregistered</span>
            <span className="text-[#e2e8f0]">{formatNumber(district.muslim_unregistered)}</span>
          </div>
        </div>
      </Card>

      {/* 2024 Turnout */}
      <Card className="p-3 bg-[#0a0f1a] border-[#1e2a45]">
        <div className="text-xs text-[#64748b] uppercase tracking-wide mb-1">2024 Turnout</div>
        <div className="flex items-end gap-2">
          <div className="text-2xl font-bold text-[#e2e8f0] tabular-nums">
            {formatPercent(district.turnout_pct)}
          </div>
        </div>
        <Progress
          value={district.turnout_pct * 100}
          className="mt-2 h-2 bg-[#1e2a45]"
        />
        <div className="mt-2 space-y-1 text-sm">
          <div className="flex justify-between text-[#64748b]">
            <span>Voted</span>
            <span className="text-[#22c55e]">{formatNumber(district.voted_2024)}</span>
          </div>
          <div className="flex justify-between text-[#64748b]">
            <span>Didn't vote</span>
            <span className="text-[#ef4444]">{formatNumber(district.didnt_vote_2024)}</span>
          </div>
        </div>
      </Card>

      {/* Election Margin */}
      <Card className="p-3 bg-[#0a0f1a] border-[#1e2a45]">
        <div className="text-xs text-[#64748b] uppercase tracking-wide mb-1">Election Margin</div>
        <div className="text-2xl font-bold text-[#e2e8f0] tabular-nums">
          {district.margin_votes ? formatNumber(district.margin_votes) : 'N/A'} votes
        </div>
        <div className="text-sm text-[#64748b]">
          {district.margin_pct ? formatPercent(district.margin_pct) : ''}
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              district.winner_party === 'DEMOCRAT' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {district.winner_party?.[0]}
            </span>
            <span className="text-sm text-[#e2e8f0]">{district.winner}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              district.runner_up_party === 'DEMOCRAT' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {district.runner_up_party?.[0]}
            </span>
            <span className="text-sm text-[#64748b]">{district.runner_up}</span>
          </div>
        </div>
      </Card>

      {/* Mobilization */}
      {district.can_impact && (
        <Card className="p-3 bg-[#0a0f1a] border-[#1e2a45]">
          <div className="text-xs text-[#64748b] uppercase tracking-wide mb-1">Mobilization</div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-[#64748b]">Votes needed</span>
              <span className="text-[#e2e8f0] font-semibold tabular-nums">
                {district.votes_needed ? formatNumber(district.votes_needed) : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748b]">Est. cost</span>
              <span className="text-[#e2e8f0] font-semibold tabular-nums">
                {district.cost_estimate ? formatCurrency(district.cost_estimate) : 'N/A'}
              </span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

const StateDetails: React.FC<{ state: VoterImpactState }> = ({ state }) => {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-2">
        <h3 className="text-lg font-bold text-[#e2e8f0]">{state.state_name}</h3>
        <div className="text-sm text-[#64748b]">{state.state_code}</div>
      </div>

      {/* Muslim Voters */}
      <Card className="p-3 bg-[#0a0f1a] border-[#1e2a45]">
        <div className="text-xs text-[#64748b] uppercase tracking-wide mb-1">Muslim Voters</div>
        <div className="text-2xl font-bold text-[#e2e8f0] tabular-nums">
          {formatNumber(state.muslim_voters)}
        </div>
        <div className="mt-2 space-y-1 text-sm">
          <div className="flex justify-between text-[#64748b]">
            <span>Registered</span>
            <span className="text-[#e2e8f0]">{formatNumber(state.registered)}</span>
          </div>
          <div className="flex justify-between text-[#64748b]">
            <span>Registration Rate</span>
            <span className="text-[#e2e8f0]">{formatPercent(state.registered_pct)}</span>
          </div>
        </div>
      </Card>

      {/* Voting */}
      <Card className="p-3 bg-[#0a0f1a] border-[#1e2a45]">
        <div className="text-xs text-[#64748b] uppercase tracking-wide mb-1">Voting History</div>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-[#64748b]">2024 Turnout</span>
            <span className="text-[#e2e8f0] font-semibold">{formatPercent(state.vote_2024_pct)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#64748b]">2022 Turnout</span>
            <span className="text-[#e2e8f0] font-semibold">{formatPercent(state.vote_2022_pct)}</span>
          </div>
        </div>
      </Card>

      {/* Political Engagement */}
      <Card className="p-3 bg-[#0a0f1a] border-[#1e2a45]">
        <div className="text-xs text-[#64748b] uppercase tracking-wide mb-1">Political Engagement</div>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-[#64748b]">Donors</span>
            <span className="text-[#e2e8f0] font-semibold tabular-nums">
              {formatNumber(state.political_donors)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#64748b]">Activists</span>
            <span className="text-[#e2e8f0] font-semibold tabular-nums">
              {formatNumber(state.political_activists)}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
};

export const RegionSidebar: React.FC<RegionSidebarProps> = ({
  selectedRegion,
  comparisonItems,
  onAddToCompare,
  onRemoveFromCompare,
  onClearComparison,
}) => {
  const isInComparison = selectedRegion && comparisonItems.some(
    item => isDistrict(item.data) && isDistrict(selectedRegion.data)
      ? (item.data as VoterImpactDistrict).cd_code === (selectedRegion.data as VoterImpactDistrict).cd_code
      : (item.data as VoterImpactState).state_code === (selectedRegion.data as VoterImpactState).state_code
  );

  return (
    <div className="w-80 bg-[#141b2d] border-l border-[#1e2a45] overflow-y-auto">
      <div className="p-4">
        {/* Comparison Mode Header */}
        {comparisonItems.length > 0 && (
          <div className="mb-4 p-3 bg-[#0a0f1a] rounded-lg border border-[#1e2a45]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[#e2e8f0]">
                Comparing {comparisonItems.length} regions
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearComparison}
                className="text-[#64748b] hover:text-[#e2e8f0] h-6 px-2"
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </div>
            <div className="space-y-1">
              {comparisonItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-[#e2e8f0]">
                    {isDistrict(item.data) ? item.data.cd_code : item.data.state_code}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveFromCompare(
                      isDistrict(item.data) ? item.data.cd_code : item.data.state_code
                    )}
                    className="text-[#64748b] hover:text-[#ef4444] h-5 w-5 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selected Region Details */}
        {selectedRegion ? (
          <>
            {isDistrict(selectedRegion.data) ? (
              <DistrictDetails district={selectedRegion.data} />
            ) : (
              <StateDetails state={selectedRegion.data} />
            )}

            {/* Add to Compare Button */}
            {!isInComparison && comparisonItems.length < 4 && (
              <Button
                onClick={onAddToCompare}
                className="w-full mt-4 bg-[#3b82f6] hover:bg-[#2563eb] text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add to Compare
              </Button>
            )}
          </>
        ) : (
          <div className="text-center text-[#64748b] py-8">
            <p>Select a region on the map</p>
            <p className="text-sm mt-1">Click a state or zoom in to see districts</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RegionSidebar;
```

**Step 2: Commit**

```bash
git add src/components/voter-impact/RegionSidebar.tsx
git commit -m "feat(map): add RegionSidebar with district/state details"
```

---

### Task 11: Create Map Legend Component

**Files:**
- Create: `src/components/voter-impact/MapLegend.tsx`

**Step 1: Write the legend component**

```typescript
import React from 'react';

export const MapLegend: React.FC = () => {
  return (
    <div className="absolute bottom-4 left-4 bg-[#141b2d]/90 backdrop-blur-sm rounded-lg border border-[#1e2a45] p-3">
      <div className="text-xs text-[#64748b] uppercase tracking-wide mb-2">Impact Potential</div>
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-1">
          <div className="w-6 h-3 rounded-sm bg-[#ef4444]" />
          <span className="text-xs text-[#64748b]">Low</span>
        </div>
        <div className="flex items-center gap-1 ml-2">
          <div className="w-6 h-3 rounded-sm bg-[#eab308]" />
          <span className="text-xs text-[#64748b]">Medium</span>
        </div>
        <div className="flex items-center gap-1 ml-2">
          <div className="w-6 h-3 rounded-sm bg-[#22c55e]" />
          <span className="text-xs text-[#64748b]">High</span>
        </div>
        <div className="flex items-center gap-1 ml-2">
          <div className="w-6 h-3 rounded-sm bg-[#374151]" />
          <span className="text-xs text-[#64748b]">None</span>
        </div>
      </div>
    </div>
  );
};

export default MapLegend;
```

**Step 2: Commit**

```bash
git add src/components/voter-impact/MapLegend.tsx
git commit -m "feat(map): add MapLegend component"
```

---

### Task 12: Create Metric Toggle Component

**Files:**
- Create: `src/components/voter-impact/MetricToggle.tsx`

**Step 1: Write the metric toggle**

```typescript
import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import type { MetricType } from '@/types/voter-impact';

interface MetricToggleProps {
  value: MetricType;
  onChange: (value: MetricType) => void;
}

const METRIC_LABELS: Record<MetricType, string> = {
  impact: 'Impact Potential',
  population: 'Muslim Voters',
  untapped: 'Untapped Voters',
  turnout: 'Turnout Rate',
};

export const MetricToggle: React.FC<MetricToggleProps> = ({ value, onChange }) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="bg-[#0a0f1a] border-[#1e2a45] text-[#e2e8f0]">
          {METRIC_LABELS[value]}
          <ChevronDown className="h-4 w-4 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-[#141b2d] border-[#1e2a45]">
        <DropdownMenuRadioGroup value={value} onValueChange={v => onChange(v as MetricType)}>
          <DropdownMenuRadioItem value="impact" className="text-[#e2e8f0]">
            Impact Potential
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="population" className="text-[#e2e8f0]">
            Muslim Voters
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="untapped" className="text-[#e2e8f0]">
            Untapped Voters
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="turnout" className="text-[#e2e8f0]">
            Turnout Rate
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default MetricToggle;
```

**Step 2: Commit**

```bash
git add src/components/voter-impact/MetricToggle.tsx
git commit -m "feat(map): add MetricToggle component"
```

---

## Phase 4: Main Page

### Task 13: Create Voter Impact Map Page

**Files:**
- Create: `src/pages/admin/VoterImpactMap.tsx`

**Step 1: Write the main page component**

```typescript
import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useVoterImpactStates, useVoterImpactDistricts } from '@/queries/useVoterImpactQueries';
import type { VoterImpactState, VoterImpactDistrict } from '@/queries/useVoterImpactQueries';
import type { MapFilters, MetricType, ComparisonItem } from '@/types/voter-impact';
import { ImpactMap } from '@/components/voter-impact/ImpactMap';
import { MapControls } from '@/components/voter-impact/MapControls';
import { RegionSidebar } from '@/components/voter-impact/RegionSidebar';
import { MapLegend } from '@/components/voter-impact/MapLegend';
import { MetricToggle } from '@/components/voter-impact/MetricToggle';

const DEFAULT_FILTERS: MapFilters = {
  party: 'all',
  impact: 'all',
  minVoters: 0,
  preset: 'none',
  searchQuery: '',
};

export const VoterImpactMap: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();

  // Data
  const { data: states = [], isLoading: statesLoading } = useVoterImpactStates();
  const { data: districts = [], isLoading: districtsLoading } = useVoterImpactDistricts();

  // UI State
  const [filters, setFilters] = useState<MapFilters>(DEFAULT_FILTERS);
  const [metric, setMetric] = useState<MetricType>('impact');
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [selectedRegionType, setSelectedRegionType] = useState<'state' | 'district'>('state');
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  const [comparisonItems, setComparisonItems] = useState<ComparisonItem[]>([]);

  // Computed
  const maxVoters = useMemo(() =>
    Math.max(...districts.map(d => d.muslim_voters), 0),
    [districts]
  );

  const selectedRegion = useMemo(() => {
    if (!selectedRegionId) return null;

    if (selectedRegionType === 'district') {
      const district = districts.find(d => d.cd_code === selectedRegionId);
      if (district) return { type: 'district' as const, data: district };
    } else {
      const state = states.find(s => s.state_code === selectedRegionId);
      if (state) return { type: 'state' as const, data: state };
    }
    return null;
  }, [selectedRegionId, selectedRegionType, states, districts]);

  // Handlers
  const handleRegionSelect = useCallback((regionId: string | null, type: 'state' | 'district') => {
    setSelectedRegionId(regionId);
    setSelectedRegionType(type);
  }, []);

  const handleRegionHover = useCallback((regionId: string | null, type: 'state' | 'district') => {
    setHoveredRegionId(regionId);
  }, []);

  const handleAddToCompare = useCallback(() => {
    if (!selectedRegion || comparisonItems.length >= 4) return;

    const id = selectedRegion.type === 'district'
      ? (selectedRegion.data as VoterImpactDistrict).cd_code
      : (selectedRegion.data as VoterImpactState).state_code;

    const alreadyInComparison = comparisonItems.some(item => {
      const itemId = item.type === 'district'
        ? (item.data as VoterImpactDistrict).cd_code
        : (item.data as VoterImpactState).state_code;
      return itemId === id;
    });

    if (!alreadyInComparison) {
      setComparisonItems([...comparisonItems, selectedRegion]);
    }
  }, [selectedRegion, comparisonItems]);

  const handleRemoveFromCompare = useCallback((id: string) => {
    setComparisonItems(comparisonItems.filter(item => {
      const itemId = item.type === 'district'
        ? (item.data as VoterImpactDistrict).cd_code
        : (item.data as VoterImpactState).state_code;
      return itemId !== id;
    }));
  }, [comparisonItems]);

  const handleClearComparison = useCallback(() => {
    setComparisonItems([]);
  }, []);

  // Loading & Auth states
  if (isAdminLoading) {
    return (
      <div className="h-screen bg-[#0a0f1a] flex items-center justify-center">
        <div className="text-[#64748b]">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="h-screen bg-[#0a0f1a] flex items-center justify-center">
        <div className="text-center">
          <div className="text-[#ef4444] text-xl mb-2">Access Denied</div>
          <div className="text-[#64748b]">You must be an admin to view this page.</div>
          <Button
            onClick={() => navigate('/')}
            className="mt-4"
          >
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  const isLoading = statesLoading || districtsLoading;

  return (
    <div className="h-screen bg-[#0a0f1a] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#141b2d] border-b border-[#1e2a45]">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin')}
            className="text-[#64748b] hover:text-[#e2e8f0]"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin
          </Button>
          <h1 className="text-xl font-bold text-[#e2e8f0]">
            MUSLIM VOTER IMPACT MAP
          </h1>
        </div>
        <MetricToggle value={metric} onChange={setMetric} />
      </div>

      {/* Controls */}
      <MapControls
        filters={filters}
        onFiltersChange={setFilters}
        maxVoters={maxVoters}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0a0f1a]">
              <div className="text-[#64748b]">Loading map data...</div>
            </div>
          ) : (
            <>
              <ImpactMap
                states={states}
                districts={districts}
                filters={filters}
                metric={metric}
                selectedRegion={selectedRegionId}
                onRegionSelect={handleRegionSelect}
                onRegionHover={handleRegionHover}
              />
              <MapLegend />
            </>
          )}
        </div>

        {/* Sidebar */}
        <RegionSidebar
          selectedRegion={selectedRegion}
          comparisonItems={comparisonItems}
          onAddToCompare={handleAddToCompare}
          onRemoveFromCompare={handleRemoveFromCompare}
          onClearComparison={handleClearComparison}
        />
      </div>
    </div>
  );
};

export default VoterImpactMap;
```

**Step 2: Commit**

```bash
git add src/pages/admin/VoterImpactMap.tsx
git commit -m "feat(page): add VoterImpactMap admin page"
```

---

### Task 14: Add Route

**Files:**
- Modify: `src/App.tsx` (or wherever routes are defined)

**Step 1: Find the router configuration**

Look for route definitions in `src/App.tsx` or `src/routes.tsx`

**Step 2: Add the new route**

Add to the admin routes section:

```typescript
import { VoterImpactMap } from '@/pages/admin/VoterImpactMap';

// In the routes array, add:
{
  path: '/admin/voter-impact-map',
  element: <VoterImpactMap />,
}
```

**Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(routes): add voter impact map route"
```

---

### Task 15: Create Component Index

**Files:**
- Create: `src/components/voter-impact/index.ts`

**Step 1: Create the index file**

```typescript
export { ImpactMap } from './ImpactMap';
export { MapControls } from './MapControls';
export { RegionSidebar } from './RegionSidebar';
export { MapLegend } from './MapLegend';
export { MetricToggle } from './MetricToggle';
```

**Step 2: Commit**

```bash
git add src/components/voter-impact/index.ts
git commit -m "feat(components): add voter-impact component index"
```

---

## Phase 5: Testing

### Task 16: Create Test Setup for Map Components

**Files:**
- Create: `src/__tests__/voter-impact/setup.ts`

**Step 1: Write test setup**

```typescript
import { vi } from 'vitest';

// Mock MapLibre GL
vi.mock('maplibre-gl', () => ({
  Map: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    remove: vi.fn(),
    getCanvas: vi.fn(() => ({ style: {} })),
    getContainer: vi.fn(() => document.createElement('div')),
    setCenter: vi.fn(),
    setZoom: vi.fn(),
    flyTo: vi.fn(),
    addSource: vi.fn(),
    addLayer: vi.fn(),
    removeSource: vi.fn(),
    removeLayer: vi.fn(),
  })),
  NavigationControl: vi.fn(),
}));

// Mock react-map-gl
vi.mock('react-map-gl/maplibre', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  Map: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  Source: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Layer: () => null,
  NavigationControl: () => null,
}));

// Mock fetch for GeoJSON
global.fetch = vi.fn((url: string) => {
  if (url.includes('us-states.json')) {
    return Promise.resolve({
      json: () => Promise.resolve({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { STATE: 'CA', name: 'California' },
            geometry: { type: 'Polygon', coordinates: [[[-120, 35], [-120, 40], [-115, 40], [-115, 35], [-120, 35]]] },
          },
        ],
      }),
    });
  }
  if (url.includes('congressional-districts')) {
    return Promise.resolve({
      json: () => Promise.resolve({
        type: 'FeatureCollection',
        features: [],
      }),
    });
  }
  return Promise.reject(new Error('Unknown URL'));
}) as any;
```

**Step 2: Commit**

```bash
git add src/__tests__/voter-impact/setup.ts
git commit -m "test(voter-impact): add test setup with MapLibre mocks"
```

---

### Task 17: Write Type Utility Tests

**Files:**
- Create: `src/__tests__/voter-impact/types.test.ts`

**Step 1: Write tests for utility functions**

```typescript
import { describe, it, expect } from 'vitest';
import {
  calculateImpactScore,
  getImpactColor,
  applyFilters,
} from '@/types/voter-impact';
import type { VoterImpactDistrict, MapFilters } from '@/types/voter-impact';

const mockDistrict: VoterImpactDistrict = {
  id: '1',
  cd_code: 'CA-13',
  state_code: 'CA',
  district_num: 13,
  winner: 'ADAM GRAY',
  winner_party: 'DEMOCRAT',
  winner_votes: 105554,
  runner_up: 'JOHN DUARTE',
  runner_up_party: 'REPUBLICAN',
  runner_up_votes: 105367,
  margin_votes: 187,
  margin_pct: 0.000887,
  total_votes: 210921,
  muslim_voters: 3980,
  muslim_registered: 3530,
  muslim_unregistered: 450,
  voted_2024: 1871,
  didnt_vote_2024: 2109,
  turnout_pct: 0.53,
  can_impact: true,
  votes_needed: 2372,
  cost_estimate: 166040,
};

describe('calculateImpactScore', () => {
  it('returns 0 for districts that cannot impact', () => {
    const district = { ...mockDistrict, can_impact: false };
    expect(calculateImpactScore(district)).toBe(0);
  });

  it('returns higher score for close margins', () => {
    const closeMargin = { ...mockDistrict, margin_pct: 0.001 };
    const wideMargin = { ...mockDistrict, margin_pct: 0.1 };

    expect(calculateImpactScore(closeMargin)).toBeGreaterThan(
      calculateImpactScore(wideMargin)
    );
  });

  it('returns score between 0 and 1', () => {
    const score = calculateImpactScore(mockDistrict);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe('getImpactColor', () => {
  it('returns gray for no impact (0)', () => {
    expect(getImpactColor(0)).toBe('#374151');
  });

  it('returns red for low impact', () => {
    expect(getImpactColor(0.2)).toBe('#ef4444');
  });

  it('returns yellow for medium impact', () => {
    expect(getImpactColor(0.5)).toBe('#eab308');
  });

  it('returns green for high impact', () => {
    expect(getImpactColor(0.8)).toBe('#22c55e');
  });
});

describe('applyFilters', () => {
  const districts: VoterImpactDistrict[] = [
    mockDistrict,
    { ...mockDistrict, cd_code: 'CA-45', winner_party: 'REPUBLICAN', can_impact: false },
    { ...mockDistrict, cd_code: 'NY-09', muslim_voters: 100 },
  ];

  const defaultFilters: MapFilters = {
    party: 'all',
    impact: 'all',
    minVoters: 0,
    preset: 'none',
    searchQuery: '',
  };

  it('returns all districts with default filters', () => {
    const result = applyFilters(districts, defaultFilters);
    expect(result).toHaveLength(3);
  });

  it('filters by party', () => {
    const result = applyFilters(districts, { ...defaultFilters, party: 'democrat' });
    expect(result).toHaveLength(2);
    expect(result.every(d => d.winner_party === 'DEMOCRAT')).toBe(true);
  });

  it('filters by impact', () => {
    const result = applyFilters(districts, { ...defaultFilters, impact: 'can-impact' });
    expect(result).toHaveLength(2);
    expect(result.every(d => d.can_impact)).toBe(true);
  });

  it('filters by minimum voters', () => {
    const result = applyFilters(districts, { ...defaultFilters, minVoters: 1000 });
    expect(result).toHaveLength(2);
  });

  it('filters by search query', () => {
    const result = applyFilters(districts, { ...defaultFilters, searchQuery: 'CA' });
    expect(result).toHaveLength(2);
  });
});
```

**Step 2: Run tests to verify**

Run: `npm run test src/__tests__/voter-impact/types.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/__tests__/voter-impact/types.test.ts
git commit -m "test(voter-impact): add type utility tests"
```

---

### Task 18: Write Query Hook Tests

**Files:**
- Create: `src/__tests__/voter-impact/queries.test.ts`

**Step 1: Write tests for query hooks**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useVoterImpactStates, useVoterImpactDistricts } from '@/queries/useVoterImpactQueries';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          data: table === 'voter_impact_states'
            ? [{ id: '1', state_code: 'CA', state_name: 'California', muslim_voters: 551639 }]
            : [{ id: '1', cd_code: 'CA-13', state_code: 'CA', muslim_voters: 3980 }],
          error: null,
        })),
        eq: vi.fn(() => ({
          order: vi.fn(() => ({ data: [], error: null })),
          single: vi.fn(() => ({ data: null, error: null })),
        })),
      })),
    })),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useVoterImpactStates', () => {
  it('fetches states data', async () => {
    const { result } = renderHook(() => useVoterImpactStates(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeDefined();
    expect(result.current.data?.length).toBeGreaterThan(0);
  });
});

describe('useVoterImpactDistricts', () => {
  it('fetches districts data', async () => {
    const { result } = renderHook(() => useVoterImpactDistricts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeDefined();
  });
});
```

**Step 2: Run tests**

Run: `npm run test src/__tests__/voter-impact/queries.test.ts`
Expected: Tests pass

**Step 3: Commit**

```bash
git add src/__tests__/voter-impact/queries.test.ts
git commit -m "test(voter-impact): add query hook tests"
```

---

## Phase 6: Final Integration

### Task 19: Add Admin Navigation Link

**Files:**
- Modify: Admin navigation component (find existing admin nav)

**Step 1: Find admin navigation**

Search for admin navigation/sidebar component

**Step 2: Add link to Voter Impact Map**

Add a link like:

```typescript
<NavLink to="/admin/voter-impact-map">
  <MapIcon className="h-4 w-4" />
  Voter Impact Map
</NavLink>
```

**Step 3: Commit**

```bash
git add <admin-nav-file>
git commit -m "feat(nav): add voter impact map to admin navigation"
```

---

### Task 20: Final Verification

**Step 1: Run all tests**

Run: `npm run test:run`
Expected: All tests pass

**Step 2: Run type check**

Run: `npm run typecheck` or `npx tsc --noEmit`
Expected: No type errors

**Step 3: Run lint**

Run: `npm run lint`
Expected: No lint errors

**Step 4: Start dev server and verify**

Run: `npm run dev`
Navigate to: `http://localhost:5173/admin/voter-impact-map`
Expected: Map loads with state data, filters work, sidebar shows details

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat(voter-impact): complete Muslim Voter Impact Map implementation"
```

---

## Summary

This plan implements:

1. **Database** - Two tables for state and district voter data with RLS
2. **Data Import** - Script to import Excel data
3. **API Layer** - Query hooks with React Query
4. **Map Components** - MapLibre-based choropleth with zoom-based layers
5. **UI Components** - Controls, sidebar, legend, metric toggle
6. **Main Page** - Admin-protected page with full integration
7. **Tests** - Unit tests for utilities and hooks

Total estimated commits: 20
