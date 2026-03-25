import * as React from "react";
import {
  format,
  parse,
  subDays,
  startOfMonth,
  endOfMonth,
  subMonths,
  subYears,
  differenceInDays,
  isBefore,
} from "date-fns";
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { DayPicker, type DateRange, type SelectRangeEventHandler } from "react-day-picker";
import { cn } from "@/lib/utils";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDashboardStore } from "@/stores/dashboardStore";
import {
  DateInputTrigger,
  DateInputIcon,
  getDateInputTransitionStyle,
  getSelectTriggerClasses,
} from "@/components/ui/DateInputGroup";

// ============================================================================
// Types
// ============================================================================

export type PresetKey = "today" | "7d" | "14d" | "30d" | "90d" | "mtd" | "last-month" | "custom";
export type CompareMode = "none" | "previous" | "last-month" | "last-year";

interface Preset {
  label: string;
  shortLabel: string;
  getValue: () => { start: Date; end: Date };
}

export interface DateRangeControlProps {
  /** Additional class names */
  className?: string;
  /** Show quick-range pills */
  showPresets?: boolean;
  /** Which presets to show as pills (desktop only) */
  pillPresets?: PresetKey[];
  /** Show compare selector */
  showCompareSelector?: boolean;
  /** Compare mode change handler */
  onCompareChange?: (
    compareRange: { start: Date; end: Date } | null,
    mode: CompareMode
  ) => void;
  /** Size variant */
  size?: "sm" | "md";
  /** Layout variant: default (separate controls) or segmented (joined cluster) */
  variant?: "default" | "segmented";
  /** Optional trailing control to render at end of segmented cluster (e.g., refresh button) */
  trailingControl?: React.ReactNode;
}

// ============================================================================
// Preset Configuration
// ============================================================================

const presets: Record<PresetKey, Preset> = {
  today: {
    label: "Today",
    shortLabel: "Today",
    getValue: () => ({ start: new Date(), end: new Date() }),
  },
  "7d": {
    label: "Last 7 days",
    shortLabel: "7D",
    // 6 days back = 7 days inclusive (today + 6 previous days)
    getValue: () => ({ start: subDays(new Date(), 6), end: new Date() }),
  },
  "14d": {
    label: "Last 14 days",
    shortLabel: "14D",
    getValue: () => ({ start: subDays(new Date(), 13), end: new Date() }),
  },
  "30d": {
    label: "Last 30 days",
    shortLabel: "30D",
    getValue: () => ({ start: subDays(new Date(), 29), end: new Date() }),
  },
  "90d": {
    label: "Last 90 days",
    shortLabel: "90D",
    getValue: () => ({ start: subDays(new Date(), 89), end: new Date() }),
  },
  mtd: {
    label: "Month to date",
    shortLabel: "MTD",
    getValue: () => ({ start: startOfMonth(new Date()), end: new Date() }),
  },
  "last-month": {
    label: "Last month",
    shortLabel: "Last Mo",
    getValue: () => ({
      start: startOfMonth(subMonths(new Date(), 1)),
      end: endOfMonth(subMonths(new Date(), 1)),
    }),
  },
  custom: {
    label: "Custom range",
    shortLabel: "Custom",
    getValue: () => ({ start: subDays(new Date(), 30), end: new Date() }),
  },
};

const compareModes: Record<
  CompareMode,
  { label: string; getRange: (start: Date, end: Date) => { start: Date; end: Date } | null }
> = {
  none: {
    label: "No comparison",
    getRange: () => null,
  },
  previous: {
    label: "Previous period",
    getRange: (start, end) => {
      const days = differenceInDays(end, start) + 1;
      return {
        start: subDays(start, days),
        end: subDays(start, 1),
      };
    },
  },
  "last-month": {
    label: "Same period last month",
    getRange: (start, end) => ({
      start: subMonths(start, 1),
      end: subMonths(end, 1),
    }),
  },
  "last-year": {
    label: "Same period last year",
    getRange: (start, end) => ({
      start: subYears(start, 1),
      end: subYears(end, 1),
    }),
  },
};

