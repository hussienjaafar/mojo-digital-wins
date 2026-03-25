import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

interface PortalFormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  description?: string;
  error?: string;
  containerClassName?: string;
}

/**
 * PortalFormTextarea - A styled textarea that uses portal theme variables correctly
 */
export const PortalFormTextarea = React.forwardRef<HTMLTextAreaElement, PortalFormTextareaProps>(
  ({ label, description, error, containerClassName, className, id, ...props }, ref) => {
    const generatedId = React.useId();
    const textareaId = id || generatedId;

    return (
      <div className={cn("space-y-2", containerClassName)}>
        {label && (
          <Label
            htmlFor={textareaId}
            className="text-sm font-medium text-[hsl(var(--portal-text-primary))]"
          >
            {label}
          </Label>
        )}
        <textarea
          id={textareaId}
          ref={ref}
          className={cn(
            // Base styles
            "flex min-h-[80px] w-full rounded-md px-3 py-2 text-sm",
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
            // Resize
            "resize-y",
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

PortalFormTextarea.displayName = "PortalFormTextarea";
