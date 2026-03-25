import * as React from "react";
import { cn } from "@/lib/utils";

interface AdminDetailShellProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * AdminDetailShell - A layout wrapper for admin detail pages
 * Provides portal-theme context, consistent styling, and proper dark mode support.
 * Use this for: OrganizationDetail, UserDetail, or any admin detail view.
 */
export function AdminDetailShell({ children, className }: AdminDetailShellProps) {
  return (
    <div
      className={cn(
        "portal-theme portal-bg min-h-screen",
        // Smooth scrollbar styling
        "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[hsl(var(--portal-border))]",
        className
      )}
    >
      <div className="max-w-[1800px] mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </div>
    </div>
  );
}

AdminDetailShell.displayName = "AdminDetailShell";