// ============================================================================
// Quick Range Pill Component
// ============================================================================

interface QuickRangePillProps {
  preset: PresetKey;
  isSelected: boolean;
  onClick: () => void;
}

const QuickRangePill: React.FC<QuickRangePillProps> = ({
  preset,
  isSelected,
  onClick,
}) => {
  const config = presets[preset];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        // Base layout
        "inline-flex items-center justify-center",
        "px-[var(--portal-space-sm)] py-[var(--portal-space-2xs)]",
        "min-h-[32px]",
        // Typography
        "text-xs font-medium",
        // Shape
        "rounded-full",
        // Transition
        "transition-all",
        // Default state
        !isSelected && [
          "bg-[hsl(var(--portal-bg-elevated))]",
          "text-[hsl(var(--portal-text-secondary))]",
          "border border-transparent",
          "hover:bg-[hsl(var(--portal-bg-hover))]",
          "hover:text-[hsl(var(--portal-text-primary))]",
        ],
        // Selected state
        isSelected && [
          "bg-[hsl(var(--portal-accent-blue)/0.12)]",
          "text-[hsl(var(--portal-accent-blue))]",
          "border border-[hsl(var(--portal-accent-blue)/0.3)]",
          "shadow-[0_0_8px_hsl(var(--portal-accent-blue)/0.1)]",
        ],
        // Focus state
        "focus:outline-none focus-visible:ring-2",
        "focus-visible:ring-[hsl(var(--portal-accent-blue)/0.5)]",
        "focus-visible:ring-offset-1",
        "focus-visible:ring-offset-[hsl(var(--portal-bg-secondary))]"
      )}
      aria-pressed={isSelected}
    >
      {config.shortLabel}
    </button>
  );
};

// ============================================================================
// Portal Calendar Component (Token-styled)
// ============================================================================

interface PortalCalendarProps {
  mode: "range";
  selected: DateRange | undefined;
  onSelect: SelectRangeEventHandler;
  numberOfMonths?: number;
  defaultMonth?: Date;
}

