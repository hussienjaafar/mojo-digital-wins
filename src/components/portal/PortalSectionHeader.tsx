import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface PortalSectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconColor?: "blue" | "green" | "orange" | "purple" | "red";
  children?: React.ReactNode;
  className?: string;
}

const iconColorMap = {
  blue: "bg-[hsl(var(--portal-accent-blue)/0.1)] text-[hsl(var(--portal-accent-blue))]",
  green: "bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))]",
  orange: "bg-[hsl(var(--portal-warning)/0.1)] text-[hsl(var(--portal-warning))]",
  purple: "bg-[hsl(213_90%_55%/0.1)] text-[hsl(213_90%_55%)]",
  red: "bg-[hsl(var(--portal-error)/0.1)] text-[hsl(var(--portal-error))]",
};

export function PortalSectionHeader({
  title,
  subtitle,
  icon: Icon,
  iconColor = "blue",
  children,
  className,
}: PortalSectionHeaderProps) {
  return (
    <div className={cn("portal-section-header", className)}>
      <div className="portal-section-title-group">
        {Icon && (
          <div className={cn("portal-section-icon", iconColorMap[iconColor])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div>
          <h2 className="portal-section-title">{title}</h2>
          {subtitle && <p className="portal-section-subtitle">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="portal-section-controls">{children}</div>}
    </div>
  );
}
