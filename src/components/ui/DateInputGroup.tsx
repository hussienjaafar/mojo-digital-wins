/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export type DateInputSize = "sm" | "md";
export type DateInputAccent = "blue" | "purple";

export interface DateInputStyleConfig {
  /** Size variant */
  size?: DateInputSize;
  /** Accent color for hover/focus states */
  accent?: DateInputAccent;
  /** Whether the input is currently open/active */
  isOpen?: boolean;
  /** Whether the input is in an active/selected state (e.g., comparison enabled) */
  isActive?: boolean;
}

export interface DateInputTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    DateInputStyleConfig {
  /** Additional class names */
  className?: string;
  /** Custom width class (e.g., "w-[140px]") */
  widthClass?: string;
}

export interface DateInputSelectTriggerProps extends DateInputStyleConfig {
  /** Additional class names */
  className?: string;
  /** Custom width class */
  widthClass?: string;
}

// ============================================================================
// Style Utilities
// ============================================================================

/**
 * Get height class based on size variant
 */
export const getDateInputHeight = (size: DateInputSize = "md"): string => {
  // Mobile: 44px (h-11) for touch targets; Tablet+: original sizing
  return size === "sm" ? "h-11 sm:h-8" : "h-11 sm:h-9";
};

/**
 * Get accent-specific hover/focus classes (without transition)
 */
export const getDateInputAccentClasses = (
  accent: DateInputAccent = "blue",
  isOpen: boolean = false,
  isActive: boolean = false
): string[] => {
  const accentToken = accent === "blue" ? "portal-accent-blue" : "portal-accent-purple";

  const classes: string[] = [
    // Hover state
    `hover:border-[hsl(var(--${accentToken})/0.5)]`,
    `hover:shadow-[0_0_12px_hsl(var(--${accentToken})/0.08)]`,
    // Focus state
    `focus:border-[hsl(var(--${accentToken}))]`,
    `focus:shadow-[0_0_16px_hsl(var(--${accentToken})/0.12)]`,
    `focus-visible:ring-2`,
    `focus-visible:ring-[hsl(var(--${accentToken})/0.3)]`,
    `focus-visible:ring-offset-1`,
    `focus-visible:ring-offset-[hsl(var(--portal-bg-secondary))]`,
  ];

  // Open state
  if (isOpen) {
    classes.push(
      `border-[hsl(var(--${accentToken}))]`,
      `shadow-[0_0_16px_hsl(var(--${accentToken})/0.12)]`
    );
  }

  // Active state (e.g., comparison enabled)
  if (isActive && !isOpen) {
    classes.push(
      `border-[hsl(var(--${accentToken})/0.5)]`,
      `bg-[hsl(var(--${accentToken})/0.05)]`
    );
  }

  return classes;
};

/**
 * Get base classes for date input triggers (without transition duration)
 */
export const getDateInputBaseClasses = (): string[] => [
  // Shape
  "rounded-[var(--portal-radius-sm)]",
  // Colors
  "bg-[hsl(var(--portal-bg-secondary))]",
  "border",
  "border-[hsl(var(--portal-border))]",
  "text-[hsl(var(--portal-text-primary))]",
  // Transition (without duration - will be applied via inline style)
  "transition-all",
  // Ensure outline is removed for custom focus
  "focus:outline-none",
];

/**
 * Get combined classes for a date input trigger
 */
export const getDateInputTriggerClasses = (config: DateInputStyleConfig = {}): string => {
  const { size = "md", accent = "blue", isOpen = false, isActive = false } = config;

  return cn(
    getDateInputHeight(size),
    ...getDateInputBaseClasses(),
    ...getDateInputAccentClasses(accent, isOpen, isActive)
  );
};

/**
 * Get inline style with proper transition token
 */
export const getDateInputTransitionStyle = (
  speed: "fast" | "base" = "base"
): React.CSSProperties => ({
  transition: `all var(--portal-transition-${speed})`,
});

