import { useState, useEffect, useRef, ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh?: () => Promise<void>;
}

const PullToRefresh = ({ children, onRefresh }: PullToRefreshProps) => {
  const [startY, setStartY] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [canPull, setCanPull] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  
  const threshold = 80; // Distance needed to trigger refresh
  const maxPullDistance = 120; // Maximum pull distance

  useEffect(() => {
    if (!isMobile) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only allow pull-to-refresh when scrolled to the top
      if (window.scrollY === 0) {
        setStartY(e.touches[0].clientY);
        setCanPull(true);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!canPull || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const distance = currentY - startY;

      // Only pull down (positive distance) and limit the maximum distance
      if (distance > 0) {
        // Add resistance as user pulls further
        const resistanceFactor = 1 - Math.min(distance / maxPullDistance, 0.8);
        const adjustedDistance = distance * resistanceFactor;
        setPullDistance(Math.min(adjustedDistance, maxPullDistance));
        
        // Prevent page scroll when pulling
        if (distance > 10) {
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = async () => {
      if (!canPull || isRefreshing) return;

      setCanPull(false);

      // Trigger refresh if pulled beyond threshold
      if (pullDistance > threshold) {
        setIsRefreshing(true);
        
        try {
          if (onRefresh) {
            await onRefresh();
          } else {
            // Default behavior: reload the page
            await new Promise(resolve => setTimeout(resolve, 1000));
            window.location.reload();
          }
        } catch (error) {
          console.error('Refresh failed:', error);
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
        }
      } else {
        // Snap back if not pulled enough
        setPullDistance(0);
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [startY, pullDistance, canPull, isRefreshing, isMobile, onRefresh]);

  if (!isMobile) {
    return <>{children}</>;
  }

  const rotation = isRefreshing ? 'animate-spin' : '';
  const opacity = Math.min(pullDistance / threshold, 1);
  const scale = Math.min(pullDistance / threshold, 1);

  return (
    <div ref={containerRef} className="relative">
      {/* Pull-to-refresh indicator */}
      <div
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center pointer-events-none"
        style={{
          transform: `translateY(${isRefreshing ? '60px' : `${Math.min(pullDistance, maxPullDistance)}px`})`,
          transition: isRefreshing || pullDistance === 0 ? 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
          opacity: opacity,
        }}
      >
        <div 
          className="bg-background/90 backdrop-blur-md border-2 border-secondary/30 rounded-full p-3 shadow-lg"
          style={{
            transform: `scale(${scale})`,
            transition: pullDistance === 0 ? 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
          }}
        >
          <RefreshCw 
            className={`w-6 h-6 text-secondary ${rotation}`}
            style={{
              transform: isRefreshing ? '' : `rotate(${pullDistance * 2}deg)`,
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          transform: `translateY(${isRefreshing ? '0' : '0'}px)`,
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;
