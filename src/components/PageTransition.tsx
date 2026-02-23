import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

/**
 * Enhanced PageTransition with Claude Console-inspired animations
 * Uses smooth fade-in-up animation for better UX
 */
export function PageTransition({ children, className }: PageTransitionProps) {
  const location = useLocation();

  // Skip animation for /experience route to eliminate delay on high-intent CTA click
  const skipAnimation = location.pathname === "/experience";

  return (
    <div
      className={cn(
        !skipAnimation && "animate-fade-in-up",
        className
      )}
      key={location.pathname}
    >
      {children}
    </div>
  );
}

/**
 * Slide transition - slides in from right
 * Best for: Navigation between sequential pages
 */
export function SlideTransition({ children, className }: PageTransitionProps) {
  const location = useLocation();

  return (
    <div
      className={cn(
        "animate-slide-in-right",
        className
      )}
      key={location.pathname}
    >
      {children}
    </div>
  );
}

/**
 * Pop-in transition - bouncy entrance
 * Best for: Modal-like pages, special features
 */
export function PopTransition({ children, className }: PageTransitionProps) {
  const location = useLocation();

  return (
    <div
      className={cn(
        "animate-pop-in",
        className
      )}
      key={location.pathname}
    >
      {children}
    </div>
  );
}

/**
 * Simple fade transition - minimal and fast
 * Best for: Subtle transitions, performance-critical pages
 */
export function FadeTransition({ children, className }: PageTransitionProps) {
  const location = useLocation();

  return (
    <div
      className={cn(
        "animate-fade-in",
        className
      )}
      key={location.pathname}
    >
      {children}
    </div>
  );
}
