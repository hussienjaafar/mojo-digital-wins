import { format, isSameYear } from "date-fns";

/**
 * Date format width modes for responsive display
 * - wide: "Dec 21, 2025 – Jan 4, 2026" (desktop)
 * - medium: "Dec 21 – Jan 4, 2026" (tablet, same year)
 * - small: "Dec 21 – Jan 4" (small screens)
 * - xs: "12/21 – 1/4" (extra small)
 */
export type DateFormatWidth = "wide" | "medium" | "small" | "xs";

/**
 * Format a date range responsively based on available width
 */
export const formatResponsiveDate = (
  start: Date,
  end: Date,
  width: DateFormatWidth
): string => {
  const sameYear = isSameYear(start, end);

  switch (width) {
    case "wide":
      // Full format: "Dec 21, 2025 – Jan 4, 2026"
      if (sameYear) {
        return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
      }
      return `${format(start, "MMM d, yyyy")} – ${format(end, "MMM d, yyyy")}`;

    case "medium":
      // Compact format for tablets: "Dec 21 – Jan 4, 2026"
      if (sameYear) {
        return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
      }
      return `${format(start, "MMM d, yyyy")} – ${format(end, "MMM d, yyyy")}`;

    case "small":
      // Short format: "Dec 21 – Jan 4"
      return `${format(start, "MMM d")} – ${format(end, "MMM d")}`;

    case "xs":
      // Extra small numeric: "12/21 – 1/4"
      if (sameYear) {
        return `${format(start, "M/d")} – ${format(end, "M/d")}`;
      }
      // Different years: "12/21/25 – 1/4/26"
      return `${format(start, "M/d/yy")} – ${format(end, "M/d/yy")}`;

    default:
      return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
  }
};

/**
 * Get the full date range string for aria-label and tooltips
 */
export const getFullDateRangeLabel = (start: Date, end: Date): string => {
  return `${format(start, "MMMM d, yyyy")} to ${format(end, "MMMM d, yyyy")}`;
};
