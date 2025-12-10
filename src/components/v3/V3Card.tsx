import * as React from "react";
import { cn } from "@/lib/utils";

export type V3CardAccent = "blue" | "green" | "purple" | "amber" | "red" | "default";

export interface V3CardProps extends React.HTMLAttributes<HTMLDivElement> {
  accent?: V3CardAccent;
  children: React.ReactNode;
  interactive?: boolean;
  /** Optional title - renders V3CardHeader with title automatically */
  title?: string;
  /** Optional subtitle/description - renders below title */
  subtitle?: string;
}

const accentStyles: Record<V3CardAccent, string> = {
  blue: "border-l-4 border-l-[hsl(var(--portal-accent-blue))]",
  green: "border-l-4 border-l-[hsl(var(--portal-success))]",
  purple: "border-l-4 border-l-[hsl(var(--portal-accent-purple))]",
  amber: "border-l-4 border-l-[hsl(var(--portal-warning))]",
  red: "border-l-4 border-l-[hsl(var(--portal-error))]",
  default: "",
};

export const V3Card = React.forwardRef<HTMLDivElement, V3CardProps>(
  ({ className, accent = "default", interactive = false, title, subtitle, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-card))]",
          "shadow-sm transition-all duration-200 relative",
          accentStyles[accent],
          interactive && [
            "hover:border-[hsl(var(--portal-border-hover))]",
            "hover:shadow-md",
            "focus-within:ring-2 focus-within:ring-[hsl(var(--portal-accent-blue))] focus-within:ring-offset-2",
          ],
          className
        )}
        {...props}
      >
        {(title || subtitle) && (
          <div className="p-4 sm:p-6 pb-3 sm:pb-4">
            {title && (
              <h3 className="text-base sm:text-lg font-semibold text-[hsl(var(--portal-text-primary))]">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs sm:text-sm text-[hsl(var(--portal-text-secondary))] mt-1">
                {subtitle}
              </p>
            )}
          </div>
        )}
        <div className={cn(title || subtitle ? "p-4 sm:p-6 pt-0" : "p-4 sm:p-6")}>
          {children}
        </div>
      </div>
    );
  }
);
V3Card.displayName = "V3Card";

interface V3CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const V3CardHeader = React.forwardRef<HTMLDivElement, V3CardHeaderProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("p-4 sm:p-6 pb-3 sm:pb-4", className)}
      {...props}
    >
      {children}
    </div>
  )
);
V3CardHeader.displayName = "V3CardHeader";

interface V3CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
  as?: "h2" | "h3" | "h4";
}

export const V3CardTitle = React.forwardRef<HTMLHeadingElement, V3CardTitleProps>(
  ({ className, children, as: Component = "h3", ...props }, ref) => (
    <Component
      ref={ref}
      className={cn(
        "text-base sm:text-lg font-semibold text-[hsl(var(--portal-text-primary))]",
        className
      )}
      {...props}
    >
      {children}
    </Component>
  )
);
V3CardTitle.displayName = "V3CardTitle";

interface V3CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

export const V3CardDescription = React.forwardRef<HTMLParagraphElement, V3CardDescriptionProps>(
  ({ className, children, ...props }, ref) => (
    <p
      ref={ref}
      className={cn(
        "text-xs sm:text-sm text-[hsl(var(--portal-text-secondary))] mt-1",
        className
      )}
      {...props}
    >
      {children}
    </p>
  )
);
V3CardDescription.displayName = "V3CardDescription";

interface V3CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const V3CardContent = React.forwardRef<HTMLDivElement, V3CardContentProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("p-4 sm:p-6 pt-0", className)}
      {...props}
    >
      {children}
    </div>
  )
);
V3CardContent.displayName = "V3CardContent";

interface V3CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const V3CardFooter = React.forwardRef<HTMLDivElement, V3CardFooterProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "p-4 sm:p-6 pt-0 flex items-center gap-2",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
V3CardFooter.displayName = "V3CardFooter";
