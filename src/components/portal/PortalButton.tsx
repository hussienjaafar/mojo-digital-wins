import * as React from "react";
import { cn } from "@/lib/utils";

interface PortalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export const PortalButton = React.forwardRef<HTMLButtonElement, PortalButtonProps>(
  ({ className, variant = "primary", size = "md", children, ...props }, ref) => {
    const variantClasses = {
      primary: "portal-btn-primary",
      secondary: "portal-btn-secondary",
      ghost: "portal-btn-secondary hover:bg-transparent hover:border-transparent portal-text-secondary hover:portal-text-primary",
    };

    const sizeClasses = {
      sm: "text-xs px-3 py-1.5",
      md: "text-sm px-4 py-2",
      lg: "text-base px-6 py-3",
    };

    return (
      <button
        ref={ref}
        className={cn(
          variantClasses[variant],
          sizeClasses[size],
          "inline-flex items-center justify-center gap-2",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
PortalButton.displayName = "PortalButton";
