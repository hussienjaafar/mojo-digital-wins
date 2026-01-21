import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, ChevronsUpDown, ChevronRight } from "lucide-react";
import { V3EmptyState } from "./V3EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import type { V3Column } from "./V3DataTable";

export interface V3VirtualizedDataTableProps<T> {
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
  /** Default sort key */
  defaultSortKey?: string;
  /** Default sort direction */
  defaultSortDirection?: "asc" | "desc";
  /** Show row numbers/ranks */
  showRowNumbers?: boolean;
  /** Highlight top N rows */
  highlightTopN?: number;
  /** Row height for virtualization */
  rowHeight?: number;
  /** Overscan count for smoother scrolling */
  overscan?: number;
}

type SortDirection = "asc" | "desc" | null;

export function V3VirtualizedDataTable<T>({
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
  maxHeight = "400px",
  defaultSortKey,
  defaultSortDirection = "desc",
  showRowNumbers = false,
  highlightTopN = 0,
  rowHeight,
  overscan = 5,
}: V3VirtualizedDataTableProps<T>) {
  const parentRef = React.useRef<HTMLDivElement>(null);
  
  const [sortKey, setSortKey] = React.useState<string | null>(defaultSortKey ?? null);
  const [sortDirection, setSortDirection] = React.useState<SortDirection>(
    defaultSortKey ? defaultSortDirection : null
  );

  // Calculate row height based on compact mode
  const computedRowHeight = rowHeight ?? (compact ? 40 : 48);

  // Handle sort click
  const handleSort = React.useCallback((column: V3Column<T>) => {
    if (!column.sortable) return;

    if (sortKey === column.key) {
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

  // Setup virtualizer
  const virtualizer = useVirtualizer({
    count: sortedData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => computedRowHeight,
    overscan,
  });

  // Calculate visible columns
  const visibleColumns = React.useMemo(() => 
    columns.filter(c => !c.hideOnMobile || typeof window === 'undefined' || window.innerWidth >= 768),
    [columns]
  );

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

  // Calculate column widths for flex layout
  const getColumnFlex = (column: V3Column<T>) => {
    if (column.width) return `0 0 ${column.width}`;
    if (column.primary) return "1 1 200px";
    return "1 1 100px";
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className={cn("rounded-xl border border-[hsl(var(--portal-border)/0.5)] overflow-hidden bg-[hsl(var(--portal-bg-primary))]", className)}>
        <div className="flex border-b border-[hsl(var(--portal-border)/0.5)]">
          {showRowNumbers && (
            <div className={cn("flex-none w-12 text-left text-[11px] font-medium text-[hsl(var(--portal-text-muted))] uppercase tracking-wider", compact ? "px-3 py-2.5" : "px-4 py-3")}>
              #
            </div>
          )}
          {visibleColumns.map((column) => (
            <div
              key={column.key}
              className={cn(
                "text-left text-[11px] font-medium text-[hsl(var(--portal-text-muted))] uppercase tracking-wider",
                compact ? "px-3 py-2.5" : "px-4 py-3",
                column.align === "center" && "text-center",
                column.align === "right" && "text-right"
              )}
              style={{ flex: getColumnFlex(column) }}
            >
              {column.header}
            </div>
          ))}
        </div>
        <div>
          {Array.from({ length: loadingRows }).map((_, rowIndex) => (
            <div key={rowIndex} className="flex border-b border-[hsl(var(--portal-border)/0.3)] last:border-b-0">
              {showRowNumbers && (
                <div className={cn("flex-none w-12", compact ? "px-3 py-2.5" : "px-4 py-3")}>
                  <Skeleton className="h-4 w-6" />
                </div>
              )}
              {visibleColumns.map((column) => (
                <div
                  key={column.key}
                  className={cn(compact ? "px-3 py-2.5" : "px-4 py-3")}
                  style={{ flex: getColumnFlex(column) }}
                >
                  <Skeleton className="h-4 w-full max-w-[120px]" />
                </div>
              ))}
            </div>
          ))}
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
    >
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 flex border-b border-[hsl(var(--portal-border)/0.5)] bg-[hsl(var(--portal-bg-primary))]">
        {showRowNumbers && (
          <div
            className={cn(
              "flex-none w-12 text-left text-[11px] font-medium text-[hsl(var(--portal-text-muted))] uppercase tracking-wider",
              compact ? "px-3 py-2.5" : "px-4 py-3"
            )}
          >
            #
          </div>
        )}
        {visibleColumns.map((column) => {
          const isActivelySorted = sortKey === column.key;
          return (
            <div
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
                column.hideOnMobile && "hidden md:flex"
              )}
              style={{ flex: getColumnFlex(column) }}
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
            </div>
          );
        })}
        {onRowClick && <div className="flex-none w-8" />}
      </div>

      {/* Virtualized Body */}
      <div
        ref={parentRef}
        className="overflow-y-auto"
        style={{ maxHeight }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = sortedData[virtualRow.index];
            const globalIndex = virtualRow.index;
            const isTopN = highlightTopN > 0 && globalIndex < highlightTopN;

            return (
              <div
                key={getRowKey(row, globalIndex)}
                className={cn(
                  "absolute left-0 right-0 flex items-center transition-all duration-150 border-b border-[hsl(var(--portal-border)/0.3)]",
                  striped && globalIndex % 2 === 1 && "bg-[hsl(var(--portal-bg-secondary)/0.5)]",
                  isTopN && "bg-[hsl(var(--portal-accent-blue)/0.03)]",
                  onRowClick && [
                    "cursor-pointer",
                    "hover:bg-[hsl(var(--portal-bg-elevated))]",
                    "hover:shadow-[inset_0_0_0_1px_hsl(var(--portal-border)/0.3)]",
                    "group"
                  ]
                )}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
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
                  <div
                    className={cn(
                      "flex-none w-12 text-sm tabular-nums",
                      compact ? "px-3" : "px-4",
                      isTopN 
                        ? "font-semibold text-[hsl(var(--portal-text-primary))]" 
                        : "text-[hsl(var(--portal-text-muted))]"
                    )}
                    role="cell"
                  >
                    {globalIndex + 1}
                  </div>
                )}
                {visibleColumns.map((column) => {
                  const isActivelySorted = sortKey === column.key;
                  return (
                    <div
                      key={column.key}
                      className={cn(
                        "text-sm overflow-hidden",
                        compact ? "px-3" : "px-4",
                        column.align === "center" && "text-center",
                        column.align === "right" && "text-right",
                        column.hideOnMobile && "hidden md:block",
                        column.primary && "font-medium text-[hsl(var(--portal-text-primary))]",
                        isActivelySorted && "bg-[hsl(var(--portal-accent-blue)/0.02)]"
                      )}
                      style={{ flex: getColumnFlex(column) }}
                      role="cell"
                    >
                      {column.render(row, globalIndex)}
                    </div>
                  );
                })}
                {/* Row click indicator */}
                {onRowClick && (
                  <div className="flex-none w-8 pr-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
