/**
 * Heatmap Data Preprocessing Utilities
 * Provides consistent data transformation for 7x24 time heatmaps
 */

export type HeatmapMetric = 'revenue' | 'count' | 'avg_donation';

export interface HeatmapDataPoint {
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  hour: number; // 0-23
  value: number;
  count?: number;
  uniqueDonors?: number;
  revenue?: number; // Always store revenue for avg calculation
  hasData?: boolean; // True if any donations exist (even if sum is 0)
}

export interface ProcessedHeatmapData {
  grid: HeatmapDataPoint[];
  maxValue: number;
  minValue: number;
  totalValue: number;
  avgValue: number;
  peakCells: RankedCell[];
  hasData: boolean;
  p95Value: number;
  totalSlots: number;
  slotsWithData: number;
}

export interface RankedCell {
  dayOfWeek: number;
  hour: number;
  value: number;
  rank: number;
  percentOfTotal: number;
  count?: number;
  revenue?: number;
}

export interface HeatmapStats {
  totalValue: number;
  maxValue: number;
  minValue: number;
  avgValue: number;
  p95Value: number;
  peakCells: RankedCell[];
  totalCount: number;
  slotsWithData: number;
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

// Total time slots in a week
export const TOTAL_TIME_SLOTS = 168;

/**
 * Get human-friendly time description with hour range
 */
export function formatTimeSlot(dayOfWeek: number, hour: number): string {
  const startHour = HOUR_LABELS_FULL[hour];
  const endHour = hour === 23 ? '11:59 PM' : HOUR_LABELS_FULL[(hour + 1) % 24].replace(':00', ':59');
  return `${DAY_LABELS_FULL[dayOfWeek]}, ${startHour}–${endHour}`;
}

/**
 * Get compact time description for chips
 */
export function formatTimeSlotCompact(dayOfWeek: number, hour: number): string {
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
      grid.push({ dayOfWeek: day, hour, value: 0, hasData: false });
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
      const revenue = Number(row.value) || 0;
      const count = row.count || 0;
      
      point.value = revenue;
      point.revenue = revenue;
      point.count = count;
      point.hasData = count > 0; // Mark as having data if any transactions exist
      if (row.unique_donors !== undefined) point.uniqueDonors = row.unique_donors;
    }
  });
  
  return grid;
}

/**
 * Transform grid data for a different metric
 */
export function transformGridForMetric(
  grid: HeatmapDataPoint[],
  metric: HeatmapMetric
): HeatmapDataPoint[] {
  return grid.map(point => {
    let value = 0;
    
    switch (metric) {
      case 'revenue':
        value = point.revenue || point.value || 0;
        break;
      case 'count':
        value = point.count || 0;
        break;
      case 'avg_donation':
        value = (point.count && point.count > 0) 
          ? (point.revenue || point.value || 0) / point.count 
          : 0;
        break;
    }
    
    return {
      ...point,
      value,
    };
  });
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
 * Calculate comprehensive stats for a heatmap grid
 */
export function calculateHeatmapStats(grid: HeatmapDataPoint[], topN: number = 5): HeatmapStats {
  const values = grid.map(d => d.value);
  const nonZeroValues = values.filter(v => v > 0);
  const slotsWithData = grid.filter(p => p.hasData).length;
  
  const totalValue = values.reduce((sum, v) => sum + v, 0);
  const totalCount = grid.reduce((sum, p) => sum + (p.count || 0), 0);
  const maxValue = nonZeroValues.length > 0 ? Math.max(...nonZeroValues) : 0;
  const minValue = nonZeroValues.length > 0 ? Math.min(...nonZeroValues) : 0;
  const avgValue = nonZeroValues.length > 0 ? totalValue / nonZeroValues.length : 0;
  const p95Value = calculateP95(values);
  const peakCells = getRankedCells(grid, topN);
  
  return { totalValue, maxValue, minValue, avgValue, p95Value, peakCells, totalCount, slotsWithData };
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
      count: point.count,
      revenue: point.revenue,
      rank: index + 1,
      percentOfTotal: totalValue > 0 ? (point.value / totalValue) * 100 : 0,
    }));
}

/**
 * Get rank of a specific cell within all 168 slots
 */
export function getCellRank(grid: HeatmapDataPoint[], dayOfWeek: number, hour: number): number | null {
  const sortedGrid = [...grid]
    .filter(p => p.value > 0)
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
      return a.hour - b.hour;
    });
  
  const index = sortedGrid.findIndex(p => p.dayOfWeek === dayOfWeek && p.hour === hour);
  return index >= 0 ? index + 1 : null;
}

/**
 * Process raw data into complete heatmap structure
 */
export function processHeatmapData(
  rawData: Array<{ day_of_week: number; hour: number; value: number | null }> | null | undefined
): ProcessedHeatmapData {
  const grid = normalizeHeatmapData(rawData);
  const values = grid.map(p => p.value);
  const nonZeroValues = values.filter(v => v > 0);
  const maxValue = nonZeroValues.length > 0 ? Math.max(...nonZeroValues) : 0;
  const minValue = nonZeroValues.length > 0 ? Math.min(...nonZeroValues) : 0;
  const totalValue = values.reduce((sum, v) => sum + v, 0);
  const avgValue = nonZeroValues.length > 0 ? totalValue / nonZeroValues.length : 0;
  const p95Value = calculateP95(values);
  const peakCells = getRankedCells(grid, 5);
  const hasData = totalValue > 0;
  const slotsWithData = grid.filter(p => p.hasData).length;
  
  return {
    grid,
    maxValue,
    minValue,
    totalValue,
    avgValue,
    peakCells,
    hasData,
    p95Value,
    totalSlots: TOTAL_TIME_SLOTS,
    slotsWithData,
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
 * Get metric label for display
 */
export function getMetricLabel(metric: HeatmapMetric): string {
  switch (metric) {
    case 'revenue': return 'Net Revenue';
    case 'count': return 'Donation Count';
    case 'avg_donation': return 'Average Donation';
    default: return 'Value';
  }
}

/**
 * Get metric description for tooltips
 */
export function getMetricDescription(metric: HeatmapMetric): string {
  switch (metric) {
    case 'revenue': return 'Total net revenue per hour';
    case 'count': return 'Number of donations per hour';
    case 'avg_donation': return 'Average donation amount per hour';
    default: return 'Value per hour';
  }
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
    includeCount?: boolean;
  } = {}
): void {
  const { 
    metricLabel = 'Value', 
    filename = 'heatmap-export.csv', 
    formatValue = (v) => v.toString(),
    includeCount = true,
  } = options;
  
  // Escape CSV field
  const escapeCSV = (field: string): string => {
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  };
  
  const headers = includeCount 
    ? ['Day', 'Hour', escapeCSV(metricLabel), 'Transactions']
    : ['Day', 'Hour', escapeCSV(metricLabel)];
    
  const rows = [...grid]
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.hour - b.hour)
    .map(point => {
      const baseRow = [
        escapeCSV(DAY_LABELS_FULL[point.dayOfWeek]),
        escapeCSV(HOUR_LABELS_FULL[point.hour]),
        escapeCSV(formatValue(point.value)),
      ];
      if (includeCount) {
        baseRow.push(String(point.count || 0));
      }
      return baseRow;
    });
  
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
