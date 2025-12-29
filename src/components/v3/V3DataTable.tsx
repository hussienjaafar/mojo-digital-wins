import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { V3EmptyState } from "./V3EmptyState";
import { Skeleton } from "@/components/ui/skeleton";

export interface V3Column<T> {
  /** Unique key for the column */
  key: string;
  /** Header text */
  header: string;
  /** Render function for cell content */
  render: (row: T, index: number) => React.ReactNode;
  /** Enable sorting for this column */
  sortable?: boolean;
  /** Sort comparison function */
  sortFn?: (a: T, b: T) => number;
  /** Column width (CSS value) */
  width?: string;
  /** Text alignment */
  align?: "left" | "center" | "right";
  /** Hide on mobile */
  hideOnMobile?: boolean;
}

export interface V3DataTableProps<T> {
  /** Data array */
  data: T[];
  /** Column definitions */
  columns: V3Column<T>[];
  /** Unique key extractor for each row */
  getRowKey: (row: T, index: number) => string;
  /** Loading state */
  isLoading?: boolean;
  /** Number of skeleton rows when loading */
  loadingRows?: number;
  /** Empty state title */
  emptyTitle?: string;
  /** Empty state description */
  emptyDescription?: string;
  /** Row click handler */
  onRowClick?: (row: T, index: number) => void;
  /** Additional class for container */
  className?: string;
  /** Show striped rows */
  striped?: boolean;
  /** Compact mode with less padding */
  compact?: boolean;
  /** Maximum height with scroll */
  maxHeight?: string;
}

type SortDirection = "asc" | "desc" | null;

export function V3DataTable<T>({
  data,
  columns,
  getRowKey,
  isLoading = false,
  loadingRows = 5,
  emptyTitle = "No data available",
  emptyDescription = "There are no items to display.",
  onRowClick,
  className,
  striped = false,
  compact = false,
  maxHeight,
}: V3DataTableProps<T>) {
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<SortDirection>(null);

  // Handle sort click
  const handleSort = React.useCallback((column: V3Column<T>) => {
    if (!column.sortable) return;

    if (sortKey === column.key) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortKey(null);
        setSortDirection(null);
      }
    } else {
      setSortKey(column.key);
      setSortDirection("asc");
    }
  }, [sortKey, sortDirection]);

  // Sort data
  const sortedData = React.useMemo(() => {
    if (!sortKey || !sortDirection) return data;

    const column = columns.find((c) => c.key === sortKey);
    if (!column?.sortFn) return data;

    const sorted = [...data].sort(column.sortFn);
    return sortDirection === "desc" ? sorted.reverse() : sorted;
  }, [data, sortKey, sortDirection, columns]);

  // Render sort icon
  const renderSortIcon = (column: V3Column<T>) => {
    if (!column.sortable) return null;

    if (sortKey === column.key) {
      return sortDirection === "asc" ? (
        <ChevronUp className="h-4 w-4" />
      ) : (
        <ChevronDown className="h-4 w-4" />
      );
    }
    return <ChevronsUpDown className="h-4 w-4 opacity-50" />;
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className={cn("rounded-lg border border-[hsl(var(--portal-border))] overflow-hidden", className)}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[hsl(var(--portal-bg-tertiary))]">
              <tr>
                {columns.filter(c => !c.hideOnMobile || window.innerWidth >= 768).map((column) => (
                  <th
                    key={column.key}
                    className={cn(
                      "text-left text-xs font-medium text-[hsl(var(--portal-text-muted))] uppercase tracking-wider",
                      compact ? "px-3 py-2" : "px-4 py-3",
                      column.align === "center" && "text-center",
                      column.align === "right" && "text-right"
                    )}
                    style={{ width: column.width }}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--portal-border))]">
              {Array.from({ length: loadingRows }).map((_, rowIndex) => (
                <tr key={rowIndex} className="bg-[hsl(var(--portal-bg-primary))]">
                  {columns.filter(c => !c.hideOnMobile || window.innerWidth >= 768).map((column) => (
                    <td
                      key={column.key}
                      className={cn(compact ? "px-3 py-2" : "px-4 py-3")}
                    >
                      <Skeleton className="h-4 w-full max-w-[120px]" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div className={cn("rounded-lg border border-[hsl(var(--portal-border))] p-8", className)}>
        <V3EmptyState
          title={emptyTitle}
          description={emptyDescription}
          accent="blue"
        />
      </div>
    );
  }

  const visibleColumns = columns.filter(c => !c.hideOnMobile || typeof window === 'undefined' || window.innerWidth >= 768);

  return (
    <div
      className={cn(
        "rounded-lg border border-[hsl(var(--portal-border))] overflow-hidden",
        className
      )}
      style={{ maxHeight }}
    >
      <div className={cn("overflow-x-auto", maxHeight && "overflow-y-auto")}>
        <table className="w-full" role="table">
          <thead className="bg-[hsl(var(--portal-bg-tertiary))] sticky top-0 z-10">
            <tr>
              {visibleColumns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "text-left text-xs font-medium text-[hsl(var(--portal-text-muted))] uppercase tracking-wider",
                    compact ? "px-3 py-2" : "px-4 py-3",
                    column.align === "center" && "text-center",
                    column.align === "right" && "text-right",
                    column.sortable && "cursor-pointer select-none hover:text-[hsl(var(--portal-text-primary))] transition-colors",
                    column.hideOnMobile && "hidden md:table-cell"
                  )}
                  style={{ width: column.width }}
                  onClick={() => handleSort(column)}
                  role="columnheader"
                  aria-sort={
                    sortKey === column.key
                      ? sortDirection === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  <div className={cn(
                    "flex items-center gap-1",
                    column.align === "center" && "justify-center",
                    column.align === "right" && "justify-end"
                  )}>
                    {column.header}
                    {renderSortIcon(column)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[hsl(var(--portal-border))]">
            {sortedData.map((row, rowIndex) => (
              <tr
                key={getRowKey(row, rowIndex)}
                className={cn(
                  "transition-colors",
                  striped && rowIndex % 2 === 1
                    ? "bg-[hsl(var(--portal-bg-secondary))]"
                    : "bg-[hsl(var(--portal-bg-primary))]",
                  onRowClick && "cursor-pointer hover:bg-[hsl(var(--portal-bg-elevated))]"
                )}
                onClick={() => onRowClick?.(row, rowIndex)}
                role="row"
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={(e) => {
                  if (onRowClick && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    onRowClick(row, rowIndex);
                  }
                }}
              >
                {visibleColumns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "text-[hsl(var(--portal-text-primary))] text-sm",
                      compact ? "px-3 py-2" : "px-4 py-3",
                      column.align === "center" && "text-center",
                      column.align === "right" && "text-right",
                      column.hideOnMobile && "hidden md:table-cell"
                    )}
                    role="cell"
                  >
                    {column.render(row, rowIndex)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
