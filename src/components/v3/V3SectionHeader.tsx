import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface V3SectionHeaderProps {
  /** Section title */
  title: string;
  /** Optional subtitle/description */
  subtitle?: string;
  /** Optional icon */
  icon?: LucideIcon;
  /** Optional actions (buttons, toggles, etc.) */
  actions?: React.ReactNode;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Additional class names */
  className?: string;
}

export const V3SectionHeader: React.FC<V3SectionHeaderProps> = ({
  title,
  subtitle,
  icon: Icon,
  actions,
  size = "md",
  className,
}) => {
  const sizeClasses = {
    sm: {
      title: "text-sm font-semibold",
      subtitle: "text-xs",
      icon: "h-4 w-4",
      gap: "gap-2",
    },
    md: {
      title: "text-base font-semibold",
      subtitle: "text-sm",
      icon: "h-5 w-5",
      gap: "gap-3",
    },
    lg: {
      title: "text-lg font-bold",
      subtitle: "text-sm",
      icon: "h-6 w-6",
      gap: "gap-3",
    },
  };

  const styles = sizeClasses[size];

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center sm:justify-between",
        styles.gap,
        className
      )}
    >
      <div className={cn("flex items-center", styles.gap)}>
        {Icon && (
          <div className="p-1.5 rounded-lg bg-[hsl(var(--portal-bg-elevated))]">
            <Icon
              className={cn(styles.icon, "text-[hsl(var(--portal-text-muted))]")}
              aria-hidden="true"
            />
          </div>
        )}
        <div>
          <h2 className={cn(styles.title, "text-[hsl(var(--portal-text-primary))]")}>
            {title}
          </h2>
          {subtitle && (
            <p className={cn(styles.subtitle, "text-[hsl(var(--portal-text-secondary))] mt-0.5")}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
};

V3SectionHeader.displayName = "V3SectionHeader";
