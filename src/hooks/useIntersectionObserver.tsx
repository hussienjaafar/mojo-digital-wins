import { useEffect, useRef, useState } from 'react';

interface UseIntersectionObserverOptions extends IntersectionObserverInit {
  freezeOnceVisible?: boolean;
}

export function useIntersectionObserver(
  options: UseIntersectionObserverOptions = {}
): [React.RefObject<HTMLDivElement>, boolean] {
  const { threshold = 0, root = null, rootMargin = '0%', freezeOnceVisible = false } = options;

  const [isIntersecting, setIntersecting] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // If already visible and frozen, don't observe
    if (freezeOnceVisible && isIntersecting) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIntersecting(entry.isIntersecting);
      },
      { threshold, root, rootMargin }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [threshold, root, rootMargin, freezeOnceVisible, isIntersecting]);

  return [elementRef, isIntersecting];
}

// Animated on scroll component
interface AnimateOnScrollProps {
  children: React.ReactNode;
  animation?: 'fade' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'scale' | 'zoom';
  delay?: number;
  duration?: number;
  threshold?: number;
  className?: string;
}

export function AnimateOnScroll({
  children,
  animation = 'fade',
  delay = 0,
  duration = 500,
  threshold = 0.1,
  className = '',
}: AnimateOnScrollProps) {
  const [ref, isVisible] = useIntersectionObserver({
    threshold,
    freezeOnceVisible: true,
  });

  const animations = {
    fade: isVisible
      ? 'opacity-100'
      : 'opacity-0',
    'slide-up': isVisible
      ? 'opacity-100 translate-y-0'
      : 'opacity-0 translate-y-8',
    'slide-down': isVisible
      ? 'opacity-100 translate-y-0'
      : 'opacity-0 -translate-y-8',
    'slide-left': isVisible
      ? 'opacity-100 translate-x-0'
      : 'opacity-0 translate-x-8',
    'slide-right': isVisible
      ? 'opacity-100 translate-x-0'
      : 'opacity-0 -translate-x-8',
    scale: isVisible
      ? 'opacity-100 scale-100'
      : 'opacity-0 scale-95',
    zoom: isVisible
      ? 'opacity-100 scale-100'
      : 'opacity-0 scale-110',
  };

  return (
    <div
      ref={ref}
      className={`transition-all ${animations[animation]} ${className}`}
      style={{
        transitionDelay: `${delay}ms`,
        transitionDuration: `${duration}ms`,
      }}
    >
      {children}
    </div>
  );
}
