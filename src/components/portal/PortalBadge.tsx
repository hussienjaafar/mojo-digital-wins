import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface PortalBadgeProps {
  children: React.ReactNode;
  variant?: "success" | "error" | "warning" | "info" | "neutral";
  icon?: LucideIcon;
  pulse?: boolean;
  className?: string;
}

export function PortalBadge({
  children,
  variant = "neutral",
  icon: Icon,
  pulse = false,
  className,
}: PortalBadgeProps) {
  const variantClasses = {
    success: "portal-badge-success",
    error: "portal-badge-error",
    warning: "portal-badge-warning",
    info: "portal-badge-info",
    neutral: "bg-[hsl(var(--portal-bg-elevated))] text-[hsl(var(--portal-text-secondary))] border border-[hsl(var(--portal-border))]",
  };

  return (
    <span
      className={cn(
        "portal-badge inline-flex items-center gap-1.5 transition-all duration-300 hover:scale-105",
        variantClasses[variant],
        pulse && "animate-pulse",
        className
      )}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  );
}
