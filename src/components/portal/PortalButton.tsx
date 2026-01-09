import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

/**
 * PortalButton - Client dashboard button component
 * 
 * Uses portal-theme CSS tokens for consistent styling.
 * 
 * Hierarchy:
 * - primary: Main CTA (max 1 per view)
 * - secondary: Normal actions with subtle border
 * - ghost: Utility actions (no border, transparent)
 * - destructive: Dangerous actions (filled red)
 */
interface PortalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg" | "icon" | "icon-sm";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children?: React.ReactNode;
}

export const PortalButton = React.forwardRef<HTMLButtonElement, PortalButtonProps>(
  ({ 
    className, 
    variant = "primary", 
    size = "md", 
    isLoading = false,
    leftIcon,
    rightIcon,
    disabled,
    children, 
    ...props 
  }, ref) => {
    const isDisabled = disabled || isLoading;
    
    const baseClasses = [
      "inline-flex items-center justify-center gap-2",
      "font-medium transition-all duration-200",
      "focus-visible:outline-none focus-visible:ring-2",
      "focus-visible:ring-[hsl(var(--portal-accent-blue))] focus-visible:ring-offset-2",
      "disabled:pointer-events-none disabled:opacity-50",
      "[&_svg]:pointer-events-none [&_svg]:shrink-0",
    ].join(" ");
    
    const variantClasses = {
      primary: [
        "bg-[hsl(var(--portal-accent-blue))] text-white",
        "rounded-lg",
        "hover:bg-[hsl(var(--portal-accent-blue-hover))]",
        "shadow-sm hover:shadow-md active:shadow-sm",
        "active:translate-y-px",
      ].join(" "),
      secondary: [
        "bg-[hsl(var(--portal-bg-secondary))] text-[hsl(var(--portal-text-primary))]",
        "border border-[hsl(var(--portal-border))]",
        "rounded-lg",
        "hover:bg-[hsl(var(--portal-bg-elevated))] hover:border-[hsl(var(--portal-border-hover))]",
        "active:bg-[hsl(var(--portal-bg-tertiary))]",
      ].join(" "),
      ghost: [
        "bg-transparent text-[hsl(var(--portal-text-secondary))]",
        "rounded-lg",
        "hover:bg-[hsl(var(--portal-bg-hover))] hover:text-[hsl(var(--portal-text-primary))]",
        "active:bg-[hsl(var(--portal-bg-tertiary))]",
      ].join(" "),
      destructive: [
        "bg-[hsl(var(--portal-error))] text-white",
        "rounded-lg",
        "hover:bg-[hsl(var(--portal-error)/0.85)]",
        "shadow-sm hover:shadow-md active:shadow-sm",
        "active:translate-y-px",
      ].join(" "),
    };

    const sizeClasses = {
      sm: "h-8 px-3 text-xs [&_svg]:h-3.5 [&_svg]:w-3.5",
      md: "h-10 px-5 py-2.5 text-sm [&_svg]:h-4 [&_svg]:w-4",
      lg: "h-11 px-6 text-sm [&_svg]:h-4.5 [&_svg]:w-4.5",
      icon: "h-10 w-10 p-0 [&_svg]:h-4 [&_svg]:w-4",
      "icon-sm": "h-8 w-8 p-0 [&_svg]:h-3.5 [&_svg]:w-3.5",
    };

    return (
      <button
        ref={ref}
        className={cn(
          baseClasses,
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        disabled={isDisabled}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="animate-spin" />
            {children}
          </>
        ) : (
          <>
            {leftIcon}
            {children}
            {rightIcon}
          </>
        )}
      </button>
    );
  }
);
PortalButton.displayName = "PortalButton";
