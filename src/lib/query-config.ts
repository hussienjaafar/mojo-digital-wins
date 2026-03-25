/**
 * Centralized query configuration for consistent caching behavior
 * across all dashboard hooks.
 * 
 * This ensures all data sources refresh at the same cadence,
 * preventing visual inconsistencies between different dashboard sections.
 */

/**
 * Default stale times for different data categories.
 * All values are in milliseconds.
 */
export const STALE_TIMES = {
  /**
   * Dashboard metrics (ActBlue, Meta, SMS channel data)
   * Uses 2 minutes for all to ensure consistent refresh timing
   */
  dashboard: 2 * 60 * 1000, // 2 minutes
  
  /**
   * Attribution and analytics data
   * Slightly longer since it's less volatile
   */
  analytics: 3 * 60 * 1000, // 3 minutes
  
  /**
   * Real-time or frequently changing data
   * Like active sync status, health checks
   */
  realtime: 30 * 1000, // 30 seconds
  
  /**
   * Static or slow-changing data
   * Like organization settings, user preferences
   */
  static: 10 * 60 * 1000, // 10 minutes
} as const;

/**
 * Default garbage collection times for different data categories.
 * All values are in milliseconds.
 */
export const GC_TIMES = {
  /**
   * Dashboard metrics - keep in memory for quick navigation
   */
  dashboard: 10 * 60 * 1000, // 10 minutes
  
  /**
   * Analytics data - slightly longer for complex queries
   */
  analytics: 15 * 60 * 1000, // 15 minutes
  
  /**
   * Real-time data - short retention
   */
  realtime: 2 * 60 * 1000, // 2 minutes
  
  /**
   * Static data - long retention
   */
  static: 30 * 60 * 1000, // 30 minutes
} as const;

/**
 * Sync thresholds for Smart Refresh system.
 * When data is older than these thresholds, trigger a sync.
 * Values are in hours.
 */
export const SYNC_THRESHOLDS = {
  /**
   * Meta Ads - sync if data is older than 1 hour
   * Meta's API has inherent delays but we want reasonably fresh data
   */
  meta: 1,
  
  /**
   * ActBlue - sync if data is older than 1 hour
   * Webhooks should keep this fresh, but reconciliation may be needed
   */
  actblue: 1,
  
  /**
   * Switchboard SMS - sync if data is older than 2 hours
   * SMS campaigns update less frequently
   */
  switchboard: 2,
} as const;

export type StaleCategoryKey = keyof typeof STALE_TIMES;
export type GcCategoryKey = keyof typeof GC_TIMES;
export type SyncThresholdKey = keyof typeof SYNC_THRESHOLDS;
