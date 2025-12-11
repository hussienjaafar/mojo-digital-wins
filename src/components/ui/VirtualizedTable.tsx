import React, { useMemo, CSSProperties, ReactElement } from "react";
import { List } from "react-window";
import { cn } from "@/lib/utils";

interface Column<T> {
  key: keyof T | string;
  header: string;
  width?: number;
  render?: (item: T, index: number) => React.ReactNode;
  className?: string;
}

interface VirtualizedTableProps<T> {
  data: T[];
  columns: Column<T>[];
  rowHeight?: number;
  maxHeight?: number;
  className?: string;
  onRowClick?: (item: T, index: number) => void;
  emptyMessage?: string;
}

interface RowData<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (item: T, index: number) => void;
}

function RowComponent<T extends Record<string, unknown>>({
  index,
  style,
  data,
  columns,
  onRowClick,
}: { index: number; style: CSSProperties } & RowData<T>): ReactElement {
  const item = data[index];
  return (
    <div
      style={style}
      className={cn(
        "flex items-center border-b border-[hsl(var(--portal-border))]",
        "hover:bg-[hsl(var(--portal-bg-hover))] transition-colors",
        onRowClick && "cursor-pointer"
      )}
      onClick={() => onRowClick?.(item, index)}
      role="row"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onRowClick?.(item, index);
        }
      }}
    >
      {columns.map((col) => {
        const value = col.render
          ? col.render(item, index)
          : (item[col.key as keyof T] as React.ReactNode);
        return (
          <div
            key={String(col.key)}
            className={cn(
              "px-3 py-2 text-sm text-[hsl(var(--portal-text-primary))] truncate",
              col.className
            )}
            style={{ width: col.width || "auto", flex: col.width ? "none" : 1 }}
          >
            {value}
          </div>
        );
      })}
    </div>
  );
}

export function VirtualizedTable<T extends Record<string, unknown>>({
  data,
  columns,
  rowHeight = 48,
  maxHeight = 400,
  className,
  onRowClick,
  emptyMessage = "No data available",
}: VirtualizedTableProps<T>) {
  const rowProps = useMemo(
    () => ({ data, columns, onRowClick }),
    [data, columns, onRowClick]
  );

  if (data.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center h-32 text-[hsl(var(--portal-text-muted))]",
          className
        )}
      >
        {emptyMessage}
      </div>
    );
  }

  const height = Math.min(data.length * rowHeight, maxHeight);

  return (
    <div className={cn("rounded-lg border border-[hsl(var(--portal-border))] overflow-hidden", className)}>
      {/* Header */}
      <div
        className="flex items-center bg-[hsl(var(--portal-bg-elevated))] border-b border-[hsl(var(--portal-border))]"
        role="row"
      >
        {columns.map((col) => (
          <div
            key={String(col.key)}
            className={cn(
              "px-3 py-3 text-xs font-medium text-[hsl(var(--portal-text-muted))] uppercase tracking-wider",
              col.className
            )}
            style={{ width: col.width || "auto", flex: col.width ? "none" : 1 }}
            role="columnheader"
          >
            {col.header}
          </div>
        ))}
      </div>

      {/* Virtualized rows */}
      <List
        style={{ height }}
        rowCount={data.length}
        rowHeight={rowHeight}
        rowComponent={RowComponent as any}
        rowProps={rowProps as any}
      />
    </div>
  );
}

export type { Column as VirtualizedTableColumn };
