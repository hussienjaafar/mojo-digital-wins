import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, ChevronsUpDown, ChevronRight } from "lucide-react";
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
  /** Whether this is the primary/entity column (stronger visual weight) */
  primary?: boolean;
  /** Whether this column should be highlighted when sorted */
  highlightOnSort?: boolean;
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
  /** Enable pagination */
  pagination?: boolean;
  /** Items per page (default: 25) */
  pageSize?: number;
  /** Current page (1-indexed) for controlled pagination */
  currentPage?: number;
  /** Page change handler for controlled pagination */
  onPageChange?: (page: number) => void;
  /** Default sort key */
  defaultSortKey?: string;
  /** Default sort direction */
  defaultSortDirection?: "asc" | "desc";
  /** Show row numbers/ranks */
  showRowNumbers?: boolean;
  /** Highlight top N rows */
  highlightTopN?: number;
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
  pagination = false,
  pageSize = 25,
  currentPage: controlledPage,
  onPageChange,
  defaultSortKey,
  defaultSortDirection = "desc",
  showRowNumbers = false,
  highlightTopN = 0,
}: V3DataTableProps<T>) {
  const [sortKey, setSortKey] = React.useState<string | null>(defaultSortKey ?? null);
  const [sortDirection, setSortDirection] = React.useState<SortDirection>(
    defaultSortKey ? defaultSortDirection : null
  );
  const [internalPage, setInternalPage] = React.useState(1);
  
  // Use controlled or uncontrolled pagination
  const currentPage = controlledPage ?? internalPage;
  const setCurrentPage = onPageChange ?? setInternalPage;

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

  // Pagination calculations
  const totalItems = sortedData.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedData = pagination ? sortedData.slice(startIndex, endIndex) : sortedData;
  
  // Reset to page 1 when data changes significantly
  React.useEffect(() => {
    if (pagination && currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage, pagination, setCurrentPage]);

  // Render sort icon
  const renderSortIcon = (column: V3Column<T>) => {
    if (!column.sortable) return null;

    const isActive = sortKey === column.key;
    
    if (isActive) {
      return sortDirection === "asc" ? (
        <ChevronUp className="h-3.5 w-3.5 text-[hsl(var(--portal-accent-blue))]" />
      ) : (
        <ChevronDown className="h-3.5 w-3.5 text-[hsl(var(--portal-accent-blue))]" />
      );
    }
    return <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />;
  };

  // Calculate visible columns
  const visibleColumns = React.useMemo(() => 
    columns.filter(c => !c.hideOnMobile || typeof window === 'undefined' || window.innerWidth >= 768),
    [columns]
  );

  // Loading skeleton
  if (isLoading) {
    return (
      <div className={cn("rounded-xl border border-[hsl(var(--portal-border)/0.5)] overflow-hidden bg-[hsl(var(--portal-bg-primary))]", className)}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[hsl(var(--portal-border)/0.5)]">
                {showRowNumbers && (
                  <th className={cn("text-left text-[11px] font-medium text-[hsl(var(--portal-text-muted))] uppercase tracking-wider", compact ? "px-3 py-2.5" : "px-4 py-3")}>
                    #
                  </th>
                )}
                {visibleColumns.map((column) => (
                  <th
                    key={column.key}
                    className={cn(
                      "text-left text-[11px] font-medium text-[hsl(var(--portal-text-muted))] uppercase tracking-wider",
                      compact ? "px-3 py-2.5" : "px-4 py-3",
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
            <tbody>
              {Array.from({ length: loadingRows }).map((_, rowIndex) => (
                <tr key={rowIndex} className="border-b border-[hsl(var(--portal-border)/0.3)] last:border-b-0">
                  {showRowNumbers && (
                    <td className={cn(compact ? "px-3 py-2.5" : "px-4 py-3")}>
                      <Skeleton className="h-4 w-6" />
                    </td>
                  )}
                  {visibleColumns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(compact ? "px-3 py-2.5" : "px-4 py-3")}
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
      <div className={cn("rounded-xl border border-[hsl(var(--portal-border)/0.5)] p-8 bg-[hsl(var(--portal-bg-primary))]", className)}>
        <V3EmptyState
          title={emptyTitle}
          description={emptyDescription}
          accent="blue"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-[hsl(var(--portal-border)/0.5)] overflow-hidden bg-[hsl(var(--portal-bg-primary))]",
        className
      )}
      style={{ maxHeight }}
    >
      <div className={cn("overflow-x-auto", maxHeight && "overflow-y-auto")}>
        <table className="w-full" role="table">
          <thead className="sticky top-0 z-10 bg-[hsl(var(--portal-bg-primary))]">
            <tr className="border-b border-[hsl(var(--portal-border)/0.5)]">
              {showRowNumbers && (
                <th
                  className={cn(
                    "text-left text-[11px] font-medium text-[hsl(var(--portal-text-muted))] uppercase tracking-wider",
                    compact ? "px-3 py-2.5" : "px-4 py-3",
                    "w-12"
                  )}
                >
                  #
                </th>
              )}
              {visibleColumns.map((column) => {
                const isActivelySorted = sortKey === column.key;
                return (
                  <th
                    key={column.key}
                    className={cn(
                      "text-left text-[11px] font-medium uppercase tracking-wider transition-colors",
                      compact ? "px-3 py-2.5" : "px-4 py-3",
                      column.align === "center" && "text-center",
                      column.align === "right" && "text-right",
                      column.sortable && "cursor-pointer select-none",
                      isActivelySorted 
                        ? "text-[hsl(var(--portal-accent-blue))] bg-[hsl(var(--portal-accent-blue)/0.05)]" 
                        : "text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-text-secondary))]",
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
                      "flex items-center gap-1.5",
                      column.align === "center" && "justify-center",
                      column.align === "right" && "justify-end"
                    )}>
                      {column.header}
                      {renderSortIcon(column)}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, rowIndex) => {
              const globalIndex = startIndex + rowIndex;
              const isTopN = highlightTopN > 0 && globalIndex < highlightTopN;
              
              return (
                <tr
                  key={getRowKey(row, globalIndex)}
                  className={cn(
                    "transition-all duration-150 border-b border-[hsl(var(--portal-border)/0.3)] last:border-b-0",
                    striped && rowIndex % 2 === 1 && "bg-[hsl(var(--portal-bg-secondary)/0.5)]",
                    isTopN && "bg-[hsl(var(--portal-accent-blue)/0.03)]",
                    onRowClick && [
                      "cursor-pointer",
                      "hover:bg-[hsl(var(--portal-bg-elevated))]",
                      "hover:shadow-[inset_0_0_0_1px_hsl(var(--portal-border)/0.3)]",
                      "group"
                    ]
                  )}
                  onClick={() => onRowClick?.(row, globalIndex)}
                  role="row"
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (onRowClick && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      onRowClick(row, globalIndex);
                    }
                  }}
                >
                  {showRowNumbers && (
                    <td
                      className={cn(
                        "text-sm tabular-nums",
                        compact ? "px-3 py-2.5" : "px-4 py-3",
                        isTopN 
                          ? "font-semibold text-[hsl(var(--portal-text-primary))]" 
                          : "text-[hsl(var(--portal-text-muted))]"
                      )}
                      role="cell"
                    >
                      {globalIndex + 1}
                    </td>
                  )}
                  {visibleColumns.map((column) => {
                    const isActivelySorted = sortKey === column.key;
                    return (
                      <td
                        key={column.key}
                        className={cn(
                          "text-sm",
                          compact ? "px-3 py-2.5" : "px-4 py-3",
                          column.align === "center" && "text-center",
                          column.align === "right" && "text-right",
                          column.hideOnMobile && "hidden md:table-cell",
                          column.primary && "font-medium text-[hsl(var(--portal-text-primary))]",
                          isActivelySorted && "bg-[hsl(var(--portal-accent-blue)/0.02)]"
                        )}
                        role="cell"
                      >
                        {column.render(row, globalIndex)}
                      </td>
                    );
                  })}
                  {/* Row click indicator */}
                  {onRowClick && (
                    <td className="w-8 pr-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ChevronRight className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Pagination Controls */}
      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-[hsl(var(--portal-border)/0.5)] bg-[hsl(var(--portal-bg-secondary)/0.3)]">
          <div className="text-xs text-[hsl(var(--portal-text-muted))]">
            Showing <span className="font-medium text-[hsl(var(--portal-text-secondary))]">{startIndex + 1}–{endIndex}</span> of <span className="font-medium text-[hsl(var(--portal-text-secondary))]">{totalItems}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                currentPage === 1
                  ? "text-[hsl(var(--portal-text-muted))] cursor-not-allowed opacity-50"
                  : "text-[hsl(var(--portal-text-primary))] hover:bg-[hsl(var(--portal-bg-elevated))] active:scale-95"
              )}
            >
              Previous
            </button>
            <div className="flex items-center gap-1 px-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={cn(
                      "w-7 h-7 text-xs font-medium rounded-md transition-all",
                      currentPage === pageNum
                        ? "bg-[hsl(var(--portal-accent-blue))] text-white"
                        : "text-[hsl(var(--portal-text-secondary))] hover:bg-[hsl(var(--portal-bg-elevated))]"
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                currentPage === totalPages
                  ? "text-[hsl(var(--portal-text-muted))] cursor-not-allowed opacity-50"
                  : "text-[hsl(var(--portal-text-primary))] hover:bg-[hsl(var(--portal-bg-elevated))] active:scale-95"
              )}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
