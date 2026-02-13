/**
 * MapControls Component
 *
 * Simplified controls bar for the voter population heatmap.
 * Provides search and minimum population slider.
 */

import { useCallback, useMemo } from "react";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

import type { MapFilters } from "@/types/voter-impact";
import { DEFAULT_MAP_FILTERS } from "@/types/voter-impact";

// ============================================================================
// Types
// ============================================================================

export interface MapControlsProps {
  filters: MapFilters;
  onFiltersChange: (filters: MapFilters) => void;
  maxVoters: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatVoterCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(0)}k`;
  }
  return count.toString();
}

// ============================================================================
// Component
// ============================================================================

export function MapControls({
  filters,
  onFiltersChange,
  maxVoters,
}: MapControlsProps) {
  const hasActiveFilters = useMemo(() => {
    return (
      filters.minVoters !== DEFAULT_MAP_FILTERS.minVoters ||
      filters.searchQuery !== DEFAULT_MAP_FILTERS.searchQuery
    );
  }, [filters]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFiltersChange({
        ...filters,
        searchQuery: e.target.value,
      });
    },
    [filters, onFiltersChange]
  );

  const handleMinVotersChange = useCallback(
    (value: number[]) => {
      onFiltersChange({
        ...filters,
        minVoters: value[0],
      });
    },
    [filters, onFiltersChange]
  );

  const handleClearFilters = useCallback(() => {
    onFiltersChange(DEFAULT_MAP_FILTERS);
  }, [onFiltersChange]);

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 bg-[#0a0f1a]/95 backdrop-blur-md border-b border-[#1e2a45]"
      role="toolbar"
      aria-label="Map filter controls"
    >
      {/* Search Input */}
      <div className="relative flex-shrink-0 w-52">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748b]" aria-hidden="true" />
        <Input
          type="text"
          placeholder="Search states/districts..."
          value={filters.searchQuery}
          onChange={handleSearchChange}
          className="pl-9 h-9 bg-[#141b2d] border-[#1e2a45] rounded-lg text-[#e2e8f0] placeholder:text-[#64748b] focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
          aria-label="Search by state or district code"
        />
      </div>

      <div className="h-6 w-px bg-[#1e2a45] mx-1" />

      {/* Voter Threshold Slider */}
      <div className="flex items-center gap-3 flex-shrink-0 bg-[#141b2d] rounded-lg px-3 py-1.5 border border-[#1e2a45]" role="group" aria-labelledby="min-voters-label">
        <span id="min-voters-label" className="text-xs text-[#64748b] whitespace-nowrap uppercase tracking-wider">Min. Population:</span>
        <div className="w-28">
          <Slider
            value={[filters.minVoters]}
            min={0}
            max={maxVoters}
            step={1000}
            onValueChange={handleMinVotersChange}
            className="[&_[data-slot=track]]:bg-[#1e2a45] [&_[data-slot=range]]:bg-blue-500 [&_[data-slot=thumb]]:bg-[#e2e8f0] [&_[data-slot=thumb]]:border-blue-500"
            aria-label="Minimum Muslim population threshold"
            aria-valuemin={0}
            aria-valuemax={maxVoters}
            aria-valuenow={filters.minVoters}
            aria-valuetext={`${formatVoterCount(filters.minVoters)} voters`}
          />
        </div>
        <span className="text-sm font-medium text-[#e2e8f0] w-10 text-right tabular-nums" aria-hidden="true">
          {formatVoterCount(filters.minVoters)}
        </span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearFilters}
          className="h-9 rounded-lg text-red-400/80 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
        >
          <X className="h-4 w-4 mr-2" />
          Clear Filters
        </Button>
      )}
    </div>
  );
}

export default MapControls;
