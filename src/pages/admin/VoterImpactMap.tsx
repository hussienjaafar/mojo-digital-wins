/**
 * VoterImpactMap Admin Page
 *
 * Full-screen interactive map for exploring Muslim voter impact data
 * across US states and congressional districts.
 */

import React, { useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
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
import type { MapFilters, MetricType, ComparisonItem } from '@/types/voter-impact';
import { DEFAULT_MAP_FILTERS } from '@/types/voter-impact';
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

export default function VoterImpactMap() {
  const navigate = useNavigate();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();

  // State management
  const [filters, setFilters] = useState<MapFilters>(DEFAULT_MAP_FILTERS);
  const [metric, setMetric] = useState<MetricType>('impact');
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [selectedRegionType, setSelectedRegionType] = useState<'state' | 'district'>('state');
  const [comparisonItems, setComparisonItems] = useState<ComparisonItem[]>([]);

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
      <header className="bg-[#141b2d] border-b border-[#1e2a45] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin?tab=analytics')}
            className="text-[#64748b] hover:text-[#e2e8f0] hover:bg-[#1e2a45]"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin
          </Button>
          <h1 className="text-lg font-semibold text-[#e2e8f0] uppercase tracking-wide">
            Muslim Voter Impact Map
          </h1>
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
        />
      </div>
    </div>
  );
}
