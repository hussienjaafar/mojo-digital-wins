import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export type V3MetricChipVariant = "default" | "success" | "warning" | "error" | "info";

export interface V3MetricChipProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  variant?: V3MetricChipVariant;
  className?: string;
}

export function V3MetricChip({
  label,
  value,
  icon: Icon,
  variant = "default",
  className,
}: V3MetricChipProps) {
  const variantClasses: Record<V3MetricChipVariant, string> = {
    default: "bg-[hsl(var(--portal-bg-elevated))] text-[hsl(var(--portal-text-primary))]",
    success: "bg-[hsl(var(--portal-accent-green))]/10 text-[hsl(var(--portal-accent-green))]",
    warning: "bg-[hsl(var(--portal-accent-yellow))]/10 text-[hsl(var(--portal-accent-yellow))]",
    error: "bg-[hsl(var(--portal-accent-red))]/10 text-[hsl(var(--portal-accent-red))]",
    info: "bg-[hsl(var(--portal-accent-blue))]/10 text-[hsl(var(--portal-accent-blue))]",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
        variantClasses[variant],
        className
      )}
    >
      {Icon && <Icon className="h-4 w-4" />}
      <span className="text-[hsl(var(--portal-text-secondary))]">{label}:</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
