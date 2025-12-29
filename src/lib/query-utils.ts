/**
 * Query utilities for handling date ranges, limits, and data truncation warnings
 */

/**
 * Format end date to include full day (23:59:59)
 * Ensures consistent date range handling across all queries
 */
export function formatEndDateFull(endDate: string): string {
  // If already has time component, return as-is
  if (endDate.includes('T')) {
    return endDate;
  }
  return `${endDate}T23:59:59`;
}

/**
 * Format start date to start of day (00:00:00)
 * Ensures consistent date range handling across all queries
 */
export function formatStartDateFull(startDate: string): string {
  // If already has time component, return as-is
  if (startDate.includes('T')) {
    return startDate;
  }
  return `${startDate}T00:00:00`;
}

/**
 * Standard query limits for different data types
 * Higher limits for analytics tables, lower for transaction details
 */
export const QUERY_LIMITS = {
  // Transaction-level data (PII, detailed)
  transactions: 1000,
  touchpoints: 2000,
  
  // Journey/event data
  journeys: 1000,
  events: 2000,
  
  // Aggregated data (no limit concerns)
  segments: 5000,
  predictions: 2000,
  
  // Alerts and actions
  alerts: 500,
  actions: 500,
  
  // Real-time feeds
  realtime: 50,
} as const;

/**
 * Check if query results may be truncated
 * Returns true if the result count equals the limit
 */
export function isDataTruncated(resultCount: number, limit: number): boolean {
  return resultCount >= limit;
}

/**
 * Generate a data truncation warning message
 */
export function getTruncationWarning(
  dataType: string,
  resultCount: number,
  limit: number
): string | null {
  if (!isDataTruncated(resultCount, limit)) {
    return null;
  }
  return `Showing ${limit.toLocaleString()} most recent ${dataType}. Full dataset may contain more records.`;
}

/**
 * Calculate date range in days
 */
export function getDateRangeDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get a previous period of equal length for comparison
 */
export function getPreviousPeriod(
  startDate: string,
  endDate: string
): { prevStartDate: string; prevEndDate: string } {
  const days = getDateRangeDays(startDate, endDate);
  const start = new Date(startDate);
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - days);

  return {
    prevStartDate: prevStart.toISOString().split('T')[0],
    prevEndDate: prevEnd.toISOString().split('T')[0],
  };
}

/**
 * Get date N days ago as ISO date string
 */
export function getDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

/**
 * Result wrapper with truncation metadata
 */
export interface QueryResultMeta {
  isTruncated: boolean;
  limit: number;
  actualCount: number;
  warning: string | null;
}

export function createResultMeta(
  dataType: string,
  resultCount: number,
  limit: number
): QueryResultMeta {
  const isTruncated = isDataTruncated(resultCount, limit);
  return {
    isTruncated,
    limit,
    actualCount: resultCount,
    warning: getTruncationWarning(dataType, resultCount, limit),
  };
}
