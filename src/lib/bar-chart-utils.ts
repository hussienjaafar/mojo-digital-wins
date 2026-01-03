/**
 * Bar Chart Data Preprocessing Utilities
 * Provides sorting, Top N + Other, label truncation, and ranking
 */

export interface BarDataItem {
  name: string;
  value: number;
  [key: string]: unknown;
}

export interface ProcessedBarData {
  items: BarDataItem[];
  otherItem: BarDataItem | null;
  maxValue: number;
  totalValue: number;
  hasOtherDominating: boolean;
}

export interface BarChartProcessOptions {
  /** Maximum number of items to show before grouping into "Other" */
  topN?: number;
  /** Minimum value to include (items below this go to Other) */
  minValue?: number;
  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
  /** Key to use for value (default: 'value') */
  valueKey?: string;
  /** Key to use for name (default: 'name') */
  nameKey?: string;
  /** Label for "Other" category */
  otherLabel?: string;
  /** Whether to include items with zero value */
  includeZero?: boolean;
}

/**
 * Process bar chart data with sorting, Top N, and Other grouping
 */
export function processBarChartData<T extends Record<string, unknown>>(
  data: T[],
  options: BarChartProcessOptions = {}
): ProcessedBarData {
  const {
    topN = 10,
    sortDirection = 'desc',
    valueKey = 'value',
    nameKey = 'name',
    otherLabel = 'Other',
    includeZero = false,
  } = options;

  // Filter and map to standard format
  const items: BarDataItem[] = data
    .filter(item => {
      const value = Number(item[valueKey]) || 0;
      return includeZero || value > 0;
    })
    .map(item => ({
      ...item,
      name: String(item[nameKey] || 'Unknown'),
      value: Number(item[valueKey]) || 0,
    }));

  // Sort by value
  const sorted = [...items].sort((a, b) => {
    return sortDirection === 'desc' ? b.value - a.value : a.value - b.value;
  });

  // Calculate totals
  const totalValue = sorted.reduce((sum, item) => sum + item.value, 0);
  const maxValue = sorted.length > 0 ? Math.max(...sorted.map(i => i.value)) : 0;

  // Split into top N and rest
  const topItems = sorted.slice(0, topN);
  const restItems = sorted.slice(topN);

  // Create "Other" category if there are remaining items
  let otherItem: BarDataItem | null = null;
  if (restItems.length > 0) {
    const otherValue = restItems.reduce((sum, item) => sum + item.value, 0);
    otherItem = {
      name: otherLabel,
      value: otherValue,
      _isOther: true,
      _itemCount: restItems.length,
    };
  }

  // Check if "Other" dominates (more than 50% of total)
  const hasOtherDominating = otherItem !== null && otherItem.value > totalValue * 0.5;

  return {
    items: topItems,
    otherItem,
    maxValue,
    totalValue,
    hasOtherDominating,
  };
}

/**
 * Truncate label with ellipsis
 */
export function truncateLabel(label: string, maxLength: number = 12): string {
  if (label.length <= maxLength) return label;
  return label.slice(0, maxLength - 1) + '…';
}

/**
 * Create a label formatter with truncation
 */
export function createLabelFormatter(maxLength: number = 12): (value: string) => string {
  return (value: string) => truncateLabel(value, maxLength);
}

/**
 * Get rank suffix (1st, 2nd, 3rd, etc.)
 */
export function getRankSuffix(rank: number): string {
  if (rank % 100 >= 11 && rank % 100 <= 13) return 'th';
  switch (rank % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

/**
 * Format rank display
 */
export function formatRank(rank: number): string {
  return `#${rank}`;
}

/**
 * Calculate percent of total
 */
export function calculatePercentOfTotal(value: number, total: number): number {
  return total > 0 ? (value / total) * 100 : 0;
}

/**
 * Normalize category names for consistency
 */
export function normalizeCategory(name: string): string {
  if (!name || name.trim() === '') return 'Unknown';
  
  // Common "not provided" variations
  const notProvidedPatterns = [
    /^not\s*provided$/i,
    /^n\/?a$/i,
    /^unknown$/i,
    /^none$/i,
    /^-$/,
    /^null$/i,
    /^undefined$/i,
  ];
  
  for (const pattern of notProvidedPatterns) {
    if (pattern.test(name.trim())) {
      return 'Not Provided';
    }
  }
  
  return name.trim();
}

/**
 * Merge duplicate categories (case-insensitive)
 */
export function mergeDuplicateCategories<T extends Record<string, unknown>>(
  data: T[],
  nameKey: string = 'name',
  valueKey: string = 'value'
): T[] {
  const merged = new Map<string, T>();
  
  for (const item of data) {
    const rawName = String(item[nameKey] || '');
    const normalizedName = normalizeCategory(rawName).toLowerCase();
    
    if (merged.has(normalizedName)) {
      const existing = merged.get(normalizedName)!;
      const existingValue = Number(existing[valueKey]) || 0;
      const newValue = Number(item[valueKey]) || 0;
      merged.set(normalizedName, {
        ...existing,
        [valueKey]: existingValue + newValue,
      });
    } else {
      merged.set(normalizedName, {
        ...item,
        [nameKey]: normalizeCategory(rawName),
      });
    }
  }
  
  return Array.from(merged.values());
}
