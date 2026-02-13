/**
 * Voter Impact Map Types and Utilities
 *
 * Types and utility functions for the Muslim Voter Population Heatmap.
 */

import type {
  VoterImpactState,
  VoterImpactDistrict,
} from "@/queries/useVoterImpactQueries";

// ============================================================================
// Metric Types
// ============================================================================

export type MetricType = "population" | "donors" | "activists" | "turnout";

// ============================================================================
// Metric Configuration
// ============================================================================

export interface ColorStop {
  threshold: number;
  color: string;
  label: string;
}

export interface MetricConfig {
  key: MetricType;
  label: string;
  shortLabel: string;
  stateField: string;
  districtField: string | null;
  format: "number" | "percentage";
  colorStops: readonly ColorStop[];
}

export const POPULATION_COLOR_STOPS: readonly ColorStop[] = [
  { threshold: 0, color: "#0a0a1a", label: "0" },
  { threshold: 500, color: "#0d2847", label: "500" },
  { threshold: 2000, color: "#0f4c75", label: "2K" },
  { threshold: 5000, color: "#1277a8", label: "5K" },
  { threshold: 10000, color: "#15a2c2", label: "10K" },
  { threshold: 25000, color: "#22c7a0", label: "25K" },
  { threshold: 50000, color: "#4ae08a", label: "50K" },
  { threshold: 100000, color: "#8ef06e", label: "100K" },
  { threshold: 200000, color: "#c8f74d", label: "200K" },
  { threshold: 500000, color: "#f9f535", label: "500K" },
];

const DONORS_COLOR_STOPS: readonly ColorStop[] = [
  { threshold: 0, color: "#0a0a1a", label: "0" },
  { threshold: 100, color: "#0d2847", label: "100" },
  { threshold: 500, color: "#0f4c75", label: "500" },
  { threshold: 2000, color: "#1277a8", label: "2K" },
  { threshold: 5000, color: "#15a2c2", label: "5K" },
  { threshold: 10000, color: "#22c7a0", label: "10K" },
  { threshold: 25000, color: "#4ae08a", label: "25K" },
  { threshold: 50000, color: "#8ef06e", label: "50K" },
  { threshold: 86000, color: "#f9f535", label: "86K" },
] as const;

const ACTIVISTS_COLOR_STOPS: readonly ColorStop[] = [
  { threshold: 0, color: "#0a0a1a", label: "0" },
  { threshold: 10, color: "#0d2847", label: "10" },
  { threshold: 50, color: "#0f4c75", label: "50" },
  { threshold: 100, color: "#1277a8", label: "100" },
  { threshold: 250, color: "#15a2c2", label: "250" },
  { threshold: 500, color: "#22c7a0", label: "500" },
  { threshold: 1000, color: "#4ae08a", label: "1K" },
  { threshold: 2000, color: "#8ef06e", label: "2K" },
  { threshold: 3000, color: "#f9f535", label: "3K" },
] as const;

const TURNOUT_COLOR_STOPS: readonly ColorStop[] = [
  { threshold: 0, color: "#0a0a1a", label: "0%" },
  { threshold: 0.05, color: "#0d2847", label: "5%" },
  { threshold: 0.15, color: "#0f4c75", label: "15%" },
  { threshold: 0.25, color: "#1277a8", label: "25%" },
  { threshold: 0.35, color: "#15a2c2", label: "35%" },
  { threshold: 0.45, color: "#22c7a0", label: "45%" },
  { threshold: 0.55, color: "#4ae08a", label: "55%" },
  { threshold: 0.65, color: "#8ef06e", label: "65%" },
  { threshold: 0.75, color: "#f9f535", label: "75%" },
] as const;

export const METRIC_CONFIGS: Record<MetricType, MetricConfig> = {
  population: {
    key: "population",
    label: "Muslim Voters",
    shortLabel: "Population",
    stateField: "muslim_voters",
    districtField: "muslim_voters",
    format: "number",
    colorStops: POPULATION_COLOR_STOPS,
  },
  donors: {
    key: "donors",
    label: "Political Donors",
    shortLabel: "Donors",
    stateField: "political_donors",
    districtField: null,
    format: "number",
    colorStops: DONORS_COLOR_STOPS,
  },
  activists: {
    key: "activists",
    label: "Political Activists",
    shortLabel: "Activists",
    stateField: "political_activists",
    districtField: null,
    format: "number",
    colorStops: ACTIVISTS_COLOR_STOPS,
  },
  turnout: {
    key: "turnout",
    label: "2024 Turnout",
    shortLabel: "Turnout %",
    stateField: "vote_2024_pct",
    districtField: "turnout_pct",
    format: "percentage",
    colorStops: TURNOUT_COLOR_STOPS,
  },
};

export function getColorStopsForMetric(metric: MetricType): readonly ColorStop[] {
  return METRIC_CONFIGS[metric].colorStops;
}

export function getMetricLabel(metric: MetricType): string {
  return METRIC_CONFIGS[metric].label;
}

export function formatMetricValue(value: number, metric: MetricType): string {
  if (METRIC_CONFIGS[metric].format === "percentage") {
    return `${(value * 100).toFixed(1)}%`;
  }
  return value.toLocaleString();
}

