/**
 * Voter Impact Map Types and Utilities
 *
 * Types and utility functions for the Muslim Voter Impact Map visualization.
 */

import type {
  VoterImpactState,
  VoterImpactDistrict,
} from "@/queries/useVoterImpactQueries";

// ============================================================================
// Metric Types
// ============================================================================

export type MetricType = "impact" | "population" | "untapped" | "turnout";

// ============================================================================
// Filter Types
// ============================================================================

export type PartyFilter = "all" | "democrat" | "republican" | "close";
export type ImpactFilter = "all" | "high" | "can-impact" | "no-impact";
export type PresetFilter =
  | "none"
  | "swing"
  | "high-roi"
  | "low-turnout"
  | "top-population";

// ============================================================================
// Interfaces
// ============================================================================

export interface MapFilters {
  party: PartyFilter;
  impact: ImpactFilter;
  minVoters: number;
  preset: PresetFilter;
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

// ============================================================================
// Constants
// ============================================================================

/** Population normalization constant for impact score calculation */
const POPULATION_NORMALIZATION = 50000;

/** Margin multiplier for impact score calculation */
const MARGIN_MULTIPLIER = 10;

/** Weight for margin in impact score calculation */
const WEIGHT_MARGIN = 0.4;

/** Weight for population in impact score calculation */
const WEIGHT_POPULATION = 0.3;

/** Weight for turnout gap in impact score calculation */
const WEIGHT_TURNOUT = 0.3;

/** Threshold for close race margin percentage */
const CLOSE_RACE_THRESHOLD = 0.05;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate impact score for a district (0-1 scale)
 *
 * Score is based on:
 * - 0 if can_impact is false
 * - Higher score for close margins (multiply margin_pct by 10, subtract from 1)
 * - Higher score for larger muslim population (normalize to 50k)
 * - Higher score for low turnout (1 - turnout_pct)
 * - Weighted: margin 40%, population 30%, turnout gap 30%
 */
export function calculateImpactScore(district: VoterImpactDistrict): number {
  // Calculate base score regardless of can_impact flag
  // The can_impact flag will boost the score, not eliminate it

  // Margin score: closer margins = higher score
  // margin_pct is stored as decimal (e.g., 0.05 for 5%)
  const marginPct = district.margin_pct ?? 1;
  const marginScore = Math.max(0, 1 - marginPct * MARGIN_MULTIPLIER);

  // Population score: larger Muslim population = higher score
  // Normalize to 50k (populations >= 50k get score of 1)
  const populationScore = Math.min(
    1,
    district.muslim_voters / POPULATION_NORMALIZATION
  );

  // Turnout gap score: lower turnout = higher opportunity
  // turnout_pct is stored as decimal (e.g., 0.6 for 60%)
  const turnoutScore = 1 - (district.turnout_pct ?? 1);

  // Calculate weighted score
  let score =
    marginScore * WEIGHT_MARGIN +
    populationScore * WEIGHT_POPULATION +
    turnoutScore * WEIGHT_TURNOUT;

  // If can_impact is true, boost the score by 20% for strategic importance
  if (district.can_impact) {
    score = Math.min(1, score * 1.2);
  }

  // Clamp to 0-1 range
  return Math.max(0, Math.min(1, score));
}

/**
 * Calculate aggregate impact score for a state
 *
 * Returns the average of impact scores for all districts in the state.
 * Returns 0 if no districts are provided.
 */
export function calculateStateImpactScore(
  _state: VoterImpactState,
  districts: VoterImpactDistrict[]
): number {
  if (districts.length === 0) {
    return 0;
  }

  const totalScore = districts.reduce(
    (sum, district) => sum + calculateImpactScore(district),
    0
  );

  return totalScore / districts.length;
}

/**
 * Get color for impact score visualization
 *
 * Color scale:
 * - score <= 0: gray (#374151) - no impact
 * - score < 0.33: red (#ef4444) - low impact
 * - score < 0.66: yellow (#eab308) - medium impact
 * - score >= 0.66: green (#22c55e) - high impact
 */
export function getImpactColor(score: number): string {
  if (score <= 0) {
    return "#374151"; // gray-700
  }
  if (score < 0.33) {
    return "#ef4444"; // red-500
  }
  if (score < 0.66) {
    return "#eab308"; // yellow-500
  }
  return "#22c55e"; // green-500
}

/**
 * Apply filters to an array of districts
 *
 * Filters based on:
 * - party: filter by winner party or close races
 * - impact: filter by impact potential
 * - minVoters: minimum Muslim voter population
 * - preset: predefined filter combinations
 * - searchQuery: text search on district/state codes
 */
export function applyFilters(
  districts: VoterImpactDistrict[],
  filters: MapFilters
): VoterImpactDistrict[] {
  let result = [...districts];

  // Apply party filter
  if (filters.party !== "all") {
    if (filters.party === "close") {
      // Close races: margin < 5%
      result = result.filter(
        (d) =>
          d.margin_pct !== null && d.margin_pct < CLOSE_RACE_THRESHOLD
      );
    } else {
      // Filter by winning party
      const partyCode = filters.party === "democrat" ? "D" : "R";
      result = result.filter((d) => d.winner_party === partyCode);
    }
  }

  // Apply impact filter
  if (filters.impact !== "all") {
    if (filters.impact === "can-impact") {
      result = result.filter((d) => d.can_impact);
    } else if (filters.impact === "no-impact") {
      result = result.filter((d) => !d.can_impact);
    } else if (filters.impact === "high") {
      // High impact: score >= 0.66
      result = result.filter((d) => calculateImpactScore(d) >= 0.66);
    }
  }

  // Apply minimum voters filter
  if (filters.minVoters > 0) {
    result = result.filter((d) => d.muslim_voters >= filters.minVoters);
  }

  // Apply preset filters
  if (filters.preset !== "none") {
    switch (filters.preset) {
      case "swing":
        // Swing districts: close races that can be impacted
        result = result.filter(
          (d) =>
            d.can_impact &&
            d.margin_pct !== null &&
            d.margin_pct < CLOSE_RACE_THRESHOLD
        );
        break;
      case "high-roi":
        // High ROI: low cost estimate relative to votes needed
        result = result
          .filter((d) => d.can_impact && d.cost_estimate !== null)
          .sort((a, b) => (a.cost_estimate ?? 0) - (b.cost_estimate ?? 0));
        break;
      case "low-turnout":
        // Low turnout: turnout < 50%
        result = result.filter((d) => d.turnout_pct < 0.5);
        break;
      case "top-population":
        // Top population: sort by Muslim voter population descending
        result = result.sort((a, b) => b.muslim_voters - a.muslim_voters);
        break;
    }
  }

  // Apply search query
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
  party: "all",
  impact: "all",
  minVoters: 0,
  preset: "none",
  searchQuery: "",
};

export const DEFAULT_MAP_VIEW_STATE: MapViewState = {
  longitude: -98.5795,
  latitude: 39.8283,
  zoom: 4,
};
