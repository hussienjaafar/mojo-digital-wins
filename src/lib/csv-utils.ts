/**
 * CSV utility functions for safe data export
 */

/**
 * Escape a value for CSV output
 * - Wraps in quotes if contains comma, quote, or newline
 * - Escapes internal quotes by doubling them
 */
export function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  const stringValue = String(value);
  
  // Check if escaping is needed
  const needsEscaping = stringValue.includes(',') || 
                        stringValue.includes('"') || 
                        stringValue.includes('\n') ||
                        stringValue.includes('\r');
  
  if (needsEscaping) {
    // Escape quotes by doubling them and wrap in quotes
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
}

/**
 * Convert an array of objects to a CSV string
 */
export function arrayToCSV<T extends Record<string, unknown>>(
  data: T[],
  headers: { key: keyof T; label: string }[]
): string {
  if (!data || data.length === 0) {
    return headers.map(h => escapeCSVValue(h.label)).join(',');
  }
  
  const headerRow = headers.map(h => escapeCSVValue(h.label)).join(',');
  const dataRows = data.map(row => 
    headers.map(h => escapeCSVValue(row[h.key])).join(',')
  );
  
  return [headerRow, ...dataRows].join('\n');
}

/**
 * Download CSV data as a file
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}
