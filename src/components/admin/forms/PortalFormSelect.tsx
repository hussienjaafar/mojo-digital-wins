import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PortalFormSelectOption {
  value: string;
  label: string;
  description?: string;
}

interface PortalFormSelectProps {
  label?: string;
  description?: string;
  error?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: PortalFormSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  containerClassName?: string;
  triggerClassName?: string;
}

/**
 * PortalFormSelect - A styled select that uses portal theme variables correctly
 * Features:
 * - Consistent with PortalFormInput styling
 * - Proper dropdown styling with portal colors
 * - WCAG compliant text colors
 */
export function PortalFormSelect({
  label,
  description,
  error,
  value,
  onValueChange,
  options,
  placeholder = "Select an option",
  disabled,
  containerClassName,
  triggerClassName,
}: PortalFormSelectProps) {
  const selectId = React.useId();

  return (
    <div className={cn("space-y-2", containerClassName)}>
      {label && (
        <Label
          htmlFor={selectId}
          className="text-sm font-medium text-[hsl(var(--portal-text-primary))]"
        >
          {label}
        </Label>
      )}
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger
          id={selectId}
          className={cn(
            // Base styles
            "h-10 w-full",
            // Background - subtle, not solid dark
            "bg-[hsl(var(--portal-bg-secondary))]",
            // Border - always visible
            "border border-[hsl(var(--portal-border))]",
            // Text colors
            "text-[hsl(var(--portal-text-primary))]",
            // Focus states with accent blue
            "focus:outline-none focus:border-[hsl(var(--portal-accent-blue))]",
            "focus:ring-2 focus:ring-[hsl(var(--portal-accent-blue)/0.2)]",
            // Hover state
            "hover:border-[hsl(var(--portal-border-hover))]",
            // Error state
            error && "border-[hsl(var(--portal-error))]",
            triggerClassName
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent
          className={cn(
            "bg-[hsl(var(--portal-bg-secondary))]",
            "border border-[hsl(var(--portal-border))]",
            "shadow-lg z-50"
          )}
        >
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className={cn(
                "text-[hsl(var(--portal-text-primary))]",
                "focus:bg-[hsl(var(--portal-bg-hover))]",
                "cursor-pointer"
              )}
            >
              <div className="flex flex-col">
                <span>{option.label}</span>
                {option.description && (
                  <span className="text-xs text-[hsl(var(--portal-text-muted))]">
                    {option.description}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description && !error && (
        <p className="text-xs text-[hsl(var(--portal-text-muted))]">{description}</p>
      )}
      {error && (
        <p className="text-xs text-[hsl(var(--portal-error))]">{error}</p>
      )}
    </div>
  );
}

PortalFormSelect.displayName = "PortalFormSelect";
