/**
 * VoterImpactMap Admin Page
 *
 * Full-screen interactive map for exploring Muslim voter impact data
 * across US states and congressional districts.
 */

import React, { useState, useMemo, useCallback, lazy, Suspense, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import {
  useVoterImpactStates,
  useVoterImpactDistricts,
} from '@/queries/useVoterImpactQueries';
import type {
  VoterImpactState,
  VoterImpactDistrict,
} from '@/queries/useVoterImpactQueries';
import type { MapFilters, MetricType, ComparisonItem, PartyFilter, ImpactFilter, PresetFilter } from '@/types/voter-impact';
import { DEFAULT_MAP_FILTERS, applyFilters } from '@/types/voter-impact';
import { V3ErrorBoundary } from '@/components/v3/V3ErrorBoundary';
import { MapControls } from '@/components/voter-impact/MapControls';

// Lazy load ImpactMap to isolate maplibre-gl bundling
const ImpactMap = lazy(() => 
  import('@/components/voter-impact/ImpactMap').then(mod => ({ default: mod.ImpactMap }))
);
import { RegionSidebar } from '@/components/voter-impact/RegionSidebar';
import { MapLegend } from '@/components/voter-impact/MapLegend';
import { MetricToggle } from '@/components/voter-impact/MetricToggle';

// ============================================================================
// Component
// ============================================================================

// Valid filter values for URL param validation
const VALID_PARTY_VALUES: PartyFilter[] = ['all', 'democrat', 'republican', 'close'];
const VALID_IMPACT_VALUES: ImpactFilter[] = ['all', 'high', 'can-impact', 'no-impact'];
const VALID_PRESET_VALUES: PresetFilter[] = ['none', 'swing', 'high-roi', 'low-turnout', 'top-population'];
const VALID_REGION_TYPES = ['state', 'district'] as const;

export default function VoterImpactMap() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();

  // Initialize state from URL params (runs once on mount)
  const initialFilters = useMemo<MapFilters>(() => {
    const partyParam = searchParams.get('party');
    const impactParam = searchParams.get('impact');
    const minVotersParam = searchParams.get('minVoters');
    const presetParam = searchParams.get('preset');
    const searchQueryParam = searchParams.get('q');

    return {
      party: partyParam && VALID_PARTY_VALUES.includes(partyParam as PartyFilter)
        ? (partyParam as PartyFilter)
        : DEFAULT_MAP_FILTERS.party,
      impact: impactParam && VALID_IMPACT_VALUES.includes(impactParam as ImpactFilter)
        ? (impactParam as ImpactFilter)
        : DEFAULT_MAP_FILTERS.impact,
      minVoters: minVotersParam ? Math.max(0, parseInt(minVotersParam, 10) || 0) : DEFAULT_MAP_FILTERS.minVoters,
      preset: presetParam && VALID_PRESET_VALUES.includes(presetParam as PresetFilter)
        ? (presetParam as PresetFilter)
        : DEFAULT_MAP_FILTERS.preset,
      searchQuery: searchQueryParam || DEFAULT_MAP_FILTERS.searchQuery,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const initialRegionId = useMemo<string | null>(() => {
    return searchParams.get('region') || null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const initialRegionType = useMemo<'state' | 'district'>(() => {
    const typeParam = searchParams.get('type');
    return typeParam && VALID_REGION_TYPES.includes(typeParam as 'state' | 'district')
      ? (typeParam as 'state' | 'district')
      : 'state';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // State management
  const [filters, setFilters] = useState<MapFilters>(initialFilters);
  const [metric, setMetric] = useState<MetricType>('impact');
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(initialRegionId);
  const [selectedRegionType, setSelectedRegionType] = useState<'state' | 'district'>(initialRegionType);
  const [comparisonItems, setComparisonItems] = useState<ComparisonItem[]>([]);

  // Sync state changes to URL params
  useEffect(() => {
    const params = new URLSearchParams();

    // Only add non-default filter values to keep URL clean
    if (filters.party !== 'all') {
      params.set('party', filters.party);
    }
    if (filters.impact !== 'all') {
      params.set('impact', filters.impact);
    }
    if (filters.minVoters > 0) {
      params.set('minVoters', filters.minVoters.toString());
    }
    if (filters.preset !== 'none') {
      params.set('preset', filters.preset);
    }
    if (filters.searchQuery) {
      params.set('q', filters.searchQuery);
    }

    // Add selected region to URL
    if (selectedRegionId) {
      params.set('region', selectedRegionId);
      params.set('type', selectedRegionType);
    }

    // Use replace: true to avoid polluting browser history
    setSearchParams(params, { replace: true });
  }, [filters, selectedRegionId, selectedRegionType, setSearchParams]);

  // Data fetching
  const { data: rawStates = [], isLoading: statesLoading } = useVoterImpactStates();
  const { data: districts = [], isLoading: districtsLoading } = useVoterImpactDistricts();

  // Reconcile state-level data from district sums when state data is missing/wrong
  const states = useMemo(() => {
    return rawStates.map((state) => {
      const stateDistricts = districts.filter((d) => d.state_code === state.state_code);
      const districtSum = stateDistricts.reduce((sum, d) => sum + (d.muslim_voters || 0), 0);

      // If state has 0 but districts have data, use district sum
      if (state.muslim_voters === 0 && districtSum > 0) {
        return { ...state, muslim_voters: districtSum };
      }

      // If state value is clearly wrong (>90% different from district sum)
      if (districtSum > 0 && state.muslim_voters > 0) {
        const diff = Math.abs(state.muslim_voters - districtSum) / Math.max(state.muslim_voters, districtSum);
        if (diff > 0.9) {
          return { ...state, muslim_voters: districtSum };
        }
      }

      return state;
    });
  }, [rawStates, districts]);

  // Calculate max voters for slider
  const maxVoters = useMemo(() => {
    if (districts.length === 0) return 100000;
    return Math.max(...districts.map((d) => d.muslim_voters));
  }, [districts]);

  // Calculate filtered districts for empty state detection
  const filteredDistricts = useMemo(
    () => applyFilters(districts, filters),
    [districts, filters]
  );

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      filters.party !== 'all' ||
      filters.impact !== 'all' ||
      filters.minVoters > 0 ||
      filters.preset !== 'none' ||
      filters.searchQuery !== ''
    );
  }, [filters]);

  // Get selected region data
  const selectedRegion = useMemo(() => {
    if (!selectedRegionId) return null;

    if (selectedRegionType === 'district') {
      const district = districts.find((d) => d.cd_code === selectedRegionId);
      if (district) {
        return { type: 'district' as const, data: district };
      }
    } else {
      const state = states.find((s) => s.state_code === selectedRegionId);
      if (state) {
        return { type: 'state' as const, data: state };
      }
    }

    return null;
  }, [selectedRegionId, selectedRegionType, states, districts]);

  // Handlers
  const handleRegionSelect = useCallback(
    (regionId: string | null, type: 'state' | 'district') => {
      setSelectedRegionId(regionId);
      setSelectedRegionType(type);
    },
    []
  );

  const handleRegionHover = useCallback(
    (_regionId: string | null, _type: 'state' | 'district') => {
      // Future tooltip support
    },
    []
  );

  const handleAddToCompare = useCallback(() => {
    if (!selectedRegion || comparisonItems.length >= 4) return;

    // Check if already in comparison
    const regionId =
      selectedRegion.type === 'district'
        ? (selectedRegion.data as VoterImpactDistrict).cd_code
        : (selectedRegion.data as VoterImpactState).state_code;

    const alreadyInComparison = comparisonItems.some((item) => {
      const itemId =
        item.type === 'district'
          ? (item.data as VoterImpactDistrict).cd_code
          : (item.data as VoterImpactState).state_code;
      return itemId === regionId;
    });

    if (alreadyInComparison) return;

    setComparisonItems((prev) => [
      ...prev,
      {
        type: selectedRegion.type,
        id: regionId,
        data: selectedRegion.data,
      },
    ]);
  }, [selectedRegion, comparisonItems]);

  const handleRemoveFromCompare = useCallback((id: string) => {
    setComparisonItems((prev) =>
      prev.filter((item) => {
        const itemId =
          item.type === 'district'
            ? (item.data as VoterImpactDistrict).cd_code
            : (item.data as VoterImpactState).state_code;
        return itemId !== id;
      })
    );
  }, []);

  const handleClearComparison = useCallback(() => {
    setComparisonItems([]);
  }, []);

  const handleDeselect = useCallback(() => {
    setSelectedRegionId(null);
  }, []);

  // Loading state
  if (isAdminLoading) {
    return (
      <div className="h-screen bg-[#0a0f1a] flex items-center justify-center">
        <p className="text-[#e2e8f0]">Loading...</p>
      </div>
    );
  }

  // Access denied
  if (!isAdmin) {
    return (
      <div className="h-screen bg-[#0a0f1a] flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold text-[#e2e8f0]">Access Denied</h1>
        <p className="text-[#64748b]">You do not have permission to view this page.</p>
        <Button
          variant="outline"
          onClick={() => navigate('/')}
          className="bg-[#141b2d] border-[#1e2a45] text-[#e2e8f0] hover:bg-[#1e2a45] hover:text-[#e2e8f0]"
        >
          Go Home
        </Button>
      </div>
    );
  }

  // Data loading state
  const isDataLoading = statesLoading || districtsLoading;

  return (
    <div className="h-screen bg-[#0a0f1a] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-[#0a0f1a]/95 backdrop-blur-md border-b border-[#1e2a45] px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin?tab=analytics')}
            className="text-[#64748b] hover:text-[#e2e8f0] hover:bg-[#1e2a45] rounded-lg"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin
          </Button>
          <div className="h-6 w-px bg-[#1e2a45]" />
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <h1 className="text-base font-bold text-[#e2e8f0] tracking-tight">
              Muslim Voter Impact Map
            </h1>
          </div>
        </div>
        <MetricToggle value={metric} onChange={setMetric} />
      </header>

      {/* Controls Bar */}
      <MapControls
        filters={filters}
        onFiltersChange={setFilters}
        maxVoters={maxVoters}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Map Area */}
        <div className="flex-1 relative">
          {isDataLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0a0f1a]">
              <p className="text-[#e2e8f0]">Loading map data...</p>
            </div>
          ) : (
            <V3ErrorBoundary sectionName="Voter Impact Map">
              <Suspense fallback={
                <div className="absolute inset-0 flex items-center justify-center bg-[#0a0f1a]">
                  <p className="text-[#e2e8f0]">Loading map component...</p>
                </div>
              }>
                <ImpactMap
                  states={states}
                  districts={districts}
                  filters={filters}
                  metric={metric}
                  selectedRegion={selectedRegionId}
                  onRegionSelect={handleRegionSelect}
                  onRegionHover={handleRegionHover}
                  filteredDistrictCount={filteredDistricts.length}
                  hasActiveFilters={hasActiveFilters}
                  onClearFilters={() => setFilters(DEFAULT_MAP_FILTERS)}
                />
              </Suspense>
              <MapLegend />
            </V3ErrorBoundary>
          )}
        </div>

        {/* Sidebar */}
        <RegionSidebar
          selectedRegion={selectedRegion}
          comparisonItems={comparisonItems.map((item) => ({
            type: item.type,
            data: item.data,
          }))}
          onAddToCompare={handleAddToCompare}
          onRemoveFromCompare={handleRemoveFromCompare}
          onClearComparison={handleClearComparison}
          onDeselect={handleDeselect}
        />
      </div>
    </div>
  );
}