const PortalCalendar: React.FC<PortalCalendarProps> = ({
  mode,
  selected,
  onSelect,
  numberOfMonths = 2,
  defaultMonth,
}) => {
  return (
    <DayPicker
      mode={mode}
      selected={selected}
      onSelect={onSelect}
      numberOfMonths={numberOfMonths}
      defaultMonth={defaultMonth}
      showOutsideDays
      className={cn(
        // Apply portal calendar panel class for solid, opaque styling
        "portal-calendar-panel",
        "p-[var(--portal-space-md)]"
      )}
      classNames={{
        months: "flex flex-col sm:flex-row gap-[var(--portal-space-lg)]",
        month: "space-y-[var(--portal-space-md)]",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: cn(
          "text-sm font-semibold",
          "text-[hsl(var(--portal-text-primary))]"
        ),
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          "h-7 w-7 p-0",
          "inline-flex items-center justify-center",
          "rounded-[var(--portal-radius-sm)]",
          "border border-[hsl(var(--portal-border))]",
          "bg-transparent",
          "text-[hsl(var(--portal-text-muted))]",
          "hover:bg-[hsl(var(--portal-bg-hover))]",
          "hover:text-[hsl(var(--portal-text-primary))]",
          "transition-colors",
          "disabled:opacity-50"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse",
        head_row: "flex",
        head_cell: cn(
          "w-9 font-medium text-[0.75rem]",
          "text-[hsl(var(--portal-text-muted))]",
          "rounded-[var(--portal-radius-sm)]"
        ),
        row: "flex w-full mt-1",
        cell: cn(
          "h-9 w-9 text-center text-sm p-0 relative",
          "[&:has([aria-selected].day-range-end)]:rounded-r-[var(--portal-radius-sm)]",
          "[&:has([aria-selected].day-outside)]:bg-[hsl(var(--portal-accent-blue)/0.05)]",
          "[&:has([aria-selected])]:bg-[hsl(var(--portal-accent-blue)/0.1)]",
          "first:[&:has([aria-selected])]:rounded-l-[var(--portal-radius-sm)]",
          "last:[&:has([aria-selected])]:rounded-r-[var(--portal-radius-sm)]",
          "focus-within:relative focus-within:z-20"
        ),
        day: cn(
          "h-9 w-9 p-0 font-normal",
          "inline-flex items-center justify-center",
          "rounded-[var(--portal-radius-sm)]",
          "text-[hsl(var(--portal-text-primary))]",
          "hover:bg-[hsl(var(--portal-bg-hover))]",
          "transition-colors",
          "aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected: cn(
          "bg-[hsl(var(--portal-accent-blue))]",
          "text-white",
          "hover:bg-[hsl(var(--portal-accent-blue))]",
          "hover:text-white",
          "focus:bg-[hsl(var(--portal-accent-blue))]",
          "focus:text-white"
        ),
        day_today: cn(
          "bg-[hsl(var(--portal-bg-elevated))]",
          "text-[hsl(var(--portal-text-primary))]",
          "font-semibold"
        ),
        day_outside: cn(
          "day-outside",
          "text-[hsl(var(--portal-text-muted))]",
          "opacity-50",
          "aria-selected:bg-[hsl(var(--portal-accent-blue)/0.05)]",
          "aria-selected:text-[hsl(var(--portal-text-muted))]",
          "aria-selected:opacity-30"
        ),
        day_disabled: cn(
          "text-[hsl(var(--portal-text-muted))]",
          "opacity-50"
        ),
        day_range_middle: cn(
          "aria-selected:bg-[hsl(var(--portal-accent-blue)/0.1)]",
          "aria-selected:text-[hsl(var(--portal-text-primary))]"
        ),
        day_hidden: "invisible",
      }}
      components={{
        IconLeft: () => <ChevronLeft className="h-4 w-4" />,
        IconRight: () => <ChevronRight className="h-4 w-4" />,
      }}
    />
  );
};

// ============================================================================
// Calendar Trigger Button Component
// ============================================================================

interface CalendarTriggerProps {
  startDate: Date;
  endDate: Date;
  isOpen: boolean;
  size?: "sm" | "md";
}

/**
 * Format date range in compact form:
 * - Same year: "Dec 3 – Jan 2, 2026"
 * - Different years: "Dec 3, 2025 – Jan 2, 2026"
 * - Mobile: "Dec 3 – Jan 2"
 */
const formatCompactDateRange = (startDate: Date, endDate: Date, isMobile: boolean): string => {
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  const currentYear = new Date().getFullYear();

  if (isMobile) {
    // Mobile: always omit year for brevity
    return `${format(startDate, "MMM d")} – ${format(endDate, "MMM d")}`;
  }

  // Smart year display: only show year if spanning multiple years OR not current year
  if (startYear === endYear && startYear === currentYear) {
    // Same year and current year: omit year entirely
    return `${format(startDate, "MMM d")} – ${format(endDate, "MMM d")}`;
  }
  
  if (startYear === endYear) {
    // Same year but not current year: show year once at end
    return `${format(startDate, "MMM d")} – ${format(endDate, "MMM d, yyyy")}`;
  }

  // Different years: show both
  return `${format(startDate, "MMM d, yyyy")} – ${format(endDate, "MMM d, yyyy")}`;
};

