import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

/**
 * V3Button - Enterprise-grade button system
 * 
 * Hierarchy (use sparingly → frequently):
 * - Primary: Max 1 per view. Main CTA (Add Integration, Create Alert, Save)
 * - Secondary: Normal actions with subtle surface
 * - Ghost/Tertiary: Utility actions (Refresh, Export, Test, Search)
 * - Icon: Square buttons for icon-only actions
 * - Destructive: Dangerous actions (Delete, Remove) - always filled red
 * 
 * Yellow is NEVER used for borders. Reserved only for:
 * - Selected/active state indicators
 * - Status badges
 */
const v3ButtonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-lg font-medium transition-all duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "focus-visible:ring-[hsl(var(--portal-accent-blue))]",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        // Primary - main CTA, filled blue, use sparingly (max 1 per view)
        primary: [
          "bg-[hsl(var(--portal-accent-blue))] text-white",
          "hover:bg-[hsl(var(--portal-accent-blue-hover))]",
          "shadow-sm hover:shadow-md active:shadow-sm",
          "active:translate-y-px",
        ].join(" "),
        
        // Secondary - subtle surface with soft border, for normal actions
        secondary: [
          "bg-[hsl(var(--portal-bg-secondary))] text-[hsl(var(--portal-text-primary))]",
          "border border-[hsl(var(--portal-border))]",
          "hover:bg-[hsl(var(--portal-bg-elevated))] hover:border-[hsl(var(--portal-border-hover))]",
          "active:bg-[hsl(var(--portal-bg-tertiary))]",
        ].join(" "),
        
        // Outline - transparent with visible border, alternative secondary
        outline: [
          "border border-[hsl(var(--portal-border))] bg-transparent",
          "text-[hsl(var(--portal-text-primary))]",
          "hover:bg-[hsl(var(--portal-bg-hover))] hover:border-[hsl(var(--portal-border-hover))]",
          "active:bg-[hsl(var(--portal-bg-tertiary))]",
        ].join(" "),
        
        // Ghost/Tertiary - minimal footprint, for utility actions (Refresh, Export, Test)
        ghost: [
          "bg-transparent text-[hsl(var(--portal-text-secondary))]",
          "hover:bg-[hsl(var(--portal-bg-hover))] hover:text-[hsl(var(--portal-text-primary))]",
          "active:bg-[hsl(var(--portal-bg-tertiary))]",
        ].join(" "),
        
        // Destructive - filled red, NEVER yellow, NEVER outline
        destructive: [
          "bg-[hsl(var(--portal-error))] text-white",
          "hover:bg-[hsl(var(--portal-error)/0.85)]",
          "shadow-sm hover:shadow-md active:shadow-sm",
          "active:translate-y-px",
        ].join(" "),
        
        // Destructive Ghost - for less prominent destructive actions
        "destructive-ghost": [
          "bg-transparent text-[hsl(var(--portal-error))]",
          "hover:bg-[hsl(var(--portal-error)/0.1)]",
          "active:bg-[hsl(var(--portal-error)/0.15)]",
        ].join(" "),
        
        // Success - positive confirmations
        success: [
          "bg-[hsl(var(--portal-success))] text-white",
          "hover:bg-[hsl(var(--portal-success)/0.85)]",
          "shadow-sm hover:shadow-md active:shadow-sm",
          "active:translate-y-px",
        ].join(" "),
        
        // Link - text-like button for inline actions
        link: [
          "text-[hsl(var(--portal-accent-blue))] underline-offset-4 p-0 h-auto",
          "hover:underline",
        ].join(" "),
      },
      size: {
        // Improved sizing with more padding for premium feel
        sm: "h-8 px-3 text-xs [&_svg]:h-3.5 [&_svg]:w-3.5",
        default: "h-10 px-5 py-2.5 text-sm [&_svg]:h-4 [&_svg]:w-4",
        lg: "h-11 px-6 text-sm [&_svg]:h-4.5 [&_svg]:w-4.5",
        xl: "h-12 px-8 text-base [&_svg]:h-5 [&_svg]:w-5",
        // Icon buttons - square/circular with consistent sizing
        icon: "h-10 w-10 p-0 [&_svg]:h-4 [&_svg]:w-4",
        "icon-sm": "h-8 w-8 p-0 [&_svg]:h-3.5 [&_svg]:w-3.5",
        "icon-lg": "h-11 w-11 p-0 [&_svg]:h-5 [&_svg]:w-5",
        "icon-xs": "h-7 w-7 p-0 [&_svg]:h-3 [&_svg]:w-3",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export interface V3ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof v3ButtonVariants> {
  /** Render as child element (for Next.js Link, etc.) */
  asChild?: boolean;
  /** Show loading spinner and disable button */
  isLoading?: boolean;
  /** Loading text to display (replaces children when loading) */
  loadingText?: string;
  /** Icon to show on left side */
  leftIcon?: React.ReactNode;
  /** Icon to show on right side */
  rightIcon?: React.ReactNode;
}

export const V3Button = React.forwardRef<HTMLButtonElement, V3ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      isLoading = false,
      loadingText,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    const isDisabled = disabled || isLoading;

    return (
      <Comp
        className={cn(v3ButtonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isDisabled}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="animate-spin" />
            {loadingText || children}
          </>
        ) : (
          <>
            {leftIcon}
            {children}
            {rightIcon}
          </>
        )}
      </Comp>
    );
  }
);
V3Button.displayName = "V3Button";

// Export variants for external use
export { v3ButtonVariants };
