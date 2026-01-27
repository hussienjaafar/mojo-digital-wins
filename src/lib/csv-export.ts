/**
 * Generic CSV export utility
 */

/**
 * Escape a value for CSV output
 * - Wraps in quotes if contains comma, quote, or newline
 * - Escapes internal quotes by doubling them
 */
function escapeCSVValue(value: unknown): string {
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
 * Export data to CSV and trigger download
 * @param data - Array of objects to export
 * @param filename - Name of the downloaded file (should include .csv extension)
 * @param columns - Column definitions with key and label
 */
export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  columns: { key: string; label: string }[]
): void {
  // Build CSV header
  const headerRow = columns.map(col => escapeCSVValue(col.label)).join(',');

  // Build CSV rows
  const dataRows = data.map(row =>
    columns.map(col => {
      const value = row[col.key as keyof T];
      return escapeCSVValue(value);
    }).join(',')
  );

  // Combine header and data rows
  const csvContent = [headerRow, ...dataRows].join('\n');

  // Create blob with UTF-8 BOM for Excel compatibility
  // The BOM (\uFEFF) helps Excel detect UTF-8 encoding correctly
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}
