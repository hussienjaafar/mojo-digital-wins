/**
 * MapControls Component
 *
 * Filter controls bar for the voter impact map. Provides search, filtering,
 * and preset options for exploring Muslim voter impact data.
 */

import { useCallback, useMemo } from "react";
import { Search, Filter, Zap, X, TrendingUp, Users, Target, Crown } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { MapFilters, PartyFilter, ImpactFilter, PresetFilter } from "@/types/voter-impact";
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
// Constants
// ============================================================================

const PARTY_OPTIONS: { value: PartyFilter; label: string }[] = [
  { value: "all", label: "All Parties" },
  { value: "democrat", label: "Democrat" },
  { value: "republican", label: "Republican" },
  { value: "close", label: "Close Races (<5%)" },
];

const IMPACT_OPTIONS: { value: ImpactFilter; label: string }[] = [
  { value: "all", label: "All Impact Levels" },
  { value: "high", label: "High Impact" },
  { value: "can-impact", label: "Can Impact" },
  { value: "no-impact", label: "No Impact" },
];

const PRESET_OPTIONS: { value: PresetFilter; label: string; icon: React.ReactNode; description: string }[] = [
  {
    value: "swing",
    label: "Swing Districts",
    icon: <TrendingUp className="h-4 w-4" />,
    description: "Close races where Muslim voters can make a difference",
  },
  {
    value: "high-roi",
    label: "High ROI Targets",
    icon: <Target className="h-4 w-4" />,
    description: "Districts with best cost-per-impact ratio",
  },
  {
    value: "low-turnout",
    label: "Low Turnout Opportunities",
    icon: <Users className="h-4 w-4" />,
    description: "Districts with turnout below 50%",
  },
  {
    value: "top-population",
    label: "Top 20 by Population",
    icon: <Crown className="h-4 w-4" />,
    description: "Largest Muslim voter populations",
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

function getPartyLabel(value: PartyFilter): string {
  return PARTY_OPTIONS.find((opt) => opt.value === value)?.label ?? "All Parties";
}

function getImpactLabel(value: ImpactFilter): string {
  return IMPACT_OPTIONS.find((opt) => opt.value === value)?.label ?? "All Impact Levels";
}

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
  // Determine if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      filters.party !== DEFAULT_MAP_FILTERS.party ||
      filters.impact !== DEFAULT_MAP_FILTERS.impact ||
      filters.minVoters !== DEFAULT_MAP_FILTERS.minVoters ||
      filters.preset !== DEFAULT_MAP_FILTERS.preset ||
      filters.searchQuery !== DEFAULT_MAP_FILTERS.searchQuery
    );
  }, [filters]);

  // Handlers
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFiltersChange({
        ...filters,
        searchQuery: e.target.value,
      });
    },
    [filters, onFiltersChange]
  );

  const handlePartyChange = useCallback(
    (value: PartyFilter) => {
      onFiltersChange({
        ...filters,
        party: value,
        preset: "none", // Clear preset when manually filtering
      });
    },
    [filters, onFiltersChange]
  );

  const handleImpactChange = useCallback(
    (value: ImpactFilter) => {
      onFiltersChange({
        ...filters,
        impact: value,
        preset: "none", // Clear preset when manually filtering
      });
    },
    [filters, onFiltersChange]
  );

  const handleMinVotersChange = useCallback(
    (value: number[]) => {
      onFiltersChange({
        ...filters,
        minVoters: value[0],
        preset: "none", // Clear preset when manually filtering
      });
    },
    [filters, onFiltersChange]
  );

  const handlePresetChange = useCallback(
    (value: PresetFilter) => {
      // When applying a preset, reset other filters
      onFiltersChange({
        ...DEFAULT_MAP_FILTERS,
        preset: value,
        searchQuery: filters.searchQuery, // Keep search query
      });
    },
    [filters.searchQuery, onFiltersChange]
  );

  const handleClearFilters = useCallback(() => {
    onFiltersChange(DEFAULT_MAP_FILTERS);
  }, [onFiltersChange]);

  return (
    <div
      className="flex items-center gap-3 p-3 bg-[#141b2d] border-b border-[#1e2a45]"
      role="toolbar"
      aria-label="Map filter controls"
    >
      {/* Search Input */}
      <div className="relative flex-shrink-0 w-48">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" aria-hidden="true" />
        <Input
          type="text"
          placeholder="Search districts..."
          value={filters.searchQuery}
          onChange={handleSearchChange}
          className="pl-9 h-9 bg-[#0a0f1a] border-[#1e2a45] text-[#e2e8f0] placeholder:text-[#94a3b8] focus:border-blue-500"
          aria-label="Search districts by name or code"
        />
      </div>

      {/* Party Filter Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-9 bg-[#0a0f1a] border-[#1e2a45] text-[#e2e8f0] hover:bg-[#1e2a45] hover:text-[#e2e8f0]"
            aria-label={`Filter by party, currently ${getPartyLabel(filters.party)}`}
          >
            <Filter className="h-4 w-4 mr-2" aria-hidden="true" />
            {getPartyLabel(filters.party)}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-[#141b2d] border-[#1e2a45]">
          <DropdownMenuLabel className="text-[#94a3b8]">Filter by Party</DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-[#1e2a45]" />
          {PARTY_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handlePartyChange(option.value)}
              className="text-[#e2e8f0] focus:bg-[#1e2a45] focus:text-[#e2e8f0] cursor-pointer"
            >
              {option.label}
              {filters.party === option.value && (
                <span className="ml-auto text-blue-400">&#10003;</span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Impact Filter Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-9 bg-[#0a0f1a] border-[#1e2a45] text-[#e2e8f0] hover:bg-[#1e2a45] hover:text-[#e2e8f0]"
            aria-label={`Filter by impact level, currently ${getImpactLabel(filters.impact)}`}
          >
            <Zap className="h-4 w-4 mr-2" aria-hidden="true" />
            {getImpactLabel(filters.impact)}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-[#141b2d] border-[#1e2a45]">
          <DropdownMenuLabel className="text-[#94a3b8]">Filter by Impact</DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-[#1e2a45]" />
          {IMPACT_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleImpactChange(option.value)}
              className="text-[#e2e8f0] focus:bg-[#1e2a45] focus:text-[#e2e8f0] cursor-pointer"
            >
              {option.label}
              {filters.impact === option.value && (
                <span className="ml-auto text-blue-400">&#10003;</span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Voter Threshold Slider */}
      <div className="flex items-center gap-3 flex-shrink-0" role="group" aria-labelledby="min-voters-label">
        <span id="min-voters-label" className="text-sm text-[#94a3b8] whitespace-nowrap">Minimum Muslim Population:</span>
        <div className="w-32">
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
        <span className="text-sm text-[#e2e8f0] w-12 text-right" aria-hidden="true">
          {formatVoterCount(filters.minVoters)}
        </span>
      </div>

      {/* Presets Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`h-9 bg-[#0a0f1a] border-[#1e2a45] text-[#e2e8f0] hover:bg-[#1e2a45] hover:text-[#e2e8f0] ${
              filters.preset !== "none" ? "border-blue-500" : ""
            }`}
            aria-label={filters.preset !== "none" ? `Quick filter presets, 1 active` : "Quick filter presets"}
          >
            <Zap className="h-4 w-4 mr-2" aria-hidden="true" />
            Presets
            {filters.preset !== "none" && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-blue-500 text-white rounded" aria-hidden="true">
                1
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-72 bg-[#141b2d] border-[#1e2a45]">
          <DropdownMenuLabel className="text-[#94a3b8]">Quick Filters</DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-[#1e2a45]" />
          {PRESET_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handlePresetChange(option.value)}
              className="flex flex-col items-start gap-1 py-2 text-[#e2e8f0] focus:bg-[#1e2a45] focus:text-[#e2e8f0] cursor-pointer"
            >
              <div className="flex items-center gap-2 w-full">
                {option.icon}
                <span className="font-medium">{option.label}</span>
                {filters.preset === option.value && (
                  <span className="ml-auto text-blue-400">&#10003;</span>
                )}
              </div>
              <span className="text-xs text-[#94a3b8] ml-6">{option.description}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearFilters}
          className="h-9 text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#1e2a45]"
        >
          <X className="h-4 w-4 mr-2" />
          Clear Filters
        </Button>
      )}
    </div>
  );
}

export default MapControls;
