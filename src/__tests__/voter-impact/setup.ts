/**
 * Test Setup for Voter Impact Map Components
 *
 * Provides mocks for MapLibre GL and react-map-gl, as well as
 * test fixtures for voter impact data.
 */

import { vi } from 'vitest';
import type { VoterImpactState, VoterImpactDistrict } from '@/queries/useVoterImpactQueries';

// ============================================================================
// MapLibre GL Mock
// ============================================================================

vi.mock('maplibre-gl', () => ({
  Map: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    remove: vi.fn(),
    getCanvas: vi.fn(() => ({ style: {} })),
    getContainer: vi.fn(() => document.createElement('div')),
    addControl: vi.fn(),
    removeControl: vi.fn(),
    setCenter: vi.fn(),
    setZoom: vi.fn(),
    flyTo: vi.fn(),
    fitBounds: vi.fn(),
    getCenter: vi.fn(() => ({ lng: -98.5795, lat: 39.8283 })),
    getZoom: vi.fn(() => 4),
    getBounds: vi.fn(() => ({
      getNorth: () => 49,
      getSouth: () => 25,
      getEast: () => -66,
      getWest: () => -125,
    })),
    resize: vi.fn(),
    loaded: vi.fn(() => true),
  })),
  NavigationControl: vi.fn(),
  AttributionControl: vi.fn(),
  ScaleControl: vi.fn(),
  Popup: vi.fn(() => ({
    setLngLat: vi.fn().mockReturnThis(),
    setHTML: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    remove: vi.fn(),
  })),
  Marker: vi.fn(() => ({
    setLngLat: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    remove: vi.fn(),
    getElement: vi.fn(() => document.createElement('div')),
  })),
}));

// ============================================================================
// React Map GL Mock
// ============================================================================

vi.mock('react-map-gl/maplibre', () => ({
  default: ({ children }: { children: React.ReactNode }) => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'map-container' }, children);
  },
  Map: ({ children }: { children: React.ReactNode }) => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'map-container' }, children);
  },
  Source: ({ children }: { children: React.ReactNode }) => {
    const React = require('react');
    return React.createElement(React.Fragment, null, children);
  },
  Layer: () => null,
  NavigationControl: () => null,
  ScaleControl: () => null,
  AttributionControl: () => null,
  Popup: ({ children }: { children: React.ReactNode }) => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'map-popup' }, children);
  },
  Marker: ({ children }: { children: React.ReactNode }) => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'map-marker' }, children);
  },
  useMap: () => ({
    current: {
      getCenter: () => ({ lng: -98.5795, lat: 39.8283 }),
      getZoom: () => 4,
      flyTo: vi.fn(),
      fitBounds: vi.fn(),
    },
  }),
}));

// ============================================================================
// GeoJSON Fetch Mock
// ============================================================================

const mockStateGeoJSON = {
  type: 'FeatureCollection' as const,
  features: [
    {
      type: 'Feature' as const,
      id: 'MI',
      properties: { name: 'Michigan', code: 'MI' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[[-84.5, 42], [-84, 43], [-85, 43], [-85, 42], [-84.5, 42]]],
      },
    },
    {
      type: 'Feature' as const,
      id: 'PA',
      properties: { name: 'Pennsylvania', code: 'PA' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[[-75, 40], [-75, 41], [-80, 41], [-80, 40], [-75, 40]]],
      },
    },
    {
      type: 'Feature' as const,
      id: 'CA',
      properties: { name: 'California', code: 'CA' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[[-122, 37], [-122, 39], [-120, 39], [-120, 37], [-122, 37]]],
      },
    },
  ],
};

const mockDistrictGeoJSON = {
  type: 'FeatureCollection' as const,
  features: [
    {
      type: 'Feature' as const,
      id: 'MI-011',
      properties: { state: 'MI', district: '11', cd_code: 'MI-011' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[[-83, 42], [-83, 43], [-84, 43], [-84, 42], [-83, 42]]],
      },
    },
    {
      type: 'Feature' as const,
      id: 'PA-007',
      properties: { state: 'PA', district: '07', cd_code: 'PA-007' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[[-75, 40], [-75, 41], [-76, 41], [-76, 40], [-75, 40]]],
      },
    },
    {
      type: 'Feature' as const,
      id: 'CA-045',
      properties: { state: 'CA', district: '45', cd_code: 'CA-045' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[[-118, 33], [-118, 34], [-117, 34], [-117, 33], [-118, 33]]],
      },
    },
  ],
};

