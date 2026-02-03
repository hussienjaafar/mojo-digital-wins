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
      className="flex items-center gap-2 px-4 py-2 bg-[#0a0f1a]/95 backdrop-blur-md border-b border-[#1e2a45]"
      role="toolbar"
      aria-label="Map filter controls"
    >
      {/* Search Input */}
      <div className="relative flex-shrink-0 w-52">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748b]" aria-hidden="true" />
        <Input
          type="text"
          placeholder="Search districts..."
          value={filters.searchQuery}
          onChange={handleSearchChange}
          className="pl-9 h-9 bg-[#141b2d] border-[#1e2a45] rounded-lg text-[#e2e8f0] placeholder:text-[#64748b] focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
          aria-label="Search districts by name or code"
        />
      </div>

      <div className="h-6 w-px bg-[#1e2a45] mx-1" />

      {/* Party Filter Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`h-9 rounded-lg transition-all ${
              filters.party !== 'all'
                ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20'
                : 'bg-[#141b2d] border-[#1e2a45] text-[#e2e8f0] hover:bg-[#1e2a45]'
            }`}
            aria-label={`Filter by party, currently ${getPartyLabel(filters.party)}`}
          >
            <Filter className="h-4 w-4 mr-2" aria-hidden="true" />
            {getPartyLabel(filters.party)}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-[#0a0f1a]/95 backdrop-blur-md border-[#1e2a45] rounded-xl p-1">
          <DropdownMenuLabel className="text-[#64748b] text-xs uppercase tracking-wider px-3">Filter by Party</DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-[#1e2a45]" />
          {PARTY_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handlePartyChange(option.value)}
              className={`rounded-lg cursor-pointer mx-1 ${
                filters.party === option.value
                  ? 'bg-[#1e2a45] text-[#e2e8f0]'
                  : 'text-[#94a3b8] hover:bg-[#1e2a45]/50 hover:text-[#e2e8f0]'
              }`}
            >
              {option.label}
              {filters.party === option.value && (
                <span className="ml-auto w-2 h-2 rounded-full bg-blue-500" />
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
            className={`h-9 rounded-lg transition-all ${
              filters.impact !== 'all'
                ? 'bg-[#22c55e]/10 border-[#22c55e]/30 text-[#22c55e] hover:bg-[#22c55e]/20'
                : 'bg-[#141b2d] border-[#1e2a45] text-[#e2e8f0] hover:bg-[#1e2a45]'
            }`}
            aria-label={`Filter by impact level, currently ${getImpactLabel(filters.impact)}`}
          >
            <Zap className="h-4 w-4 mr-2" aria-hidden="true" />
            {getImpactLabel(filters.impact)}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-[#0a0f1a]/95 backdrop-blur-md border-[#1e2a45] rounded-xl p-1">
          <DropdownMenuLabel className="text-[#64748b] text-xs uppercase tracking-wider px-3">Filter by Impact</DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-[#1e2a45]" />
          {IMPACT_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleImpactChange(option.value)}
              className={`rounded-lg cursor-pointer mx-1 ${
                filters.impact === option.value
                  ? 'bg-[#1e2a45] text-[#e2e8f0]'
                  : 'text-[#94a3b8] hover:bg-[#1e2a45]/50 hover:text-[#e2e8f0]'
              }`}
            >
              {option.label}
              {filters.impact === option.value && (
                <span className="ml-auto w-2 h-2 rounded-full bg-[#22c55e]" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

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

      {/* Presets Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`h-9 rounded-lg transition-all ${
              filters.preset !== "none"
                ? "bg-[#a855f7]/10 border-[#a855f7]/30 text-[#a855f7] hover:bg-[#a855f7]/20"
                : "bg-[#141b2d] border-[#1e2a45] text-[#e2e8f0] hover:bg-[#1e2a45]"
            }`}
            aria-label={filters.preset !== "none" ? `Quick filter presets, 1 active` : "Quick filter presets"}
          >
            <Zap className="h-4 w-4 mr-2" aria-hidden="true" />
            Presets
            {filters.preset !== "none" && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-[#a855f7] text-white rounded-full font-medium" aria-hidden="true">
                1
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-80 bg-[#0a0f1a]/95 backdrop-blur-md border-[#1e2a45] rounded-xl p-1">
          <DropdownMenuLabel className="text-[#64748b] text-xs uppercase tracking-wider px-3">Quick Filters</DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-[#1e2a45]" />
          {PRESET_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handlePresetChange(option.value)}
              className={`flex flex-col items-start gap-1.5 py-3 px-3 rounded-lg cursor-pointer mx-1 my-0.5 transition-all ${
                filters.preset === option.value
                  ? "bg-[#a855f7]/10 border border-[#a855f7]/30"
                  : "hover:bg-[#1e2a45]/50"
              }`}
            >
              <div className="flex items-center gap-2.5 w-full">
                <div className={`p-1.5 rounded-md ${
                  filters.preset === option.value
                    ? "bg-[#a855f7]/20 text-[#a855f7]"
                    : "bg-[#1e2a45] text-[#64748b]"
                }`}>
                  {option.icon}
                </div>
                <span className={`font-medium ${
                  filters.preset === option.value ? "text-[#e2e8f0]" : "text-[#94a3b8]"
                }`}>{option.label}</span>
                {filters.preset === option.value && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-[#a855f7]" />
                )}
              </div>
              <span className="text-xs text-[#64748b] ml-8">{option.description}</span>
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
