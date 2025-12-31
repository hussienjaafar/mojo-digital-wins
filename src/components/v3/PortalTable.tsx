import * as React from "react";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface PortalTableColumn<T> {
  /** Unique key for the column */
  key: string;
  /** Header label */
  header: string;
  /** Text alignment */
  align?: "left" | "center" | "right";
  /** Custom width class */
  width?: string;
  /** Cell renderer */
  render: (row: T, index: number) => React.ReactNode;
}

export interface PortalTableProps<T> {
  /** Column definitions */
  columns: PortalTableColumn<T>[];
  /** Data rows */
  data: T[];
  /** Unique key extractor */
  getRowKey: (row: T, index: number) => string | number;
  /** Empty state content */
  emptyContent?: React.ReactNode;
  /** Additional table class */
  className?: string;
  /** Whether to show the table in a compact mode */
  compact?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function PortalTable<T>({
  columns,
  data,
  getRowKey,
  emptyContent,
  className,
  compact = false,
}: PortalTableProps<T>) {
  const cellPadding = compact ? "px-3 py-2" : "px-4 py-3";
  const fontSize = compact ? "text-xs" : "text-sm";

  if (data.length === 0 && emptyContent) {
    return <>{emptyContent}</>;
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className={cn("w-full", fontSize)}>
        <thead>
          <tr className="border-b border-[hsl(var(--portal-border))]">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  cellPadding,
                  "font-medium text-[hsl(var(--portal-text-muted))]",
                  col.align === "right" && "text-right",
                  col.align === "center" && "text-center",
                  col.align === "left" && "text-left",
                  !col.align && "text-left",
                  col.width
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={getRowKey(row, idx)}
              className="border-b border-[hsl(var(--portal-border)/0.5)] hover:bg-[hsl(var(--portal-bg-elevated))] transition-colors"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    cellPadding,
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center"
                  )}
                >
                  {col.render(row, idx)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// Breakdown Table (simplified for KPI breakdown use cases)
// ============================================================================

export interface BreakdownItem {
  label: string;
  value: string | number;
  percentage?: number;
}

interface BreakdownTableProps {
  items: BreakdownItem[];
  compact?: boolean;
}

export const PortalBreakdownTable: React.FC<BreakdownTableProps> = ({
  items,
  compact = false,
}) => {
  const hasPercentage = items.some((i) => i.percentage !== undefined);
  const cellPadding = compact ? "px-3 py-2" : "px-4 py-2.5";

  return (
    <div className="rounded-lg border border-[hsl(var(--portal-border))] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[hsl(var(--portal-bg-elevated))]">
            <th
              className={cn(
                cellPadding,
                "text-left font-medium text-[hsl(var(--portal-text-muted))]"
              )}
            >
              Metric
            </th>
            <th
              className={cn(
                cellPadding,
                "text-right font-medium text-[hsl(var(--portal-text-muted))]"
              )}
            >
              Value
            </th>
            {hasPercentage && (
              <th
                className={cn(
                  cellPadding,
                  "text-right font-medium text-[hsl(var(--portal-text-muted))] w-20"
                )}
              >
                %
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-[hsl(var(--portal-border))]">
          {items.map((item, index) => (
            <tr
              key={index}
              className="hover:bg-[hsl(var(--portal-bg-hover))] transition-colors"
            >
              <td
                className={cn(
                  cellPadding,
                  "text-[hsl(var(--portal-text-primary))]"
                )}
              >
                {item.label}
              </td>
              <td
                className={cn(
                  cellPadding,
                  "text-right font-medium text-[hsl(var(--portal-text-primary))] tabular-nums"
                )}
              >
                {item.value}
              </td>
              {item.percentage !== undefined && (
                <td
                  className={cn(
                    cellPadding,
                    "text-right text-[hsl(var(--portal-text-muted))] tabular-nums"
                  )}
                >
                  {item.percentage.toFixed(1)}%
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

PortalTable.displayName = "PortalTable";
PortalBreakdownTable.displayName = "PortalBreakdownTable";
