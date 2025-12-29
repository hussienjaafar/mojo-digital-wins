import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, AlertCircle, Clock, Info } from "lucide-react";

const v3BadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-[hsl(var(--portal-bg-elevated))] text-[hsl(var(--portal-text-primary))] border border-[hsl(var(--portal-border))]",
        secondary: "bg-[hsl(var(--portal-bg-secondary))] text-[hsl(var(--portal-text-secondary))]",
        outline: "border border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-secondary))] bg-transparent",
        // Accent variants matching V3Card accents
        blue: "bg-[hsl(var(--portal-accent-blue)/0.15)] text-[hsl(var(--portal-accent-blue))] border border-[hsl(var(--portal-accent-blue)/0.3)]",
        purple: "bg-[hsl(var(--portal-accent-purple)/0.15)] text-[hsl(var(--portal-accent-purple))] border border-[hsl(var(--portal-accent-purple)/0.3)]",
        green: "bg-[hsl(var(--portal-success)/0.15)] text-[hsl(var(--portal-success))] border border-[hsl(var(--portal-success)/0.3)]",
        amber: "bg-[hsl(var(--portal-warning)/0.15)] text-[hsl(var(--portal-warning))] border border-[hsl(var(--portal-warning)/0.3)]",
        red: "bg-[hsl(var(--portal-error)/0.15)] text-[hsl(var(--portal-error))] border border-[hsl(var(--portal-error)/0.3)]",
        cyan: "bg-[hsl(var(--portal-info)/0.15)] text-[hsl(var(--portal-info))] border border-[hsl(var(--portal-info)/0.3)]",
        // Status variants (for colorblind accessibility - includes icons)
        success: "bg-[hsl(var(--portal-success)/0.15)] text-[hsl(var(--portal-success))] border border-[hsl(var(--portal-success)/0.3)]",
        warning: "bg-[hsl(var(--portal-warning)/0.15)] text-[hsl(var(--portal-warning))] border border-[hsl(var(--portal-warning)/0.3)]",
        error: "bg-[hsl(var(--portal-error)/0.15)] text-[hsl(var(--portal-error))] border border-[hsl(var(--portal-error)/0.3)]",
        info: "bg-[hsl(var(--portal-info)/0.15)] text-[hsl(var(--portal-info))] border border-[hsl(var(--portal-info)/0.3)]",
        pending: "bg-[hsl(var(--portal-text-muted)/0.15)] text-[hsl(var(--portal-text-muted))] border border-[hsl(var(--portal-text-muted)/0.3)]",
        // Performance tier variants
        top: "bg-[hsl(var(--portal-success)/0.15)] text-[hsl(var(--portal-success))]",
        high: "bg-[hsl(var(--portal-accent-blue)/0.15)] text-[hsl(var(--portal-accent-blue))]",
        medium: "bg-[hsl(var(--portal-warning)/0.15)] text-[hsl(var(--portal-warning))]",
        low: "bg-[hsl(var(--portal-error)/0.15)] text-[hsl(var(--portal-error))]",
      },
      size: {
        sm: "text-xs px-2 py-0.5",
        default: "text-xs px-2.5 py-0.5",
        lg: "text-sm px-3 py-1",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export type V3BadgeVariant = NonNullable<VariantProps<typeof v3BadgeVariants>["variant"]>;

// Map status variants to icons for WCAG 1.4.1 compliance
const statusIcons: Partial<Record<V3BadgeVariant, React.ElementType>> = {
  success: CheckCircle2,
  warning: AlertCircle,
  error: XCircle,
  info: Info,
  pending: Clock,
};

export interface V3BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof v3BadgeVariants> {
  /** Show status icon for accessibility (auto-enabled for status variants) */
  showIcon?: boolean;
  /** Custom icon to display */
  icon?: React.ReactNode;
}

export const V3Badge = React.forwardRef<HTMLDivElement, V3BadgeProps>(
  ({ className, variant = "default", size, showIcon, icon, children, ...props }, ref) => {
    // Auto-show icons for status variants (colorblind accessibility)
    const shouldShowIcon = showIcon ?? (variant && variant in statusIcons);
    const StatusIcon = variant && statusIcons[variant];
    
    return (
      <div
        ref={ref}
        className={cn(v3BadgeVariants({ variant, size }), className)}
        {...props}
      >
        {icon ? icon : shouldShowIcon && StatusIcon && <StatusIcon className="h-3 w-3" />}
        {children}
      </div>
    );
  }
);
V3Badge.displayName = "V3Badge";

/** Utility function to get badge variant from performance tier */
export const getTierBadgeVariant = (tier: string | null): V3BadgeVariant => {
  switch (tier?.toLowerCase()) {
    case 'top': return 'top';
    case 'high': return 'high';
    case 'medium': return 'medium';
    case 'low': return 'low';
    default: return 'default';
  }
};

/** Utility function to get badge variant from sentiment */
export const getSentimentBadgeVariant = (sentiment: string | null): V3BadgeVariant => {
  switch (sentiment?.toLowerCase()) {
    case 'positive': return 'success';
    case 'negative': return 'error';
    default: return 'default';
  }
};