const CalendarTrigger = React.forwardRef<
  HTMLButtonElement,
  CalendarTriggerProps & React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ startDate, endDate, isOpen, size = "md", className, ...props }, ref) => {
  // Ultra-compact format for extra-small screens: "12/3 - 1/2"
  const ultraCompactFormat = `${format(startDate, "M/d")} - ${format(endDate, "M/d")}`;
  
  return (
    <DateInputTrigger
      ref={ref}
      size={size}
      accent="blue"
      isOpen={isOpen}
      className={cn("min-w-0 max-w-[160px] xs:max-w-[200px] sm:max-w-[280px]", className)}
      aria-label={`Open date range calendar (${format(startDate, "MMM d, yyyy")} to ${format(endDate, "MMM d, yyyy")})`}
      {...props}
    >
      <DateInputIcon isOpen={isOpen} accent="blue">
        <CalendarIcon className="h-4 w-4 shrink-0" />
      </DateInputIcon>
      {/* Ultra-compact on xs: 12/3 - 1/2 */}
      <span className="xs:hidden text-xs truncate">
        {ultraCompactFormat}
      </span>
      {/* Compact on xs-sm: Dec 3 – Jan 2 */}
      <span className="hidden xs:inline sm:hidden text-sm truncate">
        {formatCompactDateRange(startDate, endDate, true)}
      </span>
      {/* Full on sm+: Dec 3 – Jan 2, 2026 */}
      <span className="hidden sm:inline text-sm truncate">
        {formatCompactDateRange(startDate, endDate, false)}
      </span>
      <DateInputIcon isOpen={isOpen} accent="blue" rotateOnOpen className="ml-auto shrink-0">
        <ChevronDown className="h-4 w-4" />
      </DateInputIcon>
    </DateInputTrigger>
  );
});

CalendarTrigger.displayName = "CalendarTrigger";

// ============================================================================
// Segmented Trigger Styles (for joined cluster mode)
// ============================================================================

/**
 * Get classes for a trigger inside the segmented cluster.
 * Removes border/radius/shadow since the container owns those.
 */
const getSegmentedTriggerClasses = (size: "sm" | "md" = "md"): string => {
  const height = size === "sm" ? "h-11 sm:h-8" : "h-11 sm:h-9";
  return cn(
    height,
    // Remove individual border/radius/shadow
    "border-0 rounded-none shadow-none",
    // Background
    "bg-transparent",
    // Text
    "text-[hsl(var(--portal-text-primary))]",
    // Hover: simple bg change
    "hover:bg-[hsl(var(--portal-bg-hover))]",
    // Focus: subtle indication, container provides main ring
    "focus:outline-none focus-visible:bg-[hsl(var(--portal-bg-hover))] focus-visible:z-10",
    // Transition
    "transition-colors"
  );
};

/**
 * Segmented cluster container classes
 */
const segmentedClusterClasses = cn(
  // Layout
  "inline-flex items-stretch",
  // Shape
  "rounded-[var(--portal-radius-sm)]",
  // Border
  "border border-[hsl(var(--portal-border))]",
  // Background
  "bg-[hsl(var(--portal-bg-secondary))]",
  // Internal dividers
  "divide-x divide-[hsl(var(--portal-border))]",
  // Clip children to rounded corners
  "overflow-hidden",
  // Group focus ring
  "focus-within:ring-2 focus-within:ring-[hsl(var(--portal-accent-blue)/0.3)]",
  "focus-within:ring-offset-1 focus-within:ring-offset-[hsl(var(--portal-bg-secondary))]"
);

// ============================================================================
// Main DateRangeControl Component
// ============================================================================

