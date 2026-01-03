/**
 * Table Data Utilities
 * 
 * Preprocessing, normalization, and data hygiene utilities for V3 tables.
 * Shared with chart preprocessing for consistency.
 */

import { normalizeLabel as chartNormalizeLabel } from "./donut-chart-utils";

export interface TableRowBase {
  [key: string]: unknown;
}

/**
 * Normalize a string value (trim, consistent casing)
 * Re-exports chart utility for consistency
 */
export const normalizeLabel = chartNormalizeLabel;

/**
 * Check if a label represents "not provided" / unknown values
 */
export function isNotProvidedLabel(label: string): boolean {
  const normalized = label.toLowerCase().trim();
  const notProvidedPatterns = [
    "not provided",
    "not specified",
    "unknown",
    "n/a",
    "na",
    "none",
    "null",
    "undefined",
    "-",
    "",
  ];
  return notProvidedPatterns.includes(normalized);
}

/**
 * Merge duplicate rows by a key field, aggregating numeric columns
 */
export function mergeTableDuplicates<T extends TableRowBase>(
  data: T[],
  keyField: keyof T,
  aggregateFields: (keyof T)[],
  normalizeKey = true
): T[] {
  const merged = new Map<string, T>();

  for (const row of data) {
    const rawKey = String(row[keyField] ?? "");
    const key = normalizeKey ? normalizeLabel(rawKey) : rawKey;

    if (merged.has(key)) {
      const existing = merged.get(key)!;
      // Aggregate numeric fields
      for (const field of aggregateFields) {
        const existingVal = existing[field];
        const newVal = row[field];
        if (typeof existingVal === "number" && typeof newVal === "number") {
          (existing[field] as number) = existingVal + newVal;
        }
      }
    } else {
      // Clone the row with normalized key
      merged.set(key, {
        ...row,
        [keyField]: normalizeKey ? normalizeLabel(rawKey) : rawKey,
      });
    }
  }

  return Array.from(merged.values());
}

/**
 * Sort table data with deterministic tie-breaking
 */
export function sortTableData<T extends TableRowBase>(
  data: T[],
  sortKey: keyof T,
  direction: "asc" | "desc" = "desc",
  tieBreakKey?: keyof T
): T[] {
  return [...data].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];

    let comparison = 0;
    if (typeof aVal === "number" && typeof bVal === "number") {
      comparison = aVal - bVal;
    } else if (typeof aVal === "string" && typeof bVal === "string") {
      comparison = aVal.localeCompare(bVal);
    }

    // Apply direction
    if (direction === "desc") {
      comparison = -comparison;
    }

    // Tie-break if needed
    if (comparison === 0 && tieBreakKey) {
      const aTie = String(a[tieBreakKey] ?? "");
      const bTie = String(b[tieBreakKey] ?? "");
      comparison = aTie.localeCompare(bTie);
    }

    return comparison;
  });
}

/**
 * Bucket "Not Provided" entries into a single row
 */
export function bucketNotProvided<T extends TableRowBase>(
  data: T[],
  labelField: keyof T,
  aggregateFields: (keyof T)[],
  bucketLabel = "Not Provided"
): T[] {
  const provided: T[] = [];
  let bucketRow: T | null = null;

  for (const row of data) {
    const label = String(row[labelField] ?? "");
    
    if (isNotProvidedLabel(label)) {
      if (!bucketRow) {
        bucketRow = { ...row, [labelField]: bucketLabel };
      } else {
        // Aggregate into bucket
        for (const field of aggregateFields) {
          const existing = bucketRow[field];
          const newVal = row[field];
          if (typeof existing === "number" && typeof newVal === "number") {
            (bucketRow[field] as number) = existing + newVal;
          }
        }
      }
    } else {
      provided.push(row);
    }
  }

  return bucketRow ? [...provided, bucketRow] : provided;
}

/**
 * Calculate rank for each row based on a value field
 */
export function addRanks<T extends TableRowBase>(
  data: T[],
  valueField: keyof T,
  rankField: string = "_rank"
): (T & { [key: string]: number })[] {
  const sorted = [...data].sort((a, b) => {
    const aVal = a[valueField];
    const bVal = b[valueField];
    if (typeof aVal === "number" && typeof bVal === "number") {
      return bVal - aVal; // Descending
    }
    return 0;
  });

  return sorted.map((row, index) => ({
    ...row,
    [rankField]: index + 1,
  }));
}

/**
 * Calculate max value in a dataset for a given field
 * Used for inline bar scaling
 */
export function getMaxValue<T extends TableRowBase>(
  data: T[],
  field: keyof T
): number {
  let max = 0;
  for (const row of data) {
    const val = row[field];
    if (typeof val === "number" && val > max) {
      max = val;
    }
  }
  return max;
}

/**
 * Calculate total for a numeric field
 */
export function getTotalValue<T extends TableRowBase>(
  data: T[],
  field: keyof T
): number {
  let total = 0;
  for (const row of data) {
    const val = row[field];
    if (typeof val === "number") {
      total += val;
    }
  }
  return total;
}

/**
 * Get ordinal suffix for rank (1st, 2nd, 3rd, etc.)
 */
export function getRankSuffix(rank: number): string {
  const j = rank % 10;
  const k = rank % 100;

  if (j === 1 && k !== 11) return `${rank}st`;
  if (j === 2 && k !== 12) return `${rank}nd`;
  if (j === 3 && k !== 13) return `${rank}rd`;
  return `${rank}th`;
}

export interface ProcessTableDataOptions<T> {
  /** Field to use as the primary key/label */
  keyField: keyof T;
  /** Fields to aggregate when merging duplicates */
  aggregateFields?: (keyof T)[];
  /** Whether to normalize labels */
  normalizeLabels?: boolean;
  /** Whether to merge duplicates */
  mergeDuplicates?: boolean;
  /** Whether to bucket "not provided" values */
  bucketNotProvided?: boolean;
  /** Custom label for "not provided" bucket */
  notProvidedLabel?: string;
  /** Field to use for initial sorting */
  sortField?: keyof T;
  /** Sort direction */
  sortDirection?: "asc" | "desc";
  /** Field to add ranks based on */
  rankField?: keyof T;
}

/**
 * Full preprocessing pipeline for table data
 */
export function processTableData<T extends TableRowBase>(
  data: T[],
  options: ProcessTableDataOptions<T>
): T[] {
  let processed = [...data];

  // Merge duplicates
  if (options.mergeDuplicates && options.aggregateFields) {
    processed = mergeTableDuplicates(
      processed,
      options.keyField,
      options.aggregateFields,
      options.normalizeLabels ?? true
    );
  }

  // Bucket not provided
  if (options.bucketNotProvided && options.aggregateFields) {
    processed = bucketNotProvided(
      processed,
      options.keyField,
      options.aggregateFields,
      options.notProvidedLabel
    );
  }

  // Sort
  if (options.sortField) {
    processed = sortTableData(
      processed,
      options.sortField,
      options.sortDirection ?? "desc",
      options.keyField
    );
  }

  return processed;
}