// ============================================================================
// Filter Types
// ============================================================================

export interface MapFilters {
  minVoters: number;
  searchQuery: string;
}

export interface RegionSelection {
  type: "state" | "district";
  id: string;
  data: VoterImpactState | VoterImpactDistrict;
}

export interface ComparisonItem {
  type: "state" | "district";
  id: string;
  data: VoterImpactState | VoterImpactDistrict;
}

export interface MapViewState {
  longitude: number;
  latitude: number;
  zoom: number;
}

// (POPULATION_COLOR_STOPS moved above METRIC_CONFIGS)

/**
 * Get color for a given Muslim voter population count.
 * Uses linear interpolation between the defined color stops.
 */
export function getPopulationColor(count: number): string {
  const stops = POPULATION_COLOR_STOPS;
  if (count <= 0) return stops[0].color;
  if (count >= stops[stops.length - 1].threshold) return stops[stops.length - 1].color;

  for (let i = 0; i < stops.length - 1; i++) {
    if (count >= stops[i].threshold && count < stops[i + 1].threshold) {
      return stops[i].color;
    }
  }
  return stops[stops.length - 1].color;
}

// ============================================================================
// Legacy Constants (kept for sidebar compatibility)
// ============================================================================

export const IMPACT_THRESHOLDS = {
  HIGH: 0.15,
  MEDIUM: 0.07,
  LOW: 0.02,
} as const;

export const IMPACT_COLORS = {
  HIGH: "#2563eb",
  MEDIUM: "#f97316",
  LOW: "#9333ea",
  NONE: "#6b7280",
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

export function calculateImpactScore(district: VoterImpactDistrict): number {
  if (district.can_impact === false) return 0;
  if (!district.muslim_voters || district.muslim_voters === 0) return 0;
  if (!district.margin_votes || district.margin_votes <= 0) return 0;
  const mobilizable = district.didnt_vote_2024 || 0;
  if (mobilizable === 0) return 0;
  const surplusRatio = mobilizable / district.margin_votes;
  if (surplusRatio >= 1) {
    const surplus = Math.min(surplusRatio - 1, 9);
    return Math.min(1, 0.5 + surplus * 0.055);
  }
  return surplusRatio * 0.5;
}

export function calculateStateImpactScore(
  state: VoterImpactState,
  districts: VoterImpactDistrict[]
): number {
  if (!state.muslim_voters || state.muslim_voters === 0) return 0;
  const districtsWithData = districts.filter(
    (d) => d.muslim_voters > 0 && d.margin_votes && d.margin_votes > 0
  );
  if (districtsWithData.length === 0) {
    const turnout2024 = state.vote_2024_pct || 0;
    const turnoutGap = Math.max(0, 1 - turnout2024);
    const populationScore = Math.min(1, state.muslim_voters / 100000);
    return Math.min(1, populationScore * (0.4 + turnoutGap * 0.5));
  }
  const flippableDistricts = districtsWithData.filter((d) => {
    const mobilizable = d.didnt_vote_2024 || 0;
    return mobilizable >= (d.margin_votes || Infinity);
  });
  const flippableRatio = flippableDistricts.length / districtsWithData.length;
  let totalWeight = 0;
  let weightedSum = 0;
  for (const district of districtsWithData) {
    const districtImpact = calculateImpactScore(district);
    const weight = district.muslim_voters;
    weightedSum += districtImpact * weight;
    totalWeight += weight;
  }
  const avgDistrictImpact = totalWeight > 0 ? weightedSum / totalWeight : 0;
  return Math.min(1, flippableRatio * 0.2 + avgDistrictImpact * 0.8);
}

export function getImpactColor(score: number): string {
  if (score >= IMPACT_THRESHOLDS.HIGH) return IMPACT_COLORS.HIGH;
  if (score >= IMPACT_THRESHOLDS.MEDIUM) return IMPACT_COLORS.MEDIUM;
  if (score >= IMPACT_THRESHOLDS.LOW) return IMPACT_COLORS.LOW;
  return IMPACT_COLORS.NONE;
}

/**
 * Apply filters to districts (simplified for population view)
 */
export function applyFilters(
  districts: VoterImpactDistrict[],
  filters: MapFilters
): VoterImpactDistrict[] {
  let result = [...districts];

  if (filters.minVoters > 0) {
    result = result.filter((d) => d.muslim_voters >= filters.minVoters);
  }

  if (filters.searchQuery.trim()) {
    const query = filters.searchQuery.toLowerCase().trim();
    result = result.filter(
      (d) =>
        d.cd_code.toLowerCase().includes(query) ||
        d.state_code.toLowerCase().includes(query)
    );
  }

  return result;
}

// ============================================================================
// Default Values
// ============================================================================

export const DEFAULT_MAP_FILTERS: MapFilters = {
  minVoters: 0,
  searchQuery: "",
};

export const DEFAULT_MAP_VIEW_STATE: MapViewState = {
  longitude: -98.5795,
  latitude: 39.8283,
  zoom: 4,
};
