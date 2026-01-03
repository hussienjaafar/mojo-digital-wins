/**
 * V3 Donut Chart Data Preprocessing Utilities
 * Handles Top N + Other aggregation, label normalization, and stable colors
 */

import { getChartColors } from "@/lib/design-tokens";

export interface DonutDataItem {
  name: string;
  value: number;
  color?: string;
  rawCount?: number;
}

export interface ProcessedDonutData {
  items: DonutDataItem[];
  total: number;
  otherCount: number;
  hasOther: boolean;
}

// Stable color mapping based on category name hash
const colorPalette = getChartColors();

/**
 * Generate a stable hash for a string to ensure consistent color assignment
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Get a stable color for a category name
 * Ensures the same category always gets the same color across renders
 */
export function getStableColor(name: string, index: number): string {
  // Special colors for known categories
  const specialColors: Record<string, string> = {
    'other': 'hsl(var(--portal-text-muted) / 0.4)',
    'not provided': 'hsl(var(--portal-text-muted) / 0.3)',
    'unknown': 'hsl(var(--portal-text-muted) / 0.3)',
    'n/a': 'hsl(var(--portal-text-muted) / 0.3)',
  };

  const lowerName = name.toLowerCase().trim();
  if (specialColors[lowerName]) {
    return specialColors[lowerName];
  }

  // Use hash for deterministic color selection
  const hash = hashString(lowerName);
  return colorPalette[hash % colorPalette.length];
}

/**
 * Normalize a label string for consistent display
 * - Trims whitespace
 * - Converts to Title Case
 * - Handles common variations
 */
export function normalizeLabel(label: string | null | undefined): string {
  if (!label || typeof label !== 'string') return 'Not Provided';
  
  const trimmed = label.trim();
  if (!trimmed || trimmed.toLowerCase() === 'null' || trimmed === '-') {
    return 'Not Provided';
  }

  // Handle common variations that should be merged
  const lowerTrimmed = trimmed.toLowerCase();
  
  // Employment status normalization
  if (lowerTrimmed.includes('not employed') || lowerTrimmed === 'unemployed') {
    return 'Not Employed';
  }
  if (lowerTrimmed.includes('self-employed') || lowerTrimmed.includes('self employed')) {
    return 'Self-Employed';
  }
  if (lowerTrimmed === 'retired' || lowerTrimmed === 'retiree') {
    return 'Retired';
  }

  // Convert to Title Case
  return trimmed
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Merge duplicate entries with normalized labels
 */
export function mergeNormalizedDuplicates(data: DonutDataItem[]): DonutDataItem[] {
  const merged = new Map<string, DonutDataItem>();

  for (const item of data) {
    const normalizedName = normalizeLabel(item.name);
    const existing = merged.get(normalizedName);
    
    if (existing) {
      existing.value += item.value;
      if (item.rawCount && existing.rawCount) {
        existing.rawCount += item.rawCount;
      }
    } else {
      merged.set(normalizedName, {
        ...item,
        name: normalizedName,
      });
    }
  }

  return Array.from(merged.values());
}

export interface ProcessDonutDataOptions {
  /** Maximum number of slices to show (excluding "Other") */
  topN?: number;
  /** Whether to include "Not Provided" entries */
  includeNotProvided?: boolean;
  /** Minimum value threshold to include */
  minValue?: number;
  /** Minimum percentage threshold to include (0-100) */
  minPercent?: number;
  /** Custom sort function */
  sortFn?: (a: DonutDataItem, b: DonutDataItem) => number;
  /** Whether to merge duplicates with normalized labels */
  mergeDuplicates?: boolean;
}

/**
 * Process raw data for donut chart display
 * - Normalizes labels
 * - Merges duplicates
 * - Sorts by value
 * - Aggregates small slices into "Other"
 * - Assigns stable colors
 */
export function processDonutData(
  rawData: DonutDataItem[],
  options: ProcessDonutDataOptions = {}
): ProcessedDonutData {
  const {
    topN = 6,
    includeNotProvided = false,
    minValue = 0,
    minPercent = 0,
    sortFn = (a, b) => b.value - a.value,
    mergeDuplicates = true,
  } = options;

  if (!rawData || rawData.length === 0) {
    return { items: [], total: 0, otherCount: 0, hasOther: false };
  }

  // Step 1: Filter out invalid entries
  let processed = rawData.filter(item => 
    item.value > minValue && 
    item.name !== null && 
    item.name !== undefined
  );

  // Step 2: Merge duplicates if enabled
  if (mergeDuplicates) {
    processed = mergeNormalizedDuplicates(processed);
  }

  // Step 3: Filter "Not Provided" if requested
  if (!includeNotProvided) {
    processed = processed.filter(item => {
      const lower = item.name.toLowerCase();
      return !['not provided', 'unknown', 'n/a', 'null'].includes(lower);
    });
  }

  // Step 4: Calculate total before filtering by percent
  const total = processed.reduce((sum, item) => sum + item.value, 0);

  // Step 5: Filter by minimum percentage
  if (minPercent > 0 && total > 0) {
    processed = processed.filter(item => 
      (item.value / total) * 100 >= minPercent
    );
  }

  // Step 6: Sort
  processed.sort(sortFn);

  // Step 7: Take top N and aggregate rest into "Other"
  let topItems: DonutDataItem[];
  let otherValue = 0;
  let otherCount = 0;

  if (processed.length > topN) {
    topItems = processed.slice(0, topN);
    const otherItems = processed.slice(topN);
    otherValue = otherItems.reduce((sum, item) => sum + item.value, 0);
    otherCount = otherItems.length;
  } else {
    topItems = processed;
  }

  // Step 8: Assign stable colors
  const coloredItems = topItems.map((item, index) => ({
    ...item,
    color: item.color || getStableColor(item.name, index),
  }));

  // Step 9: Add "Other" if needed
  if (otherValue > 0) {
    coloredItems.push({
      name: 'Other',
      value: otherValue,
      color: getStableColor('other', coloredItems.length),
      rawCount: otherCount,
    });
  }

  return {
    items: coloredItems,
    total,
    otherCount,
    hasOther: otherValue > 0,
  };
}

/**
 * Format a donut slice for display in legend
 */
export function formatLegendItem(
  name: string,
  value: number,
  total: number,
  valueFormatter: (v: number) => string
): string {
  const percent = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
  return `${name}: ${valueFormatter(value)} (${percent}%)`;
}

/**
 * Get rank suffix (1st, 2nd, 3rd, etc.)
 */
export function getRankSuffix(rank: number): string {
  const j = rank % 10;
  const k = rank % 100;
  
  if (j === 1 && k !== 11) return `${rank}st`;
  if (j === 2 && k !== 12) return `${rank}nd`;
  if (j === 3 && k !== 13) return `${rank}rd`;
  return `${rank}th`;
}