// Setup global fetch mock for GeoJSON files
export function setupGeoJSONMock() {
  global.fetch = vi.fn((url: string) => {
    if (url.includes('us-states.json') || url.includes('states')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockStateGeoJSON),
      } as Response);
    }
    if (url.includes('districts') || url.includes('congressional')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockDistrictGeoJSON),
      } as Response);
    }
    // Default - return empty feature collection
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ type: 'FeatureCollection', features: [] }),
    } as Response);
  }) as unknown as typeof fetch;
}

// ============================================================================
// Voter Impact Test Fixtures
// ============================================================================

export const mockVoterImpactStates: VoterImpactState[] = [
  {
    id: 'state-mi',
    state_code: 'MI',
    state_name: 'Michigan',
    muslim_voters: 150000,
    households: 45000,
    cell_phones: 120000,
    registered: 135000,
    registered_pct: 0.90,
    vote_2024: 108000,
    vote_2024_pct: 0.72,
    vote_2022: 95000,
    vote_2022_pct: 0.63,
    political_donors: 8500,
    political_activists: 2200,
  },
  {
    id: 'state-pa',
    state_code: 'PA',
    state_name: 'Pennsylvania',
    muslim_voters: 85000,
    households: 28000,
    cell_phones: 68000,
    registered: 72000,
    registered_pct: 0.85,
    vote_2024: 54000,
    vote_2024_pct: 0.64,
    vote_2022: 48000,
    vote_2022_pct: 0.56,
    political_donors: 4200,
    political_activists: 1100,
  },
  {
    id: 'state-ca',
    state_code: 'CA',
    state_name: 'California',
    muslim_voters: 280000,
    households: 85000,
    cell_phones: 225000,
    registered: 252000,
    registered_pct: 0.90,
    vote_2024: 196000,
    vote_2024_pct: 0.70,
    vote_2022: 175000,
    vote_2022_pct: 0.63,
    political_donors: 15000,
    political_activists: 4500,
  },
];

export const mockVoterImpactDistricts: VoterImpactDistrict[] = [
  // High impact district - close race, can impact
  {
    id: 'dist-mi-011',
    cd_code: 'MI-011',
    state_code: 'MI',
    district_num: 11,
    winner: 'John Smith',
    winner_party: 'D',
    winner_votes: 185000,
    runner_up: 'Jane Doe',
    runner_up_party: 'R',
    runner_up_votes: 180000,
    margin_votes: 5000,
    margin_pct: 0.027, // 2.7% - close race
    total_votes: 365000,
    muslim_voters: 45000,
    muslim_registered: 40500,
    muslim_unregistered: 4500,
    voted_2024: 32400,
    didnt_vote_2024: 8100,
    turnout_pct: 0.72,
    can_impact: true,
    votes_needed: 2501,
    cost_estimate: 75000,
  },
  // Medium impact district - moderate margin
  {
    id: 'dist-pa-007',
    cd_code: 'PA-007',
    state_code: 'PA',
    district_num: 7,
    winner: 'Bob Wilson',
    winner_party: 'R',
    winner_votes: 172000,
    runner_up: 'Mary Johnson',
    runner_up_party: 'D',
    runner_up_votes: 158000,
    margin_votes: 14000,
    margin_pct: 0.042, // 4.2% - moderately close
    total_votes: 330000,
    muslim_voters: 28000,
    muslim_registered: 23800,
    muslim_unregistered: 4200,
    voted_2024: 16660,
    didnt_vote_2024: 7140,
    turnout_pct: 0.70,
    can_impact: true,
    votes_needed: 7001,
    cost_estimate: 120000,
  },
  // Safe district - cannot impact
  {
    id: 'dist-ca-045',
    cd_code: 'CA-045',
    state_code: 'CA',
    district_num: 45,
    winner: 'Sarah Lee',
    winner_party: 'D',
    winner_votes: 210000,
    runner_up: 'Tom Brown',
    runner_up_party: 'R',
    runner_up_votes: 150000,
    margin_votes: 60000,
    margin_pct: 0.167, // 16.7% - safe seat
    total_votes: 360000,
    muslim_voters: 55000,
    muslim_registered: 49500,
    muslim_unregistered: 5500,
    voted_2024: 38500,
    didnt_vote_2024: 11000,
    turnout_pct: 0.78,
    can_impact: false,
    votes_needed: null,
    cost_estimate: null,
  },
  // Very close race with low turnout
  {
    id: 'dist-mi-008',
    cd_code: 'MI-008',
    state_code: 'MI',
    district_num: 8,
    winner: 'Chris Green',
    winner_party: 'R',
    winner_votes: 145000,
    runner_up: 'Pat Blue',
    runner_up_party: 'D',
    runner_up_votes: 143500,
    margin_votes: 1500,
    margin_pct: 0.005, // 0.5% - very close
    total_votes: 288500,
    muslim_voters: 18000,
    muslim_registered: 15000,
    muslim_unregistered: 3000,
    voted_2024: 6750,
    didnt_vote_2024: 8250,
    turnout_pct: 0.45, // low turnout
    can_impact: true,
    votes_needed: 751,
    cost_estimate: 25000,
  },
  // District with very small Muslim population
  {
    id: 'dist-pa-012',
    cd_code: 'PA-012',
    state_code: 'PA',
    district_num: 12,
    winner: 'Mike Red',
    winner_party: 'R',
    winner_votes: 195000,
    runner_up: 'Lisa White',
    runner_up_party: 'D',
    runner_up_votes: 165000,
    margin_votes: 30000,
    margin_pct: 0.083, // 8.3%
    total_votes: 360000,
    muslim_voters: 2500, // Very small population
    muslim_registered: 2000,
    muslim_unregistered: 500,
    voted_2024: 1200,
    didnt_vote_2024: 800,
    turnout_pct: 0.60,
    can_impact: false,
    votes_needed: null,
    cost_estimate: null,
  },
];

