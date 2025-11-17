import { useEffect, useRef, useState } from "react";

interface UseScrollAnimationOptions {
  threshold?: number;
  triggerOnce?: boolean;
  startVisible?: boolean; // NEW: Allow sections to be visible by default
}

export const useScrollAnimation = (options: UseScrollAnimationOptions = {}) => {
  const { threshold = 0.1, triggerOnce = true, startVisible = true } = options; // Changed default to true
  const [isVisible, setIsVisible] = useState(startVisible); // Start visible by default
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // If starting visible, only trigger animation once
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (triggerOnce && ref.current) {
            observer.unobserve(ref.current);
          }
        } else if (!triggerOnce && !startVisible) {
          setIsVisible(false);
        }
      },
      { threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [threshold, triggerOnce, startVisible]);

  return { ref, isVisible };
};
