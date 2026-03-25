/**
 * Timezone utilities for organization-aware date handling.
 * 
 * Problem: JavaScript's `new Date()` returns UTC time, but users perceive
 * "today" based on their local timezone (typically America/New_York for 
 * political organizations).
 * 
 * Solution: Use date-fns-tz to work with dates in the organization's timezone.
 */

import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { subDays } from 'date-fns';

/**
 * Default organization timezone.
 * Most political organizations operate in Eastern Time.
 * This matches ActBlue's default reporting timezone.
 */
export const DEFAULT_ORG_TIMEZONE = 'America/New_York';

/**
 * Get "today" formatted as yyyy-MM-dd in the organization's timezone.
 * This is what users perceive as "today" based on their wall clock.
 * 
 * @example
 * // At 7pm ET on Jan 22 (UTC midnight Jan 23):
 * getOrgToday() // Returns "2026-01-22"
 */
export function getOrgToday(timezone = DEFAULT_ORG_TIMEZONE): string {
  return formatInTimeZone(new Date(), timezone, 'yyyy-MM-dd');
}

/**
 * Get a Date object representing "now" in the organization's timezone.
 * Useful for date calculations like "yesterday" or "7 days ago".
 * 
 * @example
 * const now = getOrgNow();
 * const yesterday = subDays(now, 1);
 */
export function getOrgNow(timezone = DEFAULT_ORG_TIMEZONE): Date {
  return toZonedTime(new Date(), timezone);
}

/**
 * Get "yesterday" formatted as yyyy-MM-dd in the organization's timezone.
 */
export function getOrgYesterday(timezone = DEFAULT_ORG_TIMEZONE): string {
  const now = getOrgNow(timezone);
  return formatInTimeZone(subDays(now, 1), timezone, 'yyyy-MM-dd');
}

/**
 * Format a date in the organization's timezone.
 * 
 * @param date - The date to format
 * @param formatStr - date-fns format string
 * @param timezone - Organization timezone
 */
export function formatInOrgTimezone(
  date: Date,
  formatStr: string,
  timezone = DEFAULT_ORG_TIMEZONE
): string {
  return formatInTimeZone(date, timezone, formatStr);
}
