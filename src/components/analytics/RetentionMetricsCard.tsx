import { Users, RefreshCw, TrendingUp, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface RetentionMetrics {
  totalDonors: number;
  repeatDonors: number;
  recurringDonors: number;
  repeatRate: number;
  recurringRate: number;
}

interface RetentionMetricsCardProps {
  data: RetentionMetrics;
  isLoading?: boolean;
}

// ============================================================================
// Metric Item Component
// ============================================================================

interface MetricItemProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sublabel?: string;
  accent?: "blue" | "green" | "purple" | "amber";
}

function MetricItem({ icon: Icon, label, value, sublabel, accent = "blue" }: MetricItemProps) {
  const accentColors = {
    blue: "text-[hsl(var(--portal-accent-blue))]",
    green: "text-[hsl(var(--portal-success))]",
    purple: "text-[hsl(var(--portal-accent-purple))]",
    amber: "text-[hsl(var(--portal-warning))]",
  };

  const bgColors = {
    blue: "bg-[hsl(var(--portal-accent-blue)/0.1)]",
    green: "bg-[hsl(var(--portal-success)/0.1)]",
    purple: "bg-[hsl(var(--portal-accent-purple)/0.1)]",
    amber: "bg-[hsl(var(--portal-warning)/0.1)]",
  };

  return (
    <div className="flex flex-col items-center text-center p-4 rounded-lg bg-[hsl(var(--portal-bg-secondary))] border border-[hsl(var(--portal-border))]">
      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center mb-2", bgColors[accent])}>
        <Icon className={cn("h-5 w-5", accentColors[accent])} />
      </div>
      <div className={cn("text-2xl font-bold", accentColors[accent])}>
        {value}
      </div>
      <div className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
        {label}
      </div>
      {sublabel && (
        <div className="text-xs text-[hsl(var(--portal-text-muted))]">
          {sublabel}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function RetentionMetricsCard({ data, isLoading = false }: RetentionMetricsCardProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse h-28 bg-[hsl(var(--portal-bg-tertiary))] rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <MetricItem
        icon={Users}
        label="Total Donors"
        value={data.totalDonors.toLocaleString()}
        sublabel="All time"
        accent="blue"
      />
      <MetricItem
        icon={RefreshCw}
        label="Repeat Donors"
        value={data.repeatDonors.toLocaleString()}
        sublabel={`${data.repeatRate.toFixed(0)}% of total`}
        accent="purple"
      />
      <MetricItem
        icon={Heart}
        label="Recurring Donors"
        value={data.recurringDonors.toLocaleString()}
        sublabel={`${data.recurringRate.toFixed(0)}% of total`}
        accent="green"
      />
      <MetricItem
        icon={TrendingUp}
        label="Repeat Rate"
        value={`${data.repeatRate.toFixed(0)}%`}
        sublabel="Gave more than once"
        accent={data.repeatRate >= 20 ? "green" : data.repeatRate >= 10 ? "amber" : "blue"}
      />
    </div>
  );
}
