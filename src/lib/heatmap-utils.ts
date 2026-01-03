/**
 * Heatmap Data Preprocessing Utilities
 * Provides consistent data transformation for 7x24 time heatmaps
 */

export type HeatmapMetric = 'revenue' | 'count' | 'unique_donors';

export interface HeatmapDataPoint {
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  hour: number; // 0-23
  value: number;
  count?: number;
  uniqueDonors?: number;
}

export interface ProcessedHeatmapData {
  grid: HeatmapDataPoint[];
  maxValue: number;
  totalValue: number;
  peakCells: RankedCell[];
  hasData: boolean;
  p95Value: number;
}

export interface RankedCell {
  dayOfWeek: number;
  hour: number;
  value: number;
  rank: number;
  percentOfTotal: number;
}

// Day labels (Sunday = 0)
export const DAY_LABELS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const DAY_LABELS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

// Hour labels with reduced density for axes
export const HOUR_LABELS_SHORT = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? '12a' : i < 12 ? `${i}a` : i === 12 ? '12p' : `${i - 12}p`
);

export const HOUR_LABELS_FULL = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`
);

// Tick-reduced labels (every 3 hours)
export const HOUR_LABELS_REDUCED = ['12a', '', '', '3a', '', '', '6a', '', '', '9a', '', '', '12p', '', '', '3p', '', '', '6p', '', '', '9p', '', ''];

/**
 * Get human-friendly time description
 */
export function formatTimeSlot(dayOfWeek: number, hour: number): string {
  return `${DAY_LABELS_FULL[dayOfWeek]} at ${HOUR_LABELS_FULL[hour]}`;
}

/**
 * Get short time description for chips
 */
export function formatTimeSlotShort(dayOfWeek: number, hour: number): string {
  return `${DAY_LABELS_SHORT[dayOfWeek]} ${HOUR_LABELS_SHORT[hour]}`;
}

/**
 * Initialize a complete 7x24 grid with zeros
 */
export function initializeGrid(): HeatmapDataPoint[] {
  const grid: HeatmapDataPoint[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      grid.push({ dayOfWeek: day, hour, value: 0 });
    }
  }
  return grid;
}

/**
 * Transform raw RPC data into a complete 7x24 grid
 */
export function normalizeHeatmapData(
  rawData: Array<{ day_of_week: number; hour: number; value: number | null; count?: number; unique_donors?: number }> | null | undefined
): HeatmapDataPoint[] {
  const grid = initializeGrid();
  const lookup = new Map<string, HeatmapDataPoint>();
  
  // Index grid by key
  grid.forEach(point => {
    lookup.set(`${point.dayOfWeek}-${point.hour}`, point);
  });
  
  // Fill in actual values
  rawData?.forEach(row => {
    const key = `${row.day_of_week}-${row.hour}`;
    const point = lookup.get(key);
    if (point) {
      point.value = Number(row.value) || 0;
      if (row.count !== undefined) point.count = row.count;
      if (row.unique_donors !== undefined) point.uniqueDonors = row.unique_donors;
    }
  });
  
  return grid;
}

/**
 * Calculate p95 value to cap outliers for better color distribution
 */
export function calculateP95(values: number[]): number {
  const sorted = values.filter(v => v > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return 1;
  const p95Index = Math.floor(sorted.length * 0.95);
  return sorted[Math.min(p95Index, sorted.length - 1)] || 1;
}

/**
 * Get ranked cells sorted by value (descending)
 */
export function getRankedCells(grid: HeatmapDataPoint[], topN: number = 5): RankedCell[] {
  const totalValue = grid.reduce((sum, p) => sum + p.value, 0);
  
  return [...grid]
    .filter(p => p.value > 0)
    .sort((a, b) => {
      // Primary: value descending
      if (b.value !== a.value) return b.value - a.value;
      // Tie-breaker: earlier day wins
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
      // Tie-breaker: earlier hour wins
      return a.hour - b.hour;
    })
    .slice(0, topN)
    .map((point, index) => ({
      dayOfWeek: point.dayOfWeek,
      hour: point.hour,
      value: point.value,
      rank: index + 1,
      percentOfTotal: totalValue > 0 ? (point.value / totalValue) * 100 : 0,
    }));
}

/**
 * Process raw data into complete heatmap structure
 */
export function processHeatmapData(
  rawData: Array<{ day_of_week: number; hour: number; value: number | null }> | null | undefined
): ProcessedHeatmapData {
  const grid = normalizeHeatmapData(rawData);
  const values = grid.map(p => p.value);
  const maxValue = Math.max(...values, 0);
  const totalValue = values.reduce((sum, v) => sum + v, 0);
  const p95Value = calculateP95(values);
  const peakCells = getRankedCells(grid, 5);
  const hasData = totalValue > 0;
  
  return {
    grid,
    maxValue,
    totalValue,
    peakCells,
    hasData,
    p95Value,
  };
}

/**
 * Convert grid to ECharts format [hour, dayOfWeek, value]
 */
export function toEChartsData(grid: HeatmapDataPoint[]): [number, number, number][] {
  return grid.map(d => [d.hour, d.dayOfWeek, d.value]);
}

/**
 * Find cell in grid by coordinates
 */
export function findCell(grid: HeatmapDataPoint[], dayOfWeek: number, hour: number): HeatmapDataPoint | undefined {
  return grid.find(p => p.dayOfWeek === dayOfWeek && p.hour === hour);
}

/**
 * Check if two cells are the same
 */
export function isSameCell(a: { dayOfWeek: number; hour: number } | null, b: { dayOfWeek: number; hour: number } | null): boolean {
  if (!a || !b) return false;
  return a.dayOfWeek === b.dayOfWeek && a.hour === b.hour;
}

/**
 * Export heatmap data to CSV with proper escaping
 */
export function exportHeatmapToCSV(
  grid: HeatmapDataPoint[],
  options: {
    metricLabel?: string;
    filename?: string;
    formatValue?: (value: number) => string;
  } = {}
): void {
  const { metricLabel = 'Value', filename = 'heatmap-export.csv', formatValue = (v) => v.toString() } = options;
  
  // Escape CSV field
  const escapeCSV = (field: string): string => {
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  };
  
  const headers = ['Day', 'Hour', escapeCSV(metricLabel)];
  const rows = [...grid]
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.hour - b.hour)
    .map(point => [
      escapeCSV(DAY_LABELS_FULL[point.dayOfWeek]),
      escapeCSV(HOUR_LABELS_FULL[point.hour]),
      escapeCSV(formatValue(point.value)),
    ]);
  
  const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