// ============================================================================
// DateInputGroup Container Component
// ============================================================================

export interface DateInputGroupProps {
  /** Container class names */
  className?: string;
  /** Children */
  children: React.ReactNode;
}

/**
 * Container for grouping date input controls with proper spacing
 */
export const DateInputGroup: React.FC<DateInputGroupProps> = ({
  className,
  children,
}) => {
  return (
    <div className={cn("flex items-center gap-[var(--portal-space-xs)]", className)}>
      {children}
    </div>
  );
};

DateInputGroup.displayName = "DateInputGroup";

// ============================================================================
// DateInputTrigger Component (Button-based)
// ============================================================================

/**
 * A styled button trigger for date inputs (calendar popover, etc.)
 * Uses token-correct transitions via inline style.
 */
export const DateInputTrigger = React.forwardRef<
  HTMLButtonElement,
  DateInputTriggerProps
>(
  (
    {
      size = "md",
      accent = "blue",
      isOpen = false,
      isActive = false,
      widthClass,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          getDateInputTriggerClasses({ size, accent, isOpen, isActive }),
          "inline-flex items-center justify-start gap-2",
          "px-[var(--portal-space-sm)]",
          "text-left font-normal text-sm",
          widthClass,
          className
        )}
        style={getDateInputTransitionStyle("base")}
        {...props}
      >
        {children}
      </button>
    );
  }
);

DateInputTrigger.displayName = "DateInputTrigger";

// ============================================================================
// Utility: Get SelectTrigger classes (for shadcn Select)
// ============================================================================

/**
 * Get classes to apply to shadcn SelectTrigger for consistent date input styling.
 * Note: Apply transition via inline style separately.
 * Includes focus:ring-* overrides since SelectTrigger uses focus: (not focus-visible:).
 */
export const getSelectTriggerClasses = (
  config: DateInputSelectTriggerProps = {}
): string => {
  const {
    size = "md",
    accent = "blue",
    isOpen = false,
    isActive = false,
    widthClass,
    className,
  } = config;

  const accentToken = accent === "blue" ? "portal-accent-blue" : "portal-accent-purple";

  return cn(
    getDateInputTriggerClasses({ size, accent, isOpen, isActive }),
    // Override shadcn SelectTrigger's default focus:ring-* with portal tokens
    "focus:ring-2",
    `focus:ring-[hsl(var(--${accentToken})/0.3)]`,
    "focus:ring-offset-1",
    "focus:ring-offset-[hsl(var(--portal-bg-secondary))]",
    widthClass,
    className
  );
};

// ============================================================================
// Icon Wrapper with Proper Transition
// ============================================================================

export interface DateInputIconProps {
  /** Icon component or element */
  children: React.ReactNode;
  /** Whether the parent is open/active */
  isOpen?: boolean;
  /** Accent color */
  accent?: DateInputAccent;
  /** Additional class names */
  className?: string;
  /** Whether to rotate 180deg when open */
  rotateOnOpen?: boolean;
}

/**
 * Icon wrapper that handles color transitions properly (via inline style)
 */
export const DateInputIcon: React.FC<DateInputIconProps> = ({
  children,
  isOpen = false,
  accent = "blue",
  className,
  rotateOnOpen = false,
}) => {
  const accentToken = accent === "blue" ? "portal-accent-blue" : "portal-accent-purple";

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center",
        "transition-all",
        isOpen
          ? `text-[hsl(var(--${accentToken}))]`
          : "text-[hsl(var(--portal-text-muted))]",
        rotateOnOpen && isOpen && "rotate-180",
        className
      )}
      style={getDateInputTransitionStyle("fast")}
      aria-hidden="true"
    >
      {children}
    </span>
  );
};

DateInputIcon.displayName = "DateInputIcon";

// ============================================================================
// Exports
// ============================================================================

export default DateInputGroup;
