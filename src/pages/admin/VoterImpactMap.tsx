/**
 * VoterImpactMap Admin Page
 *
 * Full-screen interactive heatmap for exploring Muslim voter population data
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
import type { MapFilters, ComparisonItem, MetricType } from '@/types/voter-impact';
import { DEFAULT_MAP_FILTERS, applyFilters } from '@/types/voter-impact';
import { V3ErrorBoundary } from '@/components/v3/V3ErrorBoundary';
import { MapControls } from '@/components/voter-impact/MapControls';

const ImpactMap = lazy(() => 
  import('@/components/voter-impact/ImpactMap').then(mod => ({ default: mod.ImpactMap }))
);
import { RegionSidebar } from '@/components/voter-impact/RegionSidebar';
import { MapLegend } from '@/components/voter-impact/MapLegend';

// ============================================================================
// Component
// ============================================================================

export default function VoterImpactMap() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();

  const initialFilters = useMemo<MapFilters>(() => {
    const minVotersParam = searchParams.get('minVoters');
    const searchQueryParam = searchParams.get('q');
    return {
      minVoters: minVotersParam ? Math.max(0, parseInt(minVotersParam, 10) || 0) : DEFAULT_MAP_FILTERS.minVoters,
      searchQuery: searchQueryParam || DEFAULT_MAP_FILTERS.searchQuery,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initialRegionId = useMemo<string | null>(() => {
    return searchParams.get('region') || null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initialRegionType = useMemo<'state' | 'district'>(() => {
    const typeParam = searchParams.get('type');
    return typeParam === 'district' ? 'district' : 'state';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [filters, setFilters] = useState<MapFilters>(initialFilters);
  const [activeMetric, setActiveMetric] = useState<MetricType>("population");
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(initialRegionId);
  const [selectedRegionType, setSelectedRegionType] = useState<'state' | 'district'>(initialRegionType);
  const [comparisonItems, setComparisonItems] = useState<ComparisonItem[]>([]);
  // Track whether we're viewing districts (zoomed into a state)
  const [isDistrictView, setIsDistrictView] = useState(false);

  // Sync state changes to URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.minVoters > 0) params.set('minVoters', filters.minVoters.toString());
    if (filters.searchQuery) params.set('q', filters.searchQuery);
    if (selectedRegionId) {
      params.set('region', selectedRegionId);
      params.set('type', selectedRegionType);
    }
    setSearchParams(params, { replace: true });
  }, [filters, selectedRegionId, selectedRegionType, setSearchParams]);

  // Data fetching
  const { data: rawStates = [], isLoading: statesLoading } = useVoterImpactStates();
  const { data: districts = [], isLoading: districtsLoading } = useVoterImpactDistricts();

  const states = useMemo(() => {
    return rawStates.map((state) => {
      const stateDistricts = districts.filter((d) => d.state_code === state.state_code);
      const districtSum = stateDistricts.reduce((sum, d) => sum + (d.muslim_voters || 0), 0);
      if (state.muslim_voters === 0 && districtSum > 0) {
        return { ...state, muslim_voters: districtSum };
      }
      if (districtSum > 0 && state.muslim_voters > 0) {
        const diff = Math.abs(state.muslim_voters - districtSum) / Math.max(state.muslim_voters, districtSum);
        if (diff > 0.9) return { ...state, muslim_voters: districtSum };
      }
      return state;
    });
  }, [rawStates, districts]);

  const maxVoters = useMemo(() => {
    if (districts.length === 0) return 100000;
    return Math.max(...districts.map((d) => d.muslim_voters));
  }, [districts]);

  const filteredDistricts = useMemo(
    () => applyFilters(districts, filters),
    [districts, filters]
  );

  const hasActiveFilters = useMemo(() => {
    return filters.minVoters > 0 || filters.searchQuery !== '';
  }, [filters]);

  const selectedRegion = useMemo(() => {
    if (!selectedRegionId) return null;
    if (selectedRegionType === 'district') {
      const district = districts.find((d) => d.cd_code === selectedRegionId);
      if (district) return { type: 'district' as const, data: district };
    } else {
      const state = states.find((s) => s.state_code === selectedRegionId);
      if (state) return { type: 'state' as const, data: state };
    }
    return null;
  }, [selectedRegionId, selectedRegionType, states, districts]);

  const handleRegionSelect = useCallback(
    (regionId: string | null, type: 'state' | 'district') => {
      setSelectedRegionId(regionId);
      setSelectedRegionType(type);
      // Track if we're entering district view
      if (type === 'state' && regionId) {
        setIsDistrictView(true);
      } else if (!regionId) {
        setIsDistrictView(false);
      }
    },
    []
  );

  const handleRegionHover = useCallback(
    (_regionId: string | null, _type: 'state' | 'district') => {},
    []
  );

  const handleAddToCompare = useCallback(() => {
    if (!selectedRegion || comparisonItems.length >= 4) return;
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
      { type: selectedRegion.type, id: regionId, data: selectedRegion.data },
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

  const handleClearComparison = useCallback(() => setComparisonItems([]), []);
  const handleDeselect = useCallback(() => {
    setSelectedRegionId(null);
    setIsDistrictView(false);
  }, []);

  if (isAdminLoading) {
    return (
      <div className="h-screen bg-[#0a0f1a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-[#e2e8f0] font-medium">Loading...</p>
          <p className="text-[#64748b] text-sm mt-1">Checking permissions</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="h-screen bg-[#0a0f1a] flex flex-col items-center justify-center p-4">
        <div className="bg-[#141b2d] border border-[#1e2a45] rounded-2xl p-8 max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#e2e8f0] mb-2">Access Denied</h1>
          <p className="text-[#64748b] mb-6">You don't have permission to view this page.</p>
          <Button
            onClick={() => navigate('/')}
            className="bg-[#1e2a45] hover:bg-[#2d3b55] text-[#e2e8f0] border-0"
          >
            Return Home
          </Button>
        </div>
      </div>
    );
  }

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
              Muslim Voter Population Map
            </h1>
          </div>
        </div>
      </header>

      {/* Controls Bar */}
      <MapControls
        filters={filters}
        onFiltersChange={setFilters}
        maxVoters={maxVoters}
        activeMetric={activeMetric}
        onMetricChange={setActiveMetric}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          {isDataLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0a0f1a]">
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
                <p className="text-[#e2e8f0] font-medium">Loading map data...</p>
                <p className="text-[#64748b] text-sm mt-1">Fetching voter population statistics</p>
              </div>
            </div>
          ) : (
            <V3ErrorBoundary sectionName="Voter Impact Map">
              <Suspense fallback={
                <div className="absolute inset-0 flex items-center justify-center bg-[#0a0f1a]">
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                    <p className="text-[#e2e8f0] font-medium">Loading map...</p>
                    <p className="text-[#64748b] text-sm mt-1">Initializing visualization</p>
                  </div>
                </div>
              }>
                <ImpactMap
                  states={states}
                  districts={districts}
                  filters={filters}
                  selectedRegion={selectedRegionId}
                  onRegionSelect={handleRegionSelect}
                  onRegionHover={handleRegionHover}
                  filteredDistrictCount={filteredDistricts.length}
                  hasActiveFilters={hasActiveFilters}
                  onClearFilters={() => setFilters(DEFAULT_MAP_FILTERS)}
                  activeMetric={activeMetric}
                />
              </Suspense>
              <MapLegend isDistrictView={isDistrictView} activeMetric={activeMetric} />
            </V3ErrorBoundary>
          )}
        </div>

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
