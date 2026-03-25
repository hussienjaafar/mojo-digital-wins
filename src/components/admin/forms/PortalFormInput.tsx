import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

interface PortalFormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
  error?: string;
  containerClassName?: string;
}

/**
 * PortalFormInput - A styled input that uses portal theme variables correctly
 * Features:
 * - Transparent background with visible border
 * - Proper focus states with accent blue ring
 * - WCAG compliant text colors
 * - Consistent with portal design system
 */
export const PortalFormInput = React.forwardRef<HTMLInputElement, PortalFormInputProps>(
  ({ label, description, error, containerClassName, className, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    return (
      <div className={cn("space-y-2", containerClassName)}>
        {label && (
          <Label
            htmlFor={inputId}
            className="text-sm font-medium text-[hsl(var(--portal-text-primary))]"
          >
            {label}
          </Label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={cn(
            // Base styles
            "flex h-10 w-full rounded-md px-3 py-2 text-sm",
            // Background - subtle, not solid dark
            "bg-[hsl(var(--portal-bg-secondary))]",
            // Border - always visible
            "border border-[hsl(var(--portal-border))]",
            // Text colors
            "text-[hsl(var(--portal-text-primary))]",
            "placeholder:text-[hsl(var(--portal-text-muted))]",
            // Focus states with accent blue
            "focus:outline-none focus:border-[hsl(var(--portal-accent-blue))]",
            "focus:ring-2 focus:ring-[hsl(var(--portal-accent-blue)/0.2)]",
            // Hover state
            "hover:border-[hsl(var(--portal-border-hover))]",
            // Transitions
            "transition-all duration-200",
            // Disabled state
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[hsl(var(--portal-bg-tertiary))]",
            // Error state
            error && "border-[hsl(var(--portal-error))] focus:border-[hsl(var(--portal-error))] focus:ring-[hsl(var(--portal-error)/0.2)]",
            className
          )}
          {...props}
        />
        {description && !error && (
          <p className="text-xs text-[hsl(var(--portal-text-muted))]">{description}</p>
        )}
        {error && (
          <p className="text-xs text-[hsl(var(--portal-error))]">{error}</p>
        )}
      </div>
    );
  }
);

PortalFormInput.displayName = "PortalFormInput";
