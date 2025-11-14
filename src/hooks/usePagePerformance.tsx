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
    console.group('📊 Page Performance Metrics');
    if (metrics.ttfb !== undefined) {
      console.log(`⚡ TTFB: ${metrics.ttfb.toFixed(2)}ms ${metrics.ttfb < 600 ? '✅' : '⚠️'}`);
    }
    if (metrics.fcp !== undefined) {
      console.log(`🎨 FCP: ${metrics.fcp.toFixed(2)}ms ${metrics.fcp < 1800 ? '✅' : '⚠️'}`);
    }
    if (metrics.lcp !== undefined) {
      console.log(`🖼️ LCP: ${metrics.lcp.toFixed(2)}ms ${metrics.lcp < 2500 ? '✅' : '⚠️'}`);
    }
    if (metrics.fid !== undefined) {
      console.log(`👆 FID: ${metrics.fid.toFixed(2)}ms ${metrics.fid < 100 ? '✅' : '⚠️'}`);
    }
    if (metrics.cls !== undefined) {
      console.log(`📐 CLS: ${metrics.cls.toFixed(3)} ${metrics.cls < 0.1 ? '✅' : '⚠️'}`);
    }
    console.groupEnd();
  }
}
