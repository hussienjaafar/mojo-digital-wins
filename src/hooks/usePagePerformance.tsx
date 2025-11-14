import { useEffect, useState } from 'react';

interface PageLoadMetrics {
  fcp?: number; // First Contentful Paint
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  ttfb?: number; // Time to First Byte
}

export function usePagePerformance() {
  const [metrics, setMetrics] = useState<PageLoadMetrics>({});

  useEffect(() => {
    // Measure TTFB
    const navigationTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigationTiming) {
      setMetrics(prev => ({
        ...prev,
        ttfb: navigationTiming.responseStart - navigationTiming.requestStart,
      }));
    }

    // Observe paint timing
    const paintObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          setMetrics(prev => ({ ...prev, fcp: entry.startTime }));
        }
      }
    });
    paintObserver.observe({ entryTypes: ['paint'] });

    // Observe LCP
    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1] as any;
      setMetrics(prev => ({ ...prev, lcp: lastEntry.renderTime || lastEntry.loadTime }));
    });
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

    // Observe FID
    const fidObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        setMetrics(prev => ({ ...prev, fid: (entry as any).processingStart - entry.startTime }));
      }
    });
    fidObserver.observe({ entryTypes: ['first-input'] });

    // Observe CLS
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
          setMetrics(prev => ({ ...prev, cls: clsValue }));
        }
      }
    });
    clsObserver.observe({ entryTypes: ['layout-shift'] });

    return () => {
      paintObserver.disconnect();
      lcpObserver.disconnect();
      fidObserver.disconnect();
      clsObserver.disconnect();
    };
  }, []);

  return metrics;
}

// Log performance metrics to console in development
export function logPerformanceMetrics(metrics: PageLoadMetrics) {
  if (process.env.NODE_ENV === 'development') {
    import('@/lib/logger').then(({ logger }) => {
      logger.group('📊 Page Performance Metrics');
      if (metrics.ttfb !== undefined) {
        logger.performance('TTFB', metrics.ttfb);
      }
      if (metrics.fcp !== undefined) {
        logger.performance('FCP', metrics.fcp);
      }
      if (metrics.lcp !== undefined) {
        logger.performance('LCP', metrics.lcp);
      }
      if (metrics.fid !== undefined) {
        logger.performance('FID', metrics.fid);
      }
      if (metrics.cls !== undefined) {
        logger.info(`CLS: ${metrics.cls.toFixed(3)} ${metrics.cls < 0.1 ? '✅' : '⚠️'}`);
      }
      logger.groupEnd();
    });
  }
}
