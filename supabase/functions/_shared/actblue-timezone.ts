/**
 * ActBlue Timestamp Normalization Utility
 *
 * ActBlue sends timestamps in Eastern Time (America/New_York), often without
 * timezone suffix. This utility normalizes them to proper UTC before storage
 * in PostgreSQL's TIMESTAMPTZ columns.
 *
 * Without this normalization:
 * - "2026-01-25T23:30:00" (intended as EST) → stored as 23:30 UTC
 * - When converted back to EST → 18:30 EST (wrong by 5 hours)
 * - Can cause day boundary shifts (late-night donations appear on wrong day)
 *
 * With this normalization:
 * - "2026-01-25T23:30:00" (detected as no-TZ) → "2026-01-26T04:30:00Z" (correct UTC)
 * - When converted back to EST → 23:30 EST (correct)
 */

/**
 * Normalizes ActBlue timestamps to proper UTC ISO 8601 format.
 *
 * @param timestamp - Raw timestamp from ActBlue (paidAt, createdAt, etc.)
 * @returns ISO 8601 UTC timestamp (e.g., "2026-01-26T04:30:00.000Z")
 *
 * @example
 * normalizeActBlueTimestamp("2026-01-25T23:30:00")       // EST without TZ → UTC
 * normalizeActBlueTimestamp("2026-01-25T23:30:00Z")     // Already UTC
 * normalizeActBlueTimestamp("2026-01-25T23:30:00-05:00") // Has TZ offset
 * normalizeActBlueTimestamp(null)                       // Fallback to now
 */
export function normalizeActBlueTimestamp(timestamp: string | null | undefined): string {
  if (!timestamp) {
    return new Date().toISOString();
  }

  const trimmed = timestamp.trim();

  // Check if timestamp already has timezone information
  // Patterns: "Z", "+HH:MM", "-HH:MM", "+HHMM", "-HHMM"
  const hasTimezone =
    /[Zz]$/.test(trimmed) || /[+-]\d{2}:?\d{2}$/.test(trimmed);

  if (hasTimezone) {
    // Already has timezone info - parse and convert to UTC ISO
    const parsed = new Date(trimmed);
    if (isNaN(parsed.getTime())) {
      console.warn('[actblue-timezone] Invalid timestamp with TZ:', trimmed);
      return new Date().toISOString();
    }
    return parsed.toISOString();
  }

  // No timezone suffix - assume Eastern Time (America/New_York)
  // Need to determine if EST (-05:00) or EDT (-04:00)

  // Parse the timestamp as-is to get the date components
  // Note: new Date() without TZ will interpret as local time, which is wrong
  // We need to parse the components manually

  // Try to parse as ISO format: YYYY-MM-DDTHH:MM:SS or YYYY-MM-DD HH:MM:SS
  const isoMatch = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/
  );

  if (isoMatch) {
    const [, year, month, day, hour, minute, second, ms] = isoMatch;
    const dateForDST = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day)
    );

    const isDST = isEasternDST(dateForDST);
    const offset = isDST ? '-04:00' : '-05:00';

    // Reconstruct with proper timezone offset
    const msStr = ms ? `.${ms}` : '';
    const withTimezone = `${year}-${month}-${day}T${hour}:${minute}:${second}${msStr}${offset}`;

    const parsed = new Date(withTimezone);
    if (isNaN(parsed.getTime())) {
      console.warn('[actblue-timezone] Failed to parse reconstructed timestamp:', withTimezone);
      return new Date().toISOString();
    }

    return parsed.toISOString();
  }

  // Try date-only format: YYYY-MM-DD (assume midnight EST)
  const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    const dateForDST = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day)
    );

    const isDST = isEasternDST(dateForDST);
    const offset = isDST ? '-04:00' : '-05:00';

    // Midnight in Eastern Time
    const withTimezone = `${year}-${month}-${day}T00:00:00${offset}`;
    const parsed = new Date(withTimezone);

    if (isNaN(parsed.getTime())) {
      console.warn('[actblue-timezone] Failed to parse date-only timestamp:', trimmed);
      return new Date().toISOString();
    }

    return parsed.toISOString();
  }

  // Fallback: try native Date parsing (less reliable)
  console.warn('[actblue-timezone] Unknown format, using native parsing:', trimmed);
  const fallback = new Date(trimmed);
  if (isNaN(fallback.getTime())) {
    console.error('[actblue-timezone] Unparseable timestamp:', trimmed);
    return new Date().toISOString();
  }
  return fallback.toISOString();
}

/**
 * Determines if a given date falls within Eastern Daylight Time (EDT).
 *
 * US DST rules (since 2007):
 * - Starts: 2nd Sunday in March at 2:00 AM local time
 * - Ends: 1st Sunday in November at 2:00 AM local time
 *
 * @param date - Date to check (uses year, month, day only)
 * @returns true if date is in EDT period, false if EST
 */
function isEasternDST(date: Date): boolean {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed

  // Definitely not DST: January, February, December
  if (month < 2 || month > 10) {
    return false;
  }

  // Definitely DST: April through October
  if (month > 2 && month < 10) {
    return true;
  }

  // March (month === 2): DST starts on 2nd Sunday at 2 AM
  if (month === 2) {
    const secondSunday = getNthSundayOfMonth(year, 2, 2);
    return date.getDate() >= secondSunday;
  }

  // November (month === 10): DST ends on 1st Sunday at 2 AM
  if (month === 10) {
    const firstSunday = getNthSundayOfMonth(year, 10, 1);
    return date.getDate() < firstSunday;
  }

  return false;
}

/**
 * Gets the day of month for the Nth Sunday of a given month.
 *
 * @param year - Year
 * @param month - Month (0-indexed)
 * @param n - Which Sunday (1 = first, 2 = second, etc.)
 * @returns Day of month (1-31)
 */
function getNthSundayOfMonth(year: number, month: number, n: number): number {
  // Start at the 1st of the month
  const firstDay = new Date(year, month, 1);
  const dayOfWeek = firstDay.getDay(); // 0 = Sunday

  // Days until first Sunday
  const daysUntilSunday = (7 - dayOfWeek) % 7;

  // First Sunday is on this day
  const firstSunday = 1 + daysUntilSunday;

  // Nth Sunday
  return firstSunday + (n - 1) * 7;
}