// ============================================================================
// Supabase Mock for Voter Impact Queries
// ============================================================================

export const SUPABASE_URL = 'https://nuclmzoasgydubdshtab.supabase.co';

export const voterImpactHandlers = [
  // States endpoint
  {
    url: `${SUPABASE_URL}/rest/v1/voter_impact_states`,
    response: mockVoterImpactStates,
  },
  // Districts endpoint
  {
    url: `${SUPABASE_URL}/rest/v1/voter_impact_districts`,
    response: mockVoterImpactDistricts,
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Reset all mocks between tests
 */
export function resetMocks() {
  vi.clearAllMocks();
}

/**
 * Create a custom district for testing specific scenarios
 *
 * Automatically computes derived values when relevant fields are overridden:
 * - margin_votes from margin_pct * total_votes (if margin_pct is provided)
 * - didnt_vote_2024 from muslim_registered * (1 - turnout_pct) (if turnout or population is provided)
 * - voted_2024 from muslim_registered * turnout_pct
 */
export function createMockDistrict(
  overrides: Partial<VoterImpactDistrict>
): VoterImpactDistrict {
  // Base values
  const total_votes = overrides.total_votes ?? 190000;
  const margin_pct = overrides.margin_pct ?? 0.05;
  const muslim_voters = overrides.muslim_voters ?? 20000;
  const turnout_pct = overrides.turnout_pct ?? 0.70;

  // Compute derived values if not explicitly provided
  const margin_votes = overrides.margin_votes ?? Math.round(margin_pct * total_votes);
  const muslim_registered = overrides.muslim_registered ?? Math.round(muslim_voters * 0.9);
  const voted_2024 = overrides.voted_2024 ?? Math.round(muslim_registered * turnout_pct);
  const didnt_vote_2024 = overrides.didnt_vote_2024 ?? (muslim_registered - voted_2024);

  return {
    id: 'dist-test',
    cd_code: 'TEST-001',
    state_code: 'TS',
    district_num: 1,
    winner: 'Test Winner',
    winner_party: 'D',
    winner_votes: 100000,
    runner_up: 'Test Runner Up',
    runner_up_party: 'R',
    runner_up_votes: 90000,
    margin_votes,
    margin_pct,
    total_votes,
    muslim_voters,
    muslim_registered,
    muslim_unregistered: muslim_voters - muslim_registered,
    voted_2024,
    didnt_vote_2024,
    turnout_pct,
    can_impact: true,
    votes_needed: 5001,
    cost_estimate: 100000,
    ...overrides,
  };
}

/**
 * Create a custom state for testing specific scenarios
 */
export function createMockState(
  overrides: Partial<VoterImpactState>
): VoterImpactState {
  return {
    id: 'state-test',
    state_code: 'TS',
    state_name: 'Test State',
    muslim_voters: 100000,
    households: 30000,
    cell_phones: 80000,
    registered: 90000,
    registered_pct: 0.90,
    vote_2024: 63000,
    vote_2024_pct: 0.70,
    vote_2022: 54000,
    vote_2022_pct: 0.60,
    political_donors: 5000,
    political_activists: 1500,
    ...overrides,
  };
}
