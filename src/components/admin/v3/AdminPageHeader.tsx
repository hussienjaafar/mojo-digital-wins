import React from "react";
import { type LucideIcon, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { V3Button } from "@/components/v3/V3Button";

interface AdminPageHeaderProps {
  /** Page title */
  title: string;
  /** Page description/subtitle */
  description?: string;
  /** Page icon */
  icon?: LucideIcon;
  /** Icon accent color */
  iconColor?: "blue" | "green" | "purple" | "amber" | "red";
  /** Primary actions (rendered on the right) */
  actions?: React.ReactNode;
  /** Show refresh button */
  onRefresh?: () => void;
  /** Refresh button loading state */
  isRefreshing?: boolean;
  /** Additional class names */
  className?: string;
  /** Children rendered below header */
  children?: React.ReactNode;
}

const iconColorClasses: Record<string, string> = {
  blue: "bg-[hsl(var(--portal-accent-blue)/0.1)] text-[hsl(var(--portal-accent-blue))]",
  green: "bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))]",
  purple: "bg-[hsl(var(--portal-accent-purple)/0.1)] text-[hsl(var(--portal-accent-purple))]",
  amber: "bg-[hsl(var(--portal-warning)/0.1)] text-[hsl(var(--portal-warning))]",
  red: "bg-[hsl(var(--portal-error)/0.1)] text-[hsl(var(--portal-error))]",
};

export const AdminPageHeader: React.FC<AdminPageHeaderProps> = ({
  title,
  description,
  icon: Icon,
  iconColor = "blue",
  actions,
  onRefresh,
  isRefreshing = false,
  className,
  children,
}) => {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Title Section */}
        <div className="flex items-center gap-3">
          {Icon && (
            <div className={cn("p-2.5 rounded-xl transition-all duration-200", iconColorClasses[iconColor])}>
              <Icon className="h-6 w-6" aria-hidden="true" />
            </div>
          )}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[hsl(var(--portal-text-primary))]">
              {title}
            </h1>
            {description && (
              <p className="mt-0.5 text-sm text-[hsl(var(--portal-text-secondary))]">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Actions Section */}
        <div className="flex items-center gap-2 flex-wrap">
          {onRefresh && (
            <V3Button
              variant="secondary"
              size="sm"
              onClick={onRefresh}
              isLoading={isRefreshing}
              leftIcon={<RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />}
            >
              Refresh
            </V3Button>
          )}
          {actions}
        </div>
      </div>
      {children}
    </div>
  );
};

AdminPageHeader.displayName = "AdminPageHeader";
