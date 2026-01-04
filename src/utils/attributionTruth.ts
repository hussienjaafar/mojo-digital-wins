/**
 * ================================================================================
 * ATTRIBUTION TRUTH MAPPING - SINGLE SOURCE OF TRUTH
 * ================================================================================
 * 
 * This file defines what counts as "truth" for attribution KPI calculations.
 * ALL revenue, match rate, and campaign attribution totals MUST use these helpers
 * to ensure consistency across the entire application.
 * 
 * TRUTH DEFINITION:
 * =================
 * A mapping is considered "truth" (decision-grade) if it is:
 * 
 * 1. deterministic_url_refcode - Exact URL refcode match from Meta creative
 *    - is_deterministic: true, match_confidence: 1.0
 *    - Proven via ?refcode=XXX in ad destination URL
 * 
 * 2. manual_confirmed - Human-verified mapping
 *    - is_deterministic: false (not URL-based), but is_truth: true
 *    - Verified by admin/analyst clicking "Confirm" on a suggestion
 * 
 * EXCLUDED FROM TRUTH (heuristics):
 * ==================================
 * - heuristic_partial_url: Partial URL match
 * - heuristic_pattern: Pattern-based inference (meta_*, fb_*)
 * - heuristic_fuzzy: Fuzzy string similarity
 * - deterministic_refcode: Legacy type (non-URL, needs reclassification)
 * 
 * USAGE:
 * ======
 * import { isTruthMapping, filterTruthMappings } from '@/utils/attributionTruth';
 * 
 * // Check single row
 * if (isTruthMapping(attribution)) { ... }
 * 
 * // Filter array
 * const truthMappings = filterTruthMappings(allAttributions);
 * 
 * ================================================================================
 */

export interface AttributionRow {
  is_deterministic?: boolean | null;
  attribution_type?: string | null;
  match_confidence?: number | null;
}

/**
 * TRUTH TYPES - The only attribution types included in default KPI totals
 * 
 * DO NOT MODIFY without updating all consumers and documentation.
 */
export const TRUTH_ATTRIBUTION_TYPES = [
  'deterministic_url_refcode', // URL-proven matches
  'manual_confirmed',          // Human-verified mappings
] as const;

/**
 * HEURISTIC TYPES - Excluded from truth totals by default
 * 
 * These are "suggestions" that should be clearly labeled in UI
 * and NOT included in decision-grade KPIs.
 */
export const HEURISTIC_ATTRIBUTION_TYPES = [
  'heuristic_partial_url',
  'heuristic_pattern', 
  'heuristic_fuzzy',
  'deterministic_refcode', // Legacy type - treated as non-truth until reclassified
] as const;

/**
 * Determines if an attribution row should be counted as "truth"
 * for KPI calculations.
 * 
 * Truth = deterministic_url_refcode OR manual_confirmed
 * 
 * @param row - Attribution row with is_deterministic and attribution_type
 * @returns true if this row should be included in truth totals
 */
export function isTruthMapping(row: AttributionRow): boolean {
  const type = row.attribution_type;
  
  // CRITICAL: Only these two types are considered truth
  // - deterministic_url_refcode: URL-proven
  // - manual_confirmed: Human-verified
  return (
    type === 'deterministic_url_refcode' ||
    type === 'manual_confirmed'
  );
}

/**
 * Determines if an attribution row is a heuristic (suggestion)
 * that should be excluded from default KPIs.
 * 
 * @param row - Attribution row with attribution_type
 * @returns true if this is a heuristic/suggestion row
 */
export function isHeuristicMapping(row: AttributionRow): boolean {
  const type = row.attribution_type;
  
  return (
    type === 'heuristic_partial_url' ||
    type === 'heuristic_pattern' ||
    type === 'heuristic_fuzzy' ||
    type === 'deterministic_refcode' // Legacy type - not URL-proven
  );
}

/**
 * Filter an array of attribution rows to only include truth mappings.
 * Use this for calculating KPI totals.
 * 
 * @param rows - Array of attribution rows
 * @returns Only rows that pass isTruthMapping()
 */
export function filterTruthMappings<T extends AttributionRow>(rows: T[]): T[] {
  return rows.filter(isTruthMapping);
}

/**
 * Filter an array of attribution rows to only include heuristic mappings.
 * Use this for displaying suggestions in the UI.
 * 
 * @param rows - Array of attribution rows
 * @returns Only rows that are heuristics/suggestions
 */
export function filterHeuristicMappings<T extends AttributionRow>(rows: T[]): T[] {
  return rows.filter(isHeuristicMapping);
}

/**
 * Get a Set of refcodes that are truth mappings (lowercase normalized).
 * Use for filtering transactions to calculate matched revenue.
 * 
 * @param rows - Array of attribution rows with refcode field
 * @returns Set of lowercase refcodes that are truth mappings
 */
export function getTruthRefcodeSet(
  rows: Array<AttributionRow & { refcode?: string | null }>
): Set<string> {
  return new Set(
    rows
      .filter(isTruthMapping)
      .map(r => r.refcode?.toLowerCase())
      .filter((r): r is string => Boolean(r))
  );
}

/**
 * Calculate attribution statistics with explicit truth vs heuristic separation.
 * 
 * @param attributions - All attribution rows
 * @returns Counts for truth vs heuristic mappings
 */
export function calculateAttributionCounts(
  attributions: AttributionRow[]
): {
  truthCount: number;
  heuristicCount: number;
  totalCount: number;
  truthTypes: Record<string, number>;
  heuristicTypes: Record<string, number>;
} {
  const truthMappings = filterTruthMappings(attributions);
  const heuristicMappings = filterHeuristicMappings(attributions);
  
  // Count by type
  const truthTypes: Record<string, number> = {};
  for (const row of truthMappings) {
    const type = row.attribution_type || 'unknown';
    truthTypes[type] = (truthTypes[type] || 0) + 1;
  }
  
  const heuristicTypes: Record<string, number> = {};
  for (const row of heuristicMappings) {
    const type = row.attribution_type || 'unknown';
    heuristicTypes[type] = (heuristicTypes[type] || 0) + 1;
  }
  
  return {
    truthCount: truthMappings.length,
    heuristicCount: heuristicMappings.length,
    totalCount: attributions.length,
    truthTypes,
    heuristicTypes,
  };
}
