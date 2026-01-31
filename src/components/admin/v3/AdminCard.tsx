import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { V3Card, V3CardHeader, V3CardTitle, V3CardDescription, V3CardContent, V3CardFooter, V3CardAccent } from "@/components/v3/V3Card";

interface AdminCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Card title */
  title: string;
  /** Card description */
  description?: string;
  /** Card icon */
  icon?: LucideIcon;
  /** Accent color */
  accent?: V3CardAccent;
  /** Actions rendered in header */
  headerActions?: React.ReactNode;
  /** Footer content */
  footer?: React.ReactNode;
  /** Make card interactive (hover effects) */
  interactive?: boolean;
  /** Additional class names */
  className?: string;
  /** Card content */
  children: React.ReactNode;
}

export const AdminCard: React.FC<AdminCardProps> = ({
  title,
  description,
  icon: Icon,
  accent = "default",
  headerActions,
  footer,
  interactive = false,
  className,
  children,
  ...props
}) => {
  return (
    <V3Card accent={accent} interactive={interactive} className={className} {...props}>
      <V3CardHeader className="relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            {Icon && (
              <div className="p-1.5 rounded-lg bg-[hsl(var(--portal-bg-elevated))]">
                <Icon className="h-5 w-5 text-[hsl(var(--portal-text-muted))]" aria-hidden="true" />
              </div>
            )}
            <div>
              <V3CardTitle>{title}</V3CardTitle>
              {description && <V3CardDescription>{description}</V3CardDescription>}
            </div>
          </div>
          {headerActions && (
            <div className="flex items-center gap-2">
              {headerActions}
            </div>
          )}
        </div>
      </V3CardHeader>
      <V3CardContent>
        {children}
      </V3CardContent>
      {footer && (
        <V3CardFooter>
          {footer}
        </V3CardFooter>
      )}
    </V3Card>
  );
};

AdminCard.displayName = "AdminCard";
