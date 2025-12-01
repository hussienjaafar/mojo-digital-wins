import * as React from "react";
import { cn } from "@/lib/utils";

interface PortalCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "glass" | "hover";
  children: React.ReactNode;
}

export const PortalCard = React.forwardRef<HTMLDivElement, PortalCardProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    const variantClasses = {
      default: "portal-card",
      glass: "portal-card-glass",
      hover: "portal-card hover:scale-[1.02]",
    };

    return (
      <div
        ref={ref}
        className={cn(variantClasses[variant], className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
PortalCard.displayName = "PortalCard";

interface PortalCardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const PortalCardHeader = React.forwardRef<HTMLDivElement, PortalCardHeaderProps>(
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
PortalCardHeader.displayName = "PortalCardHeader";

interface PortalCardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
}

export const PortalCardTitle = React.forwardRef<HTMLHeadingElement, PortalCardTitleProps>(
  ({ className, children, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-base sm:text-lg font-semibold portal-text-primary", className)}
      {...props}
    >
      {children}
    </h3>
  )
);
PortalCardTitle.displayName = "PortalCardTitle";

interface PortalCardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

export const PortalCardDescription = React.forwardRef<HTMLParagraphElement, PortalCardDescriptionProps>(
  ({ className, children, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-xs sm:text-sm portal-text-secondary mt-1", className)}
      {...props}
    >
      {children}
    </p>
  )
);
PortalCardDescription.displayName = "PortalCardDescription";

interface PortalCardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const PortalCardContent = React.forwardRef<HTMLDivElement, PortalCardContentProps>(
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
PortalCardContent.displayName = "PortalCardContent";

interface PortalCardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const PortalCardFooter = React.forwardRef<HTMLDivElement, PortalCardFooterProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("p-4 sm:p-6 pt-0 flex items-center gap-2", className)}
      {...props}
    >
      {children}
    </div>
  )
);
PortalCardFooter.displayName = "PortalCardFooter";
