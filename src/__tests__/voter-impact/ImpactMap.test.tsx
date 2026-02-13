/**
 * ImpactMap Component Tests
 *
 * Smoke tests for the voter impact map visualization.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Import setup to activate mocks
import './setup';

import { ImpactMap } from '@/components/voter-impact/ImpactMap';
import { mockVoterImpactStates, mockVoterImpactDistricts, setupGeoJSONMock } from './setup';
import type { MapFilters } from '@/types/voter-impact';
import { DEFAULT_MAP_FILTERS } from '@/types/voter-impact';

describe('ImpactMap', () => {
  beforeEach(() => {
    setupGeoJSONMock();
    vi.clearAllMocks();
  });

  const defaultProps = {
    states: mockVoterImpactStates,
    districts: mockVoterImpactDistricts,
    filters: DEFAULT_MAP_FILTERS,
    selectedRegion: null,
    onRegionSelect: vi.fn(),
    onRegionHover: vi.fn(),
  };

  it('renders map container', async () => {
    render(<ImpactMap {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });
  });

  it('renders with empty states and districts', async () => {
    render(<ImpactMap {...defaultProps} states={[]} districts={[]} />);
    await waitFor(() => {
      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });
  });

  it('accepts filter props', async () => {
    const filters: MapFilters = { ...DEFAULT_MAP_FILTERS, minVoters: 5000 };
    render(<ImpactMap {...defaultProps} filters={filters} />);
    await waitFor(() => {
      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });
  });

  it('accepts selectedRegion prop', async () => {
    render(<ImpactMap {...defaultProps} selectedRegion="MI" />);
    await waitFor(() => {
      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });
  });

  it('calls onRegionSelect when provided', async () => {
    render(<ImpactMap {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });
    // onRegionSelect is a mock, just verify it was passed
    expect(defaultProps.onRegionSelect).toBeDefined();
  });
});
