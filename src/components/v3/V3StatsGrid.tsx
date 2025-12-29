import { cn } from "@/lib/utils";
import { V3MetricChip, V3MetricChipProps, V3MetricChipVariant } from "./V3MetricChip";

export interface V3StatsGridItem extends Omit<V3MetricChipProps, "className"> {
  id: string;
}

export interface V3StatsGridProps {
  items: V3StatsGridItem[];
  className?: string;
  columns?: 2 | 3 | 4 | 5 | 6;
}

export function V3StatsGrid({ items, className, columns = 4 }: V3StatsGridProps) {
  const columnClasses: Record<number, string> = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
    6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
  };

  return (
    <div className={cn("grid gap-2", columnClasses[columns], className)}>
      {items.map((item) => (
        <V3MetricChip
          key={item.id}
          label={item.label}
          value={item.value}
          icon={item.icon}
          variant={item.variant}
        />
      ))}
    </div>
  );
}
