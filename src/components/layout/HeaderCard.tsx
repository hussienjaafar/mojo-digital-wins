import * as React from "react";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export type HeaderCardElevation = "flat" | "raised" | "elevated" | "floating";
export type HeaderCardBorder = "none" | "subtle" | "accent" | "gradient";
export type HeaderCardPadding = "sm" | "md" | "lg";

export interface HeaderCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Elevation level (shadow depth) */
  elevation?: HeaderCardElevation;
  /** Border style */
  border?: HeaderCardBorder;
  /** Padding size */
  padding?: HeaderCardPadding;
  /** Whether to show hover effects */
  interactive?: boolean;
  /** Whether the card is in an active/selected state */
  isActive?: boolean;
  /** Children content */
  children: React.ReactNode;
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Elevation Shadow Mapping
// ============================================================================

const elevationShadows: Record<HeaderCardElevation, string> = {
  flat: "var(--portal-shadow-none)",
  raised: "var(--portal-shadow-card)",
  elevated: "var(--portal-shadow-card-elevated)",
  floating: "var(--portal-shadow-lg)",
};

const elevationHoverShadows: Record<HeaderCardElevation, string> = {
  flat: "var(--portal-shadow-sm)",
  raised: "var(--portal-shadow-card-hover)",
  elevated: "var(--portal-shadow-lg)",
  floating: "var(--portal-shadow-xl)",
};

// ============================================================================
// Padding Mapping
// ============================================================================

const paddingClasses: Record<HeaderCardPadding, string> = {
  sm: "p-[var(--portal-space-md)]",
  md: "p-[var(--portal-space-lg)]",
  lg: "p-[var(--portal-space-xl)]",
};

// ============================================================================
// Border Style Mapping
// ============================================================================

const getBorderStyle = (
  border: HeaderCardBorder,
  isActive: boolean
): React.CSSProperties => {
  if (border === "none") {
    return { borderColor: "transparent" };
  }
  if (border === "subtle") {
    return {
      borderColor: isActive
        ? "hsl(var(--portal-accent-blue) / 0.5)"
        : "hsl(var(--portal-border))",
    };
  }
  if (border === "accent") {
    return {
      borderColor: "hsl(var(--portal-accent-blue))",
    };
  }
  // gradient border is handled via pseudo-element
  return { borderColor: "transparent" };
};

// ============================================================================
// Main Component
// ============================================================================

export const HeaderCard = React.forwardRef<HTMLDivElement, HeaderCardProps>(
  (
    {
      elevation = "raised",
      border = "subtle",
      padding = "md",
      interactive = false,
      isActive = false,
      children,
      className,
      style,
      onMouseEnter: consumerOnMouseEnter,
      onMouseLeave: consumerOnMouseLeave,
      ...props
    },
    ref
  ) => {
    const [isHovered, setIsHovered] = React.useState(false);

    // Compute current shadow based on hover state
    const currentShadow =
      interactive && isHovered
        ? elevationHoverShadows[elevation]
        : elevationShadows[elevation];

    // Compute border styles
    const borderStyles = getBorderStyle(border, isActive);

    // Handle gradient border via wrapper
    const hasGradientBorder = border === "gradient";

    const cardContent = (
      <div
        ref={hasGradientBorder ? undefined : ref}
        className={cn(
          // Base layout
          "relative",
          paddingClasses[padding],
          // Shape
          "rounded-[var(--portal-radius-lg)]",
          // Border
          "border",
          // Background
          "bg-[hsl(var(--portal-bg-secondary))]",
          // Transitions
          "transition-all",
          // Interactive states
          interactive && [
            "cursor-pointer",
            "hover:translate-y-[-2px]",
          ],
          // Active state
          isActive && "ring-1 ring-[hsl(var(--portal-accent-blue)/0.3)]",
          className
        )}
        style={{
          boxShadow: currentShadow,
          transition: "all var(--portal-transition-base)",
          ...borderStyles,
          ...style,
        }}
        onMouseEnter={(e) => {
          if (interactive) setIsHovered(true);
          consumerOnMouseEnter?.(e);
        }}
        onMouseLeave={(e) => {
          if (interactive) setIsHovered(false);
          consumerOnMouseLeave?.(e);
        }}
        {...props}
      >
        {children}
      </div>
    );

    // Wrap with gradient border container if needed
    if (hasGradientBorder) {
      return (
        <div
          ref={ref}
          className={cn(
            "relative p-[1px] rounded-[var(--portal-radius-lg)]",
            "bg-gradient-to-br from-[hsl(var(--portal-accent-blue)/0.3)] via-[hsl(var(--portal-accent-purple)/0.2)] to-transparent"
          )}
        >
          {cardContent}
        </div>
      );
    }

    return cardContent;
  }
);

HeaderCard.displayName = "HeaderCard";

export default HeaderCard;
