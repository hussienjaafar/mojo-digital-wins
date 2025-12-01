import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";

interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (value: any, row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  mobileLabel?: string; // Custom label for mobile view
  hiddenOnMobile?: boolean; // Hide this column on mobile
}

interface PortalTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  emptyAction?: React.ReactNode;
  isLoading?: boolean;
  className?: string;
}

export function PortalTable<T extends Record<string, any>>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  emptyMessage = "No data available",
  emptyAction,
  isLoading = false,
  className,
}: PortalTableProps<T>) {
  const [sortConfig, setSortConfig] = React.useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);

  const sortedData = React.useMemo(() => {
    if (!sortConfig) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === bValue) return 0;

      const comparison = aValue < bValue ? -1 : 1;
      return sortConfig.direction === "asc" ? comparison : -comparison;
    });
  }, [data, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig((current) => {
      if (!current || current.key !== key) {
        return { key, direction: "asc" };
      }
      if (current.direction === "asc") {
        return { key, direction: "desc" };
      }
      return null;
    });
  };

  if (isLoading) {
    return (
      <div className={cn("portal-card", className)}>
        <div className="p-8 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="portal-skeleton h-12 rounded portal-animate-fade-in" style={{ animationDelay: `${i * 50}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={cn("portal-card", className)}>
        <div className="p-8 sm:p-12 text-center">
          <p className="text-lg portal-text-secondary mb-2">{emptyMessage}</p>
          {emptyAction && <div className="mt-4">{emptyAction}</div>}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Desktop Table View - Hidden on Mobile */}
      <div className={cn("hidden md:block portal-card overflow-hidden", className)}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="portal-bg-tertiary">
              <tr>
                {columns.map((column) => (
                  <th
                    key={String(column.key)}
                    className={cn(
                      "px-4 py-3 text-left text-xs font-semibold portal-text-secondary uppercase tracking-wider",
                      column.sortable && "cursor-pointer hover:portal-text-primary transition-colors select-none",
                      column.className
                    )}
                    onClick={() => column.sortable && handleSort(String(column.key))}
                  >
                    <div className="flex items-center gap-2">
                      {column.label}
                      {column.sortable && sortConfig?.key === column.key && (
                        <span className="text-primary">
                          {sortConfig.direction === "asc" ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedData.map((row, index) => (
                <tr
                  key={keyExtractor(row)}
                  className={cn(
                    "border-t border-portal-border transition-all duration-200",
                    onRowClick && "cursor-pointer hover:portal-bg-elevated",
                    "portal-animate-fade-in"
                  )}
                  style={{ animationDelay: `${index * 30}ms` }}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((column) => {
                    const value = row[column.key as keyof T];
                    return (
                      <td
                        key={String(column.key)}
                        className={cn(
                          "px-4 py-4 text-sm portal-text-primary",
                          column.className
                        )}
                      >
                        {column.render ? column.render(value, row) : value}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View - Visible on Mobile Only */}
      <div className={cn("md:hidden space-y-3", className)}>
        {sortedData.map((row, index) => (
          <div
            key={keyExtractor(row)}
            className={cn(
              "portal-card p-4 space-y-3",
              onRowClick && "cursor-pointer active:scale-[0.98]",
              "portal-animate-fade-in"
            )}
            style={{ animationDelay: `${index * 30}ms` }}
            onClick={() => onRowClick?.(row)}
          >
            {columns
              .filter((col) => !col.hiddenOnMobile)
              .map((column) => {
                const value = row[column.key as keyof T];
                const label = column.mobileLabel || column.label;
                
                return (
                  <div key={String(column.key)} className="flex justify-between items-start gap-3">
                    <span className="text-xs font-medium portal-text-secondary uppercase tracking-wide flex-shrink-0">
                      {label}
                    </span>
                    <div className="text-sm portal-text-primary text-right flex-1">
                      {column.render ? column.render(value, row) : value}
                    </div>
                  </div>
                );
              })}
          </div>
        ))}
      </div>
    </>
  );
}

// Preset cell renderers for common patterns
export const PortalTableRenderers = {
  badge: (value: string, variant: "success" | "error" | "warning" | "info" = "info") => (
    <span className={cn("portal-badge", `portal-badge-${variant}`)}>
      {value}
    </span>
  ),
  
  currency: (value: number) => (
    <span className="font-semibold tabular-nums">
      ${typeof value === "number" ? value.toFixed(2) : "0.00"}
    </span>
  ),
  
  number: (value: number) => (
    <span className="font-semibold tabular-nums">
      {typeof value === "number" ? value.toLocaleString() : "0"}
    </span>
  ),
  
  date: (value: string) => {
    try {
      return new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return value;
    }
  },
  
  percentage: (value: number) => (
    <span className="font-semibold tabular-nums">
      {typeof value === "number" ? `${value.toFixed(1)}%` : "0%"}
    </span>
  ),
  
  boolean: (value: boolean) => (
    <span className={cn("portal-badge", value ? "portal-badge-success" : "portal-badge-error")}>
      {value ? "Yes" : "No"}
    </span>
  ),
};
