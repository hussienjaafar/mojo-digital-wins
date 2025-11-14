import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export function PageTransition({ children, className }: PageTransitionProps) {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [transitionStage, setTransitionStage] = useState<"fade-in" | "fade-out">("fade-in");

  useEffect(() => {
    if (location !== displayLocation) {
      setTransitionStage("fade-out");
    }
  }, [location, displayLocation]);

  const handleAnimationEnd = () => {
    if (transitionStage === "fade-out") {
      setDisplayLocation(location);
      setTransitionStage("fade-in");
    }
  };

  return (
    <div
      className={cn(
        "transition-opacity duration-300",
        transitionStage === "fade-in" ? "opacity-100" : "opacity-0",
        className
      )}
      onAnimationEnd={handleAnimationEnd}
    >
      {children}
    </div>
  );
}

// Slide transition variant
export function SlideTransition({ children, className }: PageTransitionProps) {
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    setIsVisible(false);
    const timer = setTimeout(() => setIsVisible(true), 150);
    return () => clearTimeout(timer);
  }, [location]);

  return (
    <div
      className={cn(
        "transition-all duration-300",
        isVisible
          ? "opacity-100 translate-x-0"
          : "opacity-0 -translate-x-4",
        className
      )}
    >
      {children}
    </div>
  );
}

// Scale transition variant
export function ScaleTransition({ children, className }: PageTransitionProps) {
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    setIsVisible(false);
    const timer = setTimeout(() => setIsVisible(true), 150);
    return () => clearTimeout(timer);
  }, [location]);

  return (
    <div
      className={cn(
        "transition-all duration-300 origin-top",
        isVisible
          ? "opacity-100 scale-100"
          : "opacity-0 scale-95",
        className
      )}
    >
      {children}
    </div>
  );
}
