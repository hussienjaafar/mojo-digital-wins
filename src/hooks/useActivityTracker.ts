import { useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Activity Tracker Hook
 * 
 * Tracks significant user actions for audit and analytics purposes.
 * Features:
 * - Batches events to reduce API calls
 * - Debounces rapid events
 * - Graceful failure (non-blocking)
 * - Respects user privacy (no sensitive data)
 */

export interface ActivityEvent {
  action_type: string;
  resource_type?: string;
  resource_id?: string;
  metadata?: Record<string, any>;
}

interface UseActivityTrackerOptions {
  /** Organization ID for multi-tenant apps */
  organizationId?: string;
  /** Batch interval in ms (default: 5000) */
  batchInterval?: number;
  /** Max events before forced flush (default: 20) */
  maxBatchSize?: number;
  /** Enable debug logging */
  debug?: boolean;
}

const DEFAULT_BATCH_INTERVAL = 5000;
const DEFAULT_MAX_BATCH_SIZE = 20;

export function useActivityTracker(options: UseActivityTrackerOptions = {}) {
  const {
    organizationId,
    batchInterval = DEFAULT_BATCH_INTERVAL,
    maxBatchSize = DEFAULT_MAX_BATCH_SIZE,
    debug = false,
  } = options;

  const eventQueue = useRef<ActivityEvent[]>([]);
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFlushing = useRef(false);

  /**
   * Flush queued events to the server
   */
  const flushEvents = useCallback(async () => {
    if (isFlushing.current || eventQueue.current.length === 0) {
      return;
    }

    isFlushing.current = true;
    const eventsToFlush = [...eventQueue.current];
    eventQueue.current = [];

    if (debug) {
      console.log('[ActivityTracker] Flushing', eventsToFlush.length, 'events');
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (debug) {
          console.log('[ActivityTracker] No session, discarding events');
        }
        return;
      }

      const response = await supabase.functions.invoke('log-user-activity', {
        body: {
          events: eventsToFlush,
          organization_id: organizationId,
        },
      });

      if (response.error) {
        console.warn('[ActivityTracker] Failed to log activity:', response.error);
        // Don't re-queue on failure to prevent infinite loops
      } else if (debug) {
        console.log('[ActivityTracker] Successfully logged', eventsToFlush.length, 'events');
      }
    } catch (error) {
      console.warn('[ActivityTracker] Error logging activity:', error);
    } finally {
      isFlushing.current = false;
    }
  }, [organizationId, debug]);

  /**
   * Schedule a flush if not already scheduled
   */
  const scheduleFlush = useCallback(() => {
    if (flushTimeoutRef.current) {
      return;
    }

    flushTimeoutRef.current = setTimeout(() => {
      flushTimeoutRef.current = null;
      flushEvents();
    }, batchInterval);
  }, [batchInterval, flushEvents]);

  /**
   * Track a user activity event
   */
  const trackActivity = useCallback((event: ActivityEvent) => {
    eventQueue.current.push({
      ...event,
      // Ensure metadata doesn't contain sensitive data
      metadata: event.metadata ? sanitizeMetadata(event.metadata) : undefined,
    });

    if (debug) {
      console.log('[ActivityTracker] Queued event:', event.action_type);
    }

    // Force flush if batch is full
    if (eventQueue.current.length >= maxBatchSize) {
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
        flushTimeoutRef.current = null;
      }
      flushEvents();
    } else {
      scheduleFlush();
    }
  }, [maxBatchSize, flushEvents, scheduleFlush, debug]);

  /**
   * Track a page view
   */
  const trackPageView = useCallback((pageName: string, pageData?: Record<string, any>) => {
    trackActivity({
      action_type: 'page_view',
      resource_type: 'page',
      resource_id: pageName,
      metadata: pageData,
    });
  }, [trackActivity]);

  /**
   * Track a data export action
   */
  const trackExport = useCallback((exportType: string, exportData?: Record<string, any>) => {
    trackActivity({
      action_type: 'data_export',
      resource_type: 'export',
      resource_id: exportType,
      metadata: exportData,
    });
  }, [trackActivity]);

  /**
   * Track a settings change
   */
  const trackSettingsChange = useCallback((settingName: string, settingData?: Record<string, any>) => {
    trackActivity({
      action_type: 'settings_change',
      resource_type: 'settings',
      resource_id: settingName,
      metadata: settingData,
    });
  }, [trackActivity]);

  /**
   * Track a search action (anonymized)
   */
  const trackSearch = useCallback((searchContext: string, resultCount?: number) => {
    trackActivity({
      action_type: 'search',
      resource_type: 'search',
      resource_id: searchContext,
      metadata: { result_count: resultCount },
    });
  }, [trackActivity]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
      }
      // Attempt final flush
      if (eventQueue.current.length > 0) {
        flushEvents();
      }
    };
  }, [flushEvents]);

  // Flush on page visibility change (user navigating away)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && eventQueue.current.length > 0) {
        flushEvents();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [flushEvents]);

  return {
    trackActivity,
    trackPageView,
    trackExport,
    trackSettingsChange,
    trackSearch,
    flushEvents,
  };
}

/**
 * Sanitize metadata to remove potentially sensitive fields
 */
function sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth', 'credential', 'email', 'phone'];
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(metadata)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
      continue;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
    } else if (Array.isArray(value) && value.length <= 10) {
      sanitized[key] = value.slice(0, 10);
    }
  }
  
  return sanitized;
}

export default useActivityTracker;
