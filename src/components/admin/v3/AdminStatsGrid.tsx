import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { V3KPICard, V3KPIAccent } from "@/components/v3/V3KPICard";
import { Skeleton } from "@/components/ui/skeleton";

export interface AdminStatItem {
  id: string;
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: V3KPIAccent;
  trend?: {
    value: number;
    isPositive?: boolean;
  };
  subtitle?: string;
  onClick?: () => void;
}

interface AdminStatsGridProps {
  items: AdminStatItem[];
  isLoading?: boolean;
  columns?: 2 | 3 | 4;
  className?: string;
}

export const AdminStatsGrid: React.FC<AdminStatsGridProps> = ({
  items,
  isLoading = false,
  columns = 4,
  className,
}) => {
  const columnClasses: Record<number, string> = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  };

  if (isLoading) {
    return (
      <div className={cn("grid gap-4", columnClasses[columns], className)}>
        {Array.from({ length: columns }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg p-4 border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-elevated))]"
          >
            <div className="flex items-center gap-2 mb-2">
              <Skeleton className="h-6 w-6 rounded" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-8 w-24 mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("grid gap-4", columnClasses[columns], className)}>
      {items.map((item) => (
        <V3KPICard
          key={item.id}
          icon={item.icon}
          label={item.label}
          value={item.value}
          accent={item.accent}
          trend={item.trend}
          subtitle={item.subtitle}
          onClick={item.onClick}
          showDefinition={false}
        />
      ))}
    </div>
  );
};

AdminStatsGrid.displayName = "AdminStatsGrid";
