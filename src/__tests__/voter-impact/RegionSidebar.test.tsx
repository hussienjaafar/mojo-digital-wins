/**
 * RegionSidebar Component Tests
 *
 * Smoke tests for the voter impact region sidebar.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { RegionSidebar } from '@/components/voter-impact/RegionSidebar';
import { mockVoterImpactStates, mockVoterImpactDistricts } from './setup';

describe('RegionSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    selectedRegion: null,
    comparisonItems: [],
    onAddToCompare: vi.fn(),
    onRemoveFromCompare: vi.fn(),
    onClearComparison: vi.fn(),
    onDeselect: vi.fn(),
  };

  describe('empty state', () => {
    it('renders without selected region', () => {
      render(<RegionSidebar {...defaultProps} />);
      // Should show heading and helpful tips
      expect(screen.getByText('No Region Selected')).toBeInTheDocument();
      expect(screen.getByText('Click on a state for overview data')).toBeInTheDocument();
    });
  });

  describe('state details', () => {
    it('renders state name and code', () => {
      const state = mockVoterImpactStates[0]; // Michigan
      render(
        <RegionSidebar
          {...defaultProps}
          selectedRegion={{ type: 'state', data: state }}
        />
      );
      // Use getByRole to target the heading specifically
      expect(screen.getByRole('heading', { name: /Michigan/i })).toBeInTheDocument();
      expect(screen.getByText(/MI/)).toBeInTheDocument();
    });

    it('renders muslim voter count', () => {
      const state = mockVoterImpactStates[0];
      render(
        <RegionSidebar
          {...defaultProps}
          selectedRegion={{ type: 'state', data: state }}
        />
      );
      // 150,000 formatted
      expect(screen.getByText(/150,000/)).toBeInTheDocument();
    });
  });

  describe('district details', () => {
    it('renders district code', () => {
      const district = mockVoterImpactDistricts[0]; // MI-011
      render(
        <RegionSidebar
          {...defaultProps}
          selectedRegion={{ type: 'district', data: district }}
        />
      );
      // Use getByRole to target the heading specifically
      expect(screen.getByRole('heading', { name: /MI-011/ })).toBeInTheDocument();
    });

    it('renders winner information', () => {
      const district = mockVoterImpactDistricts[0];
      render(
        <RegionSidebar
          {...defaultProps}
          selectedRegion={{ type: 'district', data: district }}
        />
      );
      expect(screen.getByText(/John Smith/)).toBeInTheDocument();
    });

    it('renders margin votes', () => {
      const district = mockVoterImpactDistricts[0]; // margin_votes: 5000
      render(
        <RegionSidebar
          {...defaultProps}
          selectedRegion={{ type: 'district', data: district }}
        />
      );
      // The margin is displayed as "5,000 votes (2.7%)"
      expect(screen.getByText(/5,000 votes/)).toBeInTheDocument();
    });

    it('shows impact badge for impactable district', () => {
      const district = mockVoterImpactDistricts[0]; // can_impact: true
      render(
        <RegionSidebar
          {...defaultProps}
          selectedRegion={{ type: 'district', data: district }}
        />
      );
      // Should have some impact indicator (HIGH, MEDIUM, or LOW)
      const badge = screen.getByText(/HIGH|MEDIUM|LOW/i);
      expect(badge).toBeInTheDocument();
    });

    it('shows NO IMPACT for safe district', () => {
      const district = mockVoterImpactDistricts[2]; // CA-045, can_impact: false
      render(
        <RegionSidebar
          {...defaultProps}
          selectedRegion={{ type: 'district', data: district }}
        />
      );
      expect(screen.getByText(/NO IMPACT/i)).toBeInTheDocument();
    });
  });

  describe('comparison mode', () => {
    it('renders comparison items', () => {
      const district = mockVoterImpactDistricts[0];
      render(
        <RegionSidebar
          {...defaultProps}
          comparisonItems={[{ type: 'district', data: district }]}
        />
      );
      // Should show comparison section
      expect(screen.getByText(/Comparing/i)).toBeInTheDocument();
    });
  });
});
