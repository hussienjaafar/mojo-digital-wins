import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export type TitleBlockSize = "sm" | "md" | "lg";
export type TitleBlockIconVariant = "default" | "accent" | "gradient";

export interface TitleBlockProps {
  /** Section title */
  title: string;
  /** Optional subtitle/description */
  subtitle?: string;
  /** Optional icon component */
  icon?: LucideIcon;
  /** Icon styling variant */
  iconVariant?: TitleBlockIconVariant;
  /** Status badge slot (e.g., StatusChip component) */
  statusBadge?: React.ReactNode;
  /** Size variant affects typography scale */
  size?: TitleBlockSize;
  /** Additional class names */
  className?: string;
  /** Additional title class names */
  titleClassName?: string;
}

// ============================================================================
// Size Configuration
// ============================================================================

const sizeConfig: Record<
  TitleBlockSize,
  {
    titleClass: string;
    subtitleClass: string;
    iconContainerSize: string;
    iconSize: string;
    gap: string;
  }
> = {
  sm: {
    titleClass: "text-base font-semibold leading-snug",
    subtitleClass: "text-xs",
    iconContainerSize: "h-8 w-8",
    iconSize: "h-4 w-4",
    gap: "gap-[var(--portal-space-xs)]",
  },
  md: {
    titleClass: "text-xl font-semibold leading-snug tracking-[-0.01em]",
    subtitleClass: "text-sm",
    iconContainerSize: "h-10 w-10",
    iconSize: "h-5 w-5",
    gap: "gap-[var(--portal-space-sm)]",
  },
  lg: {
    titleClass: "text-2xl font-bold leading-tight tracking-[-0.02em]",
    subtitleClass: "text-sm",
    iconContainerSize: "h-12 w-12",
    iconSize: "h-6 w-6",
    gap: "gap-[var(--portal-space-md)]",
  },
};

// ============================================================================
// Icon Container Component
// ============================================================================

interface IconContainerProps {
  icon: LucideIcon;
  variant: TitleBlockIconVariant;
  size: TitleBlockSize;
}

const IconContainer: React.FC<IconContainerProps> = ({
  icon: Icon,
  variant,
  size,
}) => {
  const config = sizeConfig[size];

  const containerClasses = cn(
    // Base layout
    "flex items-center justify-center flex-shrink-0",
    config.iconContainerSize,
    // Shape
    "rounded-[var(--portal-radius-md)]",
    // Transition
    "transition-all duration-[var(--portal-transition-base)]",
    // Variant styles
    variant === "default" && "bg-[hsl(var(--portal-bg-elevated))]",
    variant === "accent" && [
      "bg-[hsl(var(--portal-accent-blue)/0.1)]",
      "border border-[hsl(var(--portal-accent-blue)/0.2)]",
    ],
    variant === "gradient" && [
      "bg-gradient-to-br from-[hsl(var(--portal-accent-blue)/0.15)] to-[hsl(var(--portal-accent-purple)/0.08)]",
      "border border-[hsl(var(--portal-accent-blue)/0.2)]",
      "shadow-[0_0_20px_hsl(var(--portal-accent-blue)/0.12)]",
    ]
  );

  const iconClasses = cn(
    config.iconSize,
    variant === "default" && "text-[hsl(var(--portal-text-muted))]",
    variant === "accent" && "text-[hsl(var(--portal-accent-blue))]",
    variant === "gradient" && "text-[hsl(var(--portal-accent-blue))]"
  );

  return (
    <div className={containerClasses}>
      <Icon className={iconClasses} aria-hidden="true" />
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const TitleBlock = React.forwardRef<HTMLDivElement, TitleBlockProps>(
  (
    {
      title,
      subtitle,
      icon,
      iconVariant = "default",
      statusBadge,
      size = "md",
      className,
      titleClassName,
      ...props
    },
    ref
  ) => {
    const config = sizeConfig[size];

    return (
      <div
        ref={ref}
        className={cn("flex items-start", config.gap, className)}
        {...props}
      >
        {/* Icon Container */}
        {icon && (
          <IconContainer icon={icon} variant={iconVariant} size={size} />
        )}

        {/* Text Content */}
        <div className="flex flex-col min-w-0">
          {/* Title Row with optional Status Badge */}
          <div className="flex items-center gap-[var(--portal-space-sm)] flex-wrap">
            <h2
              className={cn(
                config.titleClass,
                "text-[hsl(var(--portal-text-primary))]",
                titleClassName
              )}
            >
              {title}
            </h2>
            {statusBadge && (
              <div className="flex items-center">{statusBadge}</div>
            )}
          </div>

          {/* Subtitle */}
          {subtitle && (
            <p
              className={cn(
                config.subtitleClass,
                "text-[hsl(var(--portal-text-muted))]",
                "mt-[var(--portal-space-2xs)]",
                "leading-normal"
              )}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
    );
  }
);

TitleBlock.displayName = "TitleBlock";

export default TitleBlock;