export const DateRangeControl: React.FC<DateRangeControlProps> = ({
  className,
  showPresets = true,
  pillPresets = ["7d", "14d", "30d", "90d"],
  showCompareSelector = false,
  onCompareChange,
  size = "md",
  variant = "default",
  trailingControl,
}) => {
  const { dateRange, setDateRange } = useDashboardStore();
  const [selectedPreset, setSelectedPreset] = React.useState<PresetKey>("today");
  const [compareMode, setCompareMode] = React.useState<CompareMode>("none");
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);

  // Parse store dates safely (avoid UTC shifting from new Date(string))
  const parseStoreDate = (dateStr: string): Date =>
    parse(dateStr, "yyyy-MM-dd", new Date());

  const startDate = parseStoreDate(dateRange.startDate);
  const endDate = parseStoreDate(dateRange.endDate);

  // Anchor date for 2-click selection (first click sets anchor, second click completes range)
  const [anchorDate, setAnchorDate] = React.useState<Date | null>(null);

  // Draft range for visual feedback while selecting
  const [draftRange, setDraftRange] = React.useState<DateRange | undefined>({
    from: startDate,
    to: endDate,
  });

  // Reset anchor and sync draft range when calendar opens
  React.useEffect(() => {
    if (isCalendarOpen) {
      setAnchorDate(null);
      setDraftRange({ from: startDate, to: endDate });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCalendarOpen, dateRange.startDate, dateRange.endDate]);

  // Handle preset selection
  const handlePresetChange = (preset: PresetKey) => {
    setSelectedPreset(preset);
    if (preset !== "custom") {
      const { start, end } = presets[preset].getValue();
      setDateRange(format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd"));
    }
  };

  // Handle calendar date selection with anchor-based 2-click logic
  // First click sets anchor, second click completes range (order doesn't matter)
  const handleDateSelect: SelectRangeEventHandler = (
    _range,
    selectedDay,
    _activeModifiers,
    _e
  ) => {
    if (!selectedDay) return;

    if (anchorDate === null) {
      // First click: set anchor and show single-day selection
      setAnchorDate(selectedDay);
      setDraftRange({ from: selectedDay, to: undefined });
    } else {
      // Second click: compute range from anchor + selectedDay, commit and close
      const [rangeStart, rangeEnd] = isBefore(selectedDay, anchorDate)
        ? [selectedDay, anchorDate]
        : [anchorDate, selectedDay];

      setDraftRange({ from: rangeStart, to: rangeEnd });
      setDateRange(
        format(rangeStart, "yyyy-MM-dd"),
        format(rangeEnd, "yyyy-MM-dd")
      );
      setSelectedPreset("custom");
      setAnchorDate(null);
      setIsCalendarOpen(false);
    }
  };

  // Handle compare mode change
  const handleCompareModeChange = (mode: CompareMode) => {
    setCompareMode(mode);
    const compareRange = compareModes[mode].getRange(startDate, endDate);
    onCompareChange?.(compareRange, mode);
  };

  // Update compare range when date range changes
  React.useEffect(() => {
    if (compareMode !== "none" && onCompareChange) {
      const start = parseStoreDate(dateRange.startDate);
      const end = parseStoreDate(dateRange.endDate);
      const compareRange = compareModes[compareMode].getRange(start, end);
      onCompareChange(compareRange, compareMode);
    }
   
  }, [dateRange.startDate, dateRange.endDate, compareMode, onCompareChange]);

  // =========================================================================
  // Segmented Variant: joined cluster with shared border
  // =========================================================================
  if (variant === "segmented") {
    return (
      <div
        className={cn(
          "flex items-center gap-[var(--portal-space-xs)]",
          className
        )}
      >
        {/* Quick Range Pills - Desktop Only (outside cluster) */}
        {showPresets && (
          <div className="hidden md:flex items-center gap-[var(--portal-space-2xs)]">
            {pillPresets.map((preset) => (
              <QuickRangePill
                key={preset}
                preset={preset}
                isSelected={selectedPreset === preset}
                onClick={() => handlePresetChange(preset)}
              />
            ))}
          </div>
        )}

        {/* Segmented Cluster: triggers joined as one unit */}
        <div className={segmentedClusterClasses}>
          {/* Mobile Preset Selector (inside cluster) */}
          {showPresets && (
            <Select
              value={selectedPreset}
              onValueChange={(v) => handlePresetChange(v as PresetKey)}
            >
              <SelectTrigger
                aria-label="Select date range preset"
                className={cn(
                  getSegmentedTriggerClasses(size),
                  "w-[110px] px-[var(--portal-space-sm)]",
                  "md:hidden"
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                className={cn(
                  "portal-theme",
                  "bg-[hsl(var(--portal-bg-secondary))]",
                  "border-[hsl(var(--portal-border))]",
                  "rounded-[var(--portal-radius-md)]",
                  "shadow-[var(--portal-shadow-lg)]"
                )}
              >
                {Object.entries(presets).map(([key, preset]) => (
                  <SelectItem
                    key={key}
                    value={key}
                    className={cn(
                      "text-[hsl(var(--portal-text-primary))]",
                      "focus:bg-[hsl(var(--portal-bg-hover))]",
                      "focus:text-[hsl(var(--portal-text-primary))]"
                    )}
                  >
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Calendar Trigger (inside cluster) */}
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  getSegmentedTriggerClasses(size),
                  "inline-flex items-center gap-2 px-[var(--portal-space-sm)]",
                  "text-sm"
                )}
                aria-label={`Open date range calendar (${format(startDate, "MMM d, yyyy")} to ${format(endDate, "MMM d, yyyy")})`}
              >
                <DateInputIcon isOpen={isCalendarOpen} accent="blue">
                  <CalendarIcon className="h-4 w-4" />
                </DateInputIcon>
                <span className="hidden sm:inline">
                  {format(startDate, "MMM d, yyyy")} to {format(endDate, "MMM d, yyyy")}
                </span>
                <span className="sm:hidden">
                  {format(startDate, "MMM d")} - {format(endDate, "MMM d")}
                </span>
                <DateInputIcon isOpen={isCalendarOpen} accent="blue" rotateOnOpen className="ml-auto">
                  <ChevronDown className="h-4 w-4" />
                </DateInputIcon>
              </button>
            </PopoverTrigger>
            <PopoverContent
              className={cn(
                "portal-theme",
                "w-auto p-0",
                "bg-[hsl(var(--portal-bg-secondary))]",
                "border-[hsl(var(--portal-border))]",
                "rounded-[var(--portal-radius-lg)]",
                "shadow-[var(--portal-shadow-lg)]"
              )}
              align="end"
            >
              <PortalCalendar
                mode="range"
                selected={draftRange}
                onSelect={handleDateSelect}
                numberOfMonths={2}
                defaultMonth={subDays(new Date(), 30)}
              />
            </PopoverContent>
          </Popover>

          {/* Compare Selector (inside cluster) */}
          {showCompareSelector && (
            <Select
              value={compareMode}
              onValueChange={(v) => handleCompareModeChange(v as CompareMode)}
            >
              <SelectTrigger
                aria-label="Select comparison range"
                className={cn(
                  getSegmentedTriggerClasses(size),
                  "w-[140px] px-[var(--portal-space-sm)]"
                )}
              >
                <SelectValue placeholder="Compare" />
              </SelectTrigger>
              <SelectContent
                className={cn(
                  "portal-theme",
                  "bg-[hsl(var(--portal-bg-secondary))]",
                  "border-[hsl(var(--portal-border))]",
                  "rounded-[var(--portal-radius-md)]",
                  "shadow-[var(--portal-shadow-lg)]"
                )}
              >
                {Object.entries(compareModes).map(([key, mode]) => (
                  <SelectItem
                    key={key}
                    value={key}
                    className={cn(
                      "text-[hsl(var(--portal-text-primary))]",
                      "focus:bg-[hsl(var(--portal-bg-hover))]",
                      "focus:text-[hsl(var(--portal-text-primary))]"
                    )}
                  >
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Trailing Control (e.g., refresh button) */}
          {trailingControl && (
            <div className={cn(
              getSegmentedTriggerClasses(size),
              "flex items-center justify-center",
              "w-11 sm:w-9"
            )}>
              {trailingControl}
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // Default Variant: separate controls with individual borders
  // =========================================================================
  return (
    <div
      className={cn(
        "flex items-center gap-[var(--portal-space-xs)]",
        className
      )}
    >
      {/* Quick Range Pills - Desktop Only */}
      {showPresets && (
        <div className="hidden md:flex items-center gap-[var(--portal-space-2xs)]">
          {pillPresets.map((preset) => (
            <QuickRangePill
              key={preset}
              preset={preset}
              isSelected={selectedPreset === preset}
              onClick={() => handlePresetChange(preset)}
            />
          ))}
        </div>
      )}

      {/* Mobile Preset Selector - shrinks on extra-small screens */}
      {showPresets && (
        <Select
          value={selectedPreset}
          onValueChange={(v) => handlePresetChange(v as PresetKey)}
        >
          <SelectTrigger
            aria-label="Select date range preset"
            className={getSelectTriggerClasses({
              size,
              accent: "blue",
              widthClass: "min-w-0 w-[80px] xs:w-[100px]",
              className: "md:hidden shrink-0",
            })}
            style={getDateInputTransitionStyle("base")}
          >
            <span className="truncate">
              <SelectValue />
            </span>
          </SelectTrigger>
          <SelectContent
            className={cn(
              "portal-theme",
              "bg-[hsl(var(--portal-bg-secondary))]",
              "border-[hsl(var(--portal-border))]",
              "rounded-[var(--portal-radius-md)]",
              "shadow-[var(--portal-shadow-lg)]"
            )}
          >
            {Object.entries(presets).map(([key, preset]) => (
              <SelectItem
                key={key}
                value={key}
                className={cn(
                  "text-[hsl(var(--portal-text-primary))]",
                  "focus:bg-[hsl(var(--portal-bg-hover))]",
                  "focus:text-[hsl(var(--portal-text-primary))]"
                )}
              >
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Calendar Popover */}
      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
        <PopoverTrigger asChild>
          <CalendarTrigger
            startDate={startDate}
            endDate={endDate}
            isOpen={isCalendarOpen}
            size={size}
          />
        </PopoverTrigger>
        <PopoverContent
          className={cn(
            "portal-theme",
            "w-auto p-0",
            "bg-[hsl(var(--portal-bg-secondary))]",
            "border-[hsl(var(--portal-border))]",
            "rounded-[var(--portal-radius-lg)]",
            "shadow-[var(--portal-shadow-lg)]"
          )}
          align="end"
        >
          <PortalCalendar
            mode="range"
            selected={draftRange}
            onSelect={handleDateSelect}
            numberOfMonths={2}
            defaultMonth={subDays(new Date(), 30)}
          />
        </PopoverContent>
      </Popover>

      {/* Compare Selector */}
      {showCompareSelector && (
        <Select
          value={compareMode}
          onValueChange={(v) => handleCompareModeChange(v as CompareMode)}
        >
          <SelectTrigger
            aria-label="Select comparison range"
            className={getSelectTriggerClasses({
              size,
              accent: "purple",
              isActive: compareMode !== "none",
              widthClass: "w-[140px]",
            })}
            style={getDateInputTransitionStyle("base")}
          >
            <SelectValue placeholder="Compare" />
          </SelectTrigger>
          <SelectContent
            className={cn(
              "portal-theme",
              "bg-[hsl(var(--portal-bg-secondary))]",
              "border-[hsl(var(--portal-border))]",
              "rounded-[var(--portal-radius-md)]",
              "shadow-[var(--portal-shadow-lg)]"
            )}
          >
            {Object.entries(compareModes).map(([key, mode]) => (
              <SelectItem
                key={key}
                value={key}
                className={cn(
                  "text-[hsl(var(--portal-text-primary))]",
                  "focus:bg-[hsl(var(--portal-bg-hover))]",
                  "focus:text-[hsl(var(--portal-text-primary))]"
                )}
              >
                {mode.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Trailing Control (for default variant, render separately) */}
      {trailingControl}
    </div>
  );
};

DateRangeControl.displayName = "DateRangeControl";

export default DateRangeControl;
