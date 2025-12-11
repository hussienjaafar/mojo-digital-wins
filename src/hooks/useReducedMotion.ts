import { useState, useEffect } from "react";

/**
 * Hook that detects if the user prefers reduced motion
 * Returns true if the user has enabled reduced motion in their system preferences
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    // Check if window exists (SSR safety)
    if (typeof window === "undefined") return false;
    
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    return mediaQuery.matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    // Modern browsers
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return prefersReducedMotion;
}

/**
 * Returns animation variants that respect reduced motion preferences
 */
export function useMotionVariants() {
  const prefersReducedMotion = useReducedMotion();

  return {
    prefersReducedMotion,
    fadeIn: prefersReducedMotion
      ? { opacity: 1 }
      : { opacity: 0, transition: { duration: 0.3 } },
    fadeInVisible: prefersReducedMotion
      ? { opacity: 1 }
      : { opacity: 1, transition: { duration: 0.3 } },
    scaleOnHover: prefersReducedMotion
      ? {}
      : { scale: 1.01 },
    scaleOnTap: prefersReducedMotion
      ? {}
      : { scale: 0.99 },
    staggerChildren: prefersReducedMotion ? 0 : 0.05,
    animationDuration: prefersReducedMotion ? 0 : 0.3,
  };
}
