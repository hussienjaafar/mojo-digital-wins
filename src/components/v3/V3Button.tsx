import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const v3ButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--portal-accent-blue))] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Primary - main CTA button
        primary: [
          "bg-[hsl(var(--portal-accent-blue))] text-white",
          "hover:bg-[hsl(var(--portal-accent-blue-hover))]",
          "shadow-sm hover:shadow-md",
        ].join(" "),
        // Secondary - secondary actions
        secondary: [
          "bg-[hsl(var(--portal-bg-secondary))] text-[hsl(var(--portal-text-primary))]",
          "border border-[hsl(var(--portal-border))]",
          "hover:bg-[hsl(var(--portal-bg-hover))] hover:border-[hsl(var(--portal-border-hover))]",
        ].join(" "),
        // Outline - tertiary actions
        outline: [
          "border border-[hsl(var(--portal-border))] bg-transparent",
          "text-[hsl(var(--portal-text-primary))]",
          "hover:bg-[hsl(var(--portal-bg-hover))]",
        ].join(" "),
        // Ghost - minimal footprint
        ghost: [
          "bg-transparent text-[hsl(var(--portal-text-secondary))]",
          "hover:bg-[hsl(var(--portal-bg-hover))] hover:text-[hsl(var(--portal-text-primary))]",
        ].join(" "),
        // Destructive - dangerous actions
        destructive: [
          "bg-[hsl(var(--portal-error))] text-white",
          "hover:bg-[hsl(var(--portal-error)/0.9)]",
          "shadow-sm",
        ].join(" "),
        // Success - positive actions
        success: [
          "bg-[hsl(var(--portal-success))] text-white",
          "hover:bg-[hsl(var(--portal-success)/0.9)]",
          "shadow-sm",
        ].join(" "),
        // Link - text-like button
        link: [
          "text-[hsl(var(--portal-accent-blue))] underline-offset-4",
          "hover:underline",
        ].join(" "),
      },
      size: {
        sm: "h-8 px-3 text-xs [&_svg]:h-3.5 [&_svg]:w-3.5",
        default: "h-10 px-4 py-2 [&_svg]:h-4 [&_svg]:w-4",
        lg: "h-11 px-6 text-base [&_svg]:h-5 [&_svg]:w-5",
        xl: "h-12 px-8 text-base [&_svg]:h-5 [&_svg]:w-5",
        icon: "h-10 w-10 [&_svg]:h-4 [&_svg]:w-4",
        "icon-sm": "h-8 w-8 [&_svg]:h-3.5 [&_svg]:w-3.5",
        "icon-lg": "h-11 w-11 [&_svg]:h-5 [&_svg]:w-5",
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
