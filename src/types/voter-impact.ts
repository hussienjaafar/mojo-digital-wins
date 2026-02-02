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
 * Calculate district impact score based on "flippability"
 *
 * Core concept: surplus_ratio = mobilizable_muslims / election_margin
 * - ratio >= 1: Muslims could flip this district
 * - ratio < 1: Muslims can influence but not flip
 *
 * Score interpretation:
 * - 0.5-1.0: HIGH - Muslims significantly exceed margin, highly flippable
 * - 0.25-0.5: MEDIUM - Muslims can flip with strong mobilization
 * - 0.05-0.25: LOW - Some influence but unlikely to flip
 * - 0.0-0.05: MINIMAL - Safe district, margin too large
 */
export function calculateImpactScore(district: VoterImpactDistrict): number {
  // Respect database's authoritative can_impact determination
  // If the DB says the district can't be flipped, return 0
  if (district.can_impact === false) {
    return 0;
  }

  // No Muslim voters = no impact
  if (!district.muslim_voters || district.muslim_voters === 0) {
    return 0;
  }

  // No margin data = can't calculate flippability
  if (!district.margin_votes || district.margin_votes <= 0) {
    return 0;
  }

  // Mobilizable pool = Muslims who didn't vote in 2024
  // This includes both registered non-voters AND unregistered Muslims
  const mobilizable = district.didnt_vote_2024 || 0;

  if (mobilizable === 0) {
    return 0;
  }

  // Surplus ratio: How many times over can Muslims cover the margin?
  const surplusRatio = mobilizable / district.margin_votes;

  if (surplusRatio >= 1) {
    // CAN FLIP: Mobilizable Muslims exceed the election margin
    // Score ranges from 0.5 to 1.0 based on surplus
    // More surplus = easier to achieve = higher score
    // Cap the surplus benefit (diminishing returns after 10x margin)
    const surplus = Math.min(surplusRatio - 1, 9); // Cap at 10x
    return Math.min(1, 0.5 + surplus * 0.055);
  } else {
    // CAN'T FLIP: Not enough Muslims to overcome margin
    // But still has proportional influence
    // Score ranges from 0 to 0.5
    return surplusRatio * 0.5;
  }
}

/**
 * Calculate state-level impact score
 *
 * Based on:
 * 1. Number of flippable districts (where Muslims exceed margin)
 * 2. Weighted average of district impacts
 *
 * For at-large states with no district data, uses state-level turnout gap
 */
export function calculateStateImpactScore(
  state: VoterImpactState,
  districts: VoterImpactDistrict[]
): number {
  // No Muslim voters = no impact
  if (!state.muslim_voters || state.muslim_voters === 0) {
    return 0;
  }

  // For at-large states with no district data, use state-level metrics
  const districtsWithData = districts.filter(
    (d) => d.muslim_voters > 0 && d.margin_votes && d.margin_votes > 0
  );

  if (districtsWithData.length === 0) {
    // Fallback for at-large states without district-level data
    // Use turnout gap and population as proxy for mobilization potential
    const turnout2024 = state.vote_2024_pct || 0;
    const turnoutGap = Math.max(0, 1 - turnout2024);
    // Scale: 50k voters = 0.5 base score, 100k+ = 1.0
    const populationScore = Math.min(1, state.muslim_voters / 100000);
    // Combine population with turnout gap for reasonable fallback score
    return Math.min(1, populationScore * (0.4 + turnoutGap * 0.5));
  }

  // Count flippable districts (where mobilizable Muslims >= margin)
  const flippableDistricts = districtsWithData.filter((d) => {
    const mobilizable = d.didnt_vote_2024 || 0;
    return mobilizable >= (d.margin_votes || Infinity);
  });

  const flippableRatio = flippableDistricts.length / districtsWithData.length;

  // Calculate weighted average of district impacts (weighted by Muslim population)
  let totalWeight = 0;
  let weightedSum = 0;

  for (const district of districtsWithData) {
    const districtImpact = calculateImpactScore(district);
    const weight = district.muslim_voters;
    weightedSum += districtImpact * weight;
    totalWeight += weight;
  }

  const avgDistrictImpact = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // Final score: prioritize weighted district impact over flippable ratio
  // This ensures states with high-influence (but not quite flippable) districts 
  // still show meaningful scores
  return Math.min(1, flippableRatio * 0.2 + avgDistrictImpact * 0.8);
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
