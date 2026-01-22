import { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { useDashboardStore } from '@/stores/dashboardStore';
import { toast } from 'sonner';

interface UseInactivityResetOptions {
  /** Inactivity timeout in milliseconds. Default: 30 minutes */
  timeoutMs?: number;
  /** Whether the hook is enabled. Default: true */
  enabled?: boolean;
  /** Whether to show a toast notification on reset. Default: true */
  showToast?: boolean;
}

/**
 * Hook to reset the dashboard date range to "today" after a period of inactivity.
 * 
 * Monitors user activity (mouse move, click, keypress, scroll) and resets
 * the date range when the user returns after being inactive.
 * 
 * Only triggers when the page is visible (uses Page Visibility API).
 * 
 * @param options Configuration options
 */
export function useInactivityReset(options: UseInactivityResetOptions = {}) {
  const { 
    timeoutMs = 30 * 60 * 1000, // 30 minutes default
    enabled = true,
    showToast = true,
  } = options;
  
  const setDateRange = useDashboardStore((s) => s.setDateRange);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!enabled) return;

    const resetToToday = () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      setDateRange(today, today);
      if (showToast) {
        toast.info('Date range reset to today', {
          description: 'Dashboard was inactive for an extended period',
        });
      }
    };

    const checkAndResetIfNeeded = () => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityRef.current;
      
      // If page becomes visible after inactivity timeout, reset to today
      if (timeSinceLastActivity >= timeoutMs && !document.hidden) {
        resetToToday();
      }
    };

    const resetTimer = () => {
      lastActivityRef.current = Date.now();
      
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      
      timerRef.current = setTimeout(() => {
        // Only reset if page is visible when timeout fires
        if (!document.hidden) {
          resetToToday();
        }
      }, timeoutMs);
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // User returned to tab - check if we should reset
        checkAndResetIfNeeded();
        // Restart the timer
        resetTimer();
      }
    };

    // Activity event listeners
    const activityEvents = ['mousemove', 'click', 'keydown', 'scroll', 'touchstart'];
    
    activityEvents.forEach(event => {
      window.addEventListener(event, resetTimer, { passive: true });
    });
    
    // Visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Start initial timer
    resetTimer();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, timeoutMs, showToast, setDateRange]);
}

export default useInactivityReset;
