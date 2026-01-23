import * as React from "react";
import {
  format,
  parse,
  subDays,
  startOfMonth,
  endOfMonth,
  subMonths,
  differenceInDays,
  parseISO,
} from "date-fns";
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Filter,
} from "lucide-react";
import { DayPicker, type DateRange, type SelectRangeEventHandler } from "react-day-picker";
import { cn } from "@/lib/utils";
import { getOrgNow, getOrgToday } from "@/lib/timezone";

import { Button } from "@/components/ui/button";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useDashboardStore } from "@/stores/dashboardStore";

// ============================================================================
// Types
// ============================================================================

export type PresetKey = "today" | "yesterday" | "7d" | "14d" | "30d" | "90d" | "custom";
type LayoutMode = "lg" | "md" | "sm" | "xs";

interface PerformanceControlsToolbarProps {
  /** Organization ID for filters */
  organizationId?: string;
  /** Filter options for campaigns */
  campaignOptions?: { id: string; label: string }[];
  /** Filter options for creatives */
  creativeOptions?: { id: string; label: string }[];
  /** Show refresh button */
  showRefresh?: boolean;
  /** Refresh handler */
  onRefresh?: () => void;
  /** Is refresh in progress */
  isRefreshing?: boolean;
  /** Additional className */
  className?: string;
}

// ============================================================================
// Preset Configuration
// ============================================================================

const presets: Record<PresetKey, { label: string; shortLabel: string; getValue: () => { start: Date; end: Date } }> = {
  today: {
    label: "Today",
    shortLabel: "Today",
    getValue: () => {
      const now = getOrgNow();
      return { start: now, end: now };
    },
  },
  yesterday: {
    label: "Yesterday",
    shortLabel: "Yest",
    getValue: () => {
      const now = getOrgNow();
      const yesterday = subDays(now, 1);
      return { start: yesterday, end: yesterday };
    },
  },
  "7d": {
    label: "Last 7 days",
    shortLabel: "7D",
    getValue: () => {
      const now = getOrgNow();
      // 6 days back = 7 days inclusive (today + 6 previous days)
      return { start: subDays(now, 6), end: now };
    },
  },
  "14d": {
    label: "Last 14 days",
    shortLabel: "14D",
    getValue: () => {
      const now = getOrgNow();
      return { start: subDays(now, 13), end: now };
    },
  },
  "30d": {
    label: "Last 30 days",
    shortLabel: "30D",
    getValue: () => {
      const now = getOrgNow();
      return { start: subDays(now, 29), end: now };
    },
  },
  "90d": {
    label: "Last 90 days",
    shortLabel: "90D",
    getValue: () => {
      const now = getOrgNow();
      return { start: subDays(now, 89), end: now };
    },
  },
  custom: {
    label: "Custom range",
    shortLabel: "Custom",
    getValue: () => {
      const now = getOrgNow();
      return { start: subDays(now, 30), end: now };
    },
  },
};

// ============================================================================
// Preset Detection Helper
// ============================================================================

/**
 * Detects which preset matches the given date range.
 * Returns 'custom' if no preset matches.
 * Uses organization timezone for accurate "today" detection.
 */
function detectPresetFromDateRange(startDate: string, endDate: string): PresetKey {
  const todayStr = getOrgToday();
  const now = getOrgNow();
  const yesterdayStr = format(subDays(now, 1), "yyyy-MM-dd");
  
  // Check for single-day presets first
  if (startDate === endDate) {
    if (startDate === todayStr) return "today";
    if (startDate === yesterdayStr) return "yesterday";
    // Any other single day is custom
    return "custom";
  }
  
  // Only match other presets if the end date is today
  if (endDate !== todayStr) {
    return "custom";
  }
  
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const daysDiff = differenceInDays(end, start);
  
  // Match against known presets with small tolerance for edge cases
  if (daysDiff >= 6 && daysDiff <= 8) return "7d";
  if (daysDiff >= 13 && daysDiff <= 15) return "14d";
  if (daysDiff >= 29 && daysDiff <= 31) return "30d";
  if (daysDiff >= 89 && daysDiff <= 91) return "90d";
  
  return "custom";
}

// ============================================================================
// Locale-aware Date Formatting with Intl.DateTimeFormat
// ============================================================================

/**
 * Container-aware date formatting using Intl.DateTimeFormat.
 * Switches format based on available width:
 * - >= 720px: "Dec 21, 2025 – Jan 4, 2026" (full)
 * - >= 520px: "Dec 21 – Jan 4, 2026" (same year) or full (different years)
 * - >= 420px: "Dec 21 – Jan 4" (current year) or with year
 * - < 420px: "12/21 – 1/4" (compact numeric fallback)
 */
function formatDateRangeByWidth(
  startDate: Date,
  endDate: Date,
  containerWidth: number,
  locale: string = "en-US"
): string {
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  const currentYear = new Date().getFullYear();

  // Full format options
  const fullFormatter = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // Medium format (no year on start when same year)
  const mediumFormatter = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
  });

  // Compact numeric format
  const compactFormatter = new Intl.DateTimeFormat(locale, {
    month: "numeric",
    day: "numeric",
  });

  if (containerWidth < 420) {
    // Ultra-compact: 12/21 – 1/4
    return `${compactFormatter.format(startDate)} – ${compactFormatter.format(endDate)}`;
  }

  if (containerWidth < 520) {
    // Medium-compact: Dec 21 – Jan 4 (current year) or with year
    if (startYear === endYear && startYear === currentYear) {
      return `${mediumFormatter.format(startDate)} – ${mediumFormatter.format(endDate)}`;
    }
    if (startYear === endYear) {
      return `${mediumFormatter.format(startDate)} – ${fullFormatter.format(endDate)}`;
    }
    return `${fullFormatter.format(startDate)} – ${fullFormatter.format(endDate)}`;
  }

  if (containerWidth < 720) {
    // Medium: Dec 21 – Jan 4, 2026 (same year) or full
    if (startYear === endYear) {
      return `${mediumFormatter.format(startDate)} – ${fullFormatter.format(endDate)}`;
    }
    return `${fullFormatter.format(startDate)} – ${fullFormatter.format(endDate)}`;
  }

  // Full: Dec 21, 2025 – Jan 4, 2026
  return `${fullFormatter.format(startDate)} – ${fullFormatter.format(endDate)}`;
}

/**
 * Get full accessible date range text for aria-label and title
 */
function getFullDateRangeText(startDate: Date, endDate: Date, locale: string = "en-US"): string {
  const formatter = new Intl.DateTimeFormat(locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return `${formatter.format(startDate)} to ${formatter.format(endDate)}`;
}

// ============================================================================
// Container Width Hook (ResizeObserver-based)
// ============================================================================

function useContainerWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = React.useState(800);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });

    observer.observe(element);
    // Set initial width
    setWidth(element.getBoundingClientRect().width);

    return () => observer.disconnect();
  }, [ref]);

  return width;
}

function getLayoutMode(width: number): LayoutMode {
  // NOTE: the header constrains the toolbar to max ~720px.
  // Trigger the "lg" layout only when we have enough room to keep it tidy.
  if (width >= 680) return "lg";
  if (width >= 520) return "md";
  if (width >= 420) return "sm";
  return "xs";
}

// ============================================================================
// Portal Calendar Component
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
        "portal-calendar-panel pointer-events-auto",
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
// Segmented Presets Component (Radix ToggleGroup)
// ============================================================================

interface SegmentedPresetsProps {
  value: PresetKey;
  onChange: (value: PresetKey) => void;
  presetKeys: PresetKey[];
}

const SegmentedPresets: React.FC<SegmentedPresetsProps> = ({
  value,
  onChange,
  presetKeys,
}) => {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as PresetKey)}
      className={cn(
        "inline-flex items-stretch",
        "rounded-[var(--portal-radius-sm)]",
        "border border-[hsl(var(--portal-border))]",
        "bg-[hsl(var(--portal-bg-secondary))]",
        "p-0.5",
        "gap-0.5"
      )}
      aria-label="Select date range preset"
    >
      {presetKeys.map((key) => (
        <ToggleGroupItem
          key={key}
          value={key}
          aria-label={presets[key].label}
          className={cn(
            "px-3 py-1.5",
            "text-xs font-medium",
            "rounded-[calc(var(--portal-radius-sm)-2px)]",
            "border-0",
            "transition-all",
            // Default state
            "bg-transparent",
            "text-[hsl(var(--portal-text-secondary))]",
            "hover:text-[hsl(var(--portal-text-primary))]",
            "hover:bg-[hsl(var(--portal-bg-hover))]",
            // Selected state
            "data-[state=on]:bg-[hsl(var(--portal-accent-blue)/0.12)]",
            "data-[state=on]:text-[hsl(var(--portal-accent-blue))]",
            "data-[state=on]:shadow-sm",
            // Focus
            "focus:outline-none focus-visible:ring-2",
            "focus-visible:ring-[hsl(var(--portal-accent-blue)/0.5)]",
            "focus-visible:ring-offset-1",
            "focus-visible:ring-offset-[hsl(var(--portal-bg-secondary))]"
          )}
        >
          {presets[key].shortLabel}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
};

// ============================================================================
// Preset Dropdown (for small screens)
// ============================================================================

interface PresetDropdownProps {
  value: PresetKey;
  onChange: (value: PresetKey) => void;
}

const PresetDropdown: React.FC<PresetDropdownProps> = ({ value, onChange }) => {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as PresetKey)}>
      <SelectTrigger
        aria-label="Select date range preset"
        className={cn(
          "h-9 w-[100px]",
          "rounded-[var(--portal-radius-sm)]",
          "border border-[hsl(var(--portal-border))]",
          "bg-[hsl(var(--portal-bg-secondary))]",
          "text-xs font-medium",
          "text-[hsl(var(--portal-text-primary))]",
          "hover:bg-[hsl(var(--portal-bg-hover))]",
          "focus:ring-2 focus:ring-[hsl(var(--portal-accent-blue)/0.3)]",
          "transition-colors"
        )}
      >
        <span className="truncate">
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent
        className={cn(
          "z-[200]",
          "bg-[hsl(var(--portal-bg-secondary))]",
          "border-[hsl(var(--portal-border))]",
          "rounded-[var(--portal-radius-sm)]",
          "shadow-lg",
          "opacity-100"
        )}
      >
        {(Object.keys(presets) as PresetKey[]).map((key) => (
          <SelectItem key={key} value={key} className="text-xs">
            {presets[key].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

// ============================================================================
// Date Range Button with Tooltip
// ============================================================================

interface DateRangeButtonProps {
  startDate: Date;
  endDate: Date;
  containerWidth: number;
  isOpen: boolean;
  onClick?: () => void;
}

const DateRangeButton = React.forwardRef<HTMLButtonElement, DateRangeButtonProps>(
  ({ startDate, endDate, containerWidth, isOpen, ...props }, ref) => {
    const displayText = formatDateRangeByWidth(startDate, endDate, containerWidth);
    const fullText = getFullDateRangeText(startDate, endDate);

    // NOTE: Removed TooltipProvider/TooltipTrigger wrapper to avoid event handler
    // conflicts with PopoverTrigger (nested Radix asChild triggers can clobber handlers).
    // The native `title` attribute provides basic tooltip functionality.
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          // Size - fully shrinkable
          "h-9 min-w-0 max-w-full w-full",
          "px-3",
          // Shape
          "rounded-[var(--portal-radius-sm)]",
          // Border and background
          "border border-[hsl(var(--portal-border))]",
          "bg-[hsl(var(--portal-bg-secondary))]",
          // Text
          "text-sm",
          "text-[hsl(var(--portal-text-primary))]",
          // Layout
          "inline-flex items-center gap-2",
          // Hover
          "hover:bg-[hsl(var(--portal-bg-hover))]",
          "hover:border-[hsl(var(--portal-accent-blue)/0.5)]",
          // Open state
          isOpen && [
            "border-[hsl(var(--portal-accent-blue))]",
            "ring-2 ring-[hsl(var(--portal-accent-blue)/0.2)]",
          ],
          // Focus
          "focus:outline-none focus-visible:ring-2",
          "focus-visible:ring-[hsl(var(--portal-accent-blue)/0.5)]",
          "focus-visible:ring-offset-1",
          "focus-visible:ring-offset-[hsl(var(--portal-bg-secondary))]",
          // Transition
          "transition-all"
        )}
        aria-label={`Open date range calendar. Currently: ${fullText}`}
        title={fullText}
        {...props}
      >
        <CalendarIcon 
          className={cn(
            "h-4 w-4 shrink-0",
            "text-[hsl(var(--portal-accent-blue))]"
          )} 
        />
        <span className="truncate min-w-0 flex-1">{displayText}</span>
        <ChevronDown 
          className={cn(
            "h-4 w-4 shrink-0 ml-auto",
            "text-[hsl(var(--portal-text-muted))]",
            "transition-transform",
            isOpen && "rotate-180"
          )} 
        />
      </button>
    );
  }
);

DateRangeButton.displayName = "DateRangeButton";

// ============================================================================
// Refresh Button
// ============================================================================

interface RefreshButtonProps {
  onClick: () => void;
  isRefreshing?: boolean;
}

const RefreshButton: React.FC<RefreshButtonProps> = ({ onClick, isRefreshing }) => (
  <TooltipProvider delayDuration={300}>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          onClick={onClick}
          disabled={isRefreshing}
          className={cn(
            "h-9 w-9",
            "rounded-[var(--portal-radius-sm)]",
            "border border-[hsl(var(--portal-border))]",
            "bg-[hsl(var(--portal-bg-secondary))]",
            "text-[hsl(var(--portal-text-muted))]",
            "hover:bg-[hsl(var(--portal-bg-hover))]",
            "hover:text-[hsl(var(--portal-text-primary))]",
            "hover:border-[hsl(var(--portal-accent-blue)/0.5)]",
            "focus-visible:ring-2",
            "focus-visible:ring-[hsl(var(--portal-accent-blue)/0.3)]",
            "transition-all",
            "disabled:opacity-50"
          )}
          aria-label={isRefreshing ? "Refreshing data" : "Refresh data"}
        >
          <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
        </Button>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        className="bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-primary))]"
      >
        <p>{isRefreshing ? "Refreshing..." : "Refresh data"}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

// ============================================================================
// Filter Button (icon-only for toolbar)
// ============================================================================

interface FilterControlProps {
  campaignOptions: { id: string; label: string }[];
  creativeOptions: { id: string; label: string }[];
  selectedCampaignId: string | null;
  selectedCreativeId: string | null;
  onCampaignChange: (value: string | null) => void;
  onCreativeChange: (value: string | null) => void;
  layoutMode: LayoutMode;
}

const FilterControl: React.FC<FilterControlProps> = ({
  campaignOptions,
  creativeOptions,
  selectedCampaignId,
  selectedCreativeId,
  onCampaignChange,
  onCreativeChange,
  layoutMode,
}) => {
  const hasFilters = campaignOptions.length > 0 || creativeOptions.length > 0;
  if (!hasFilters) return null;

  const showBothDropdowns = layoutMode === "lg" || layoutMode === "md";

  return (
    <div className="flex items-center gap-1.5">
      {/* Filter icon */}
      <div
        className={cn(
          "flex h-9 w-9 items-center justify-center shrink-0",
          "rounded-[var(--portal-radius-sm)]",
          "border border-[hsl(var(--portal-border))]",
          "bg-[hsl(var(--portal-bg-secondary))]",
          "text-[hsl(var(--portal-text-muted))]"
        )}
        aria-hidden="true"
      >
        <Filter className="h-3.5 w-3.5" />
      </div>

      {/* Campaign dropdown */}
      {campaignOptions.length > 0 && (
        <Select
          value={selectedCampaignId || "all"}
          onValueChange={(v) => onCampaignChange(v === "all" ? null : v)}
        >
          <SelectTrigger
            className={cn(
              "h-9 text-xs",
              "rounded-[var(--portal-radius-sm)]",
              "border border-[hsl(var(--portal-border))]",
              "bg-[hsl(var(--portal-bg-secondary))]",
              "text-[hsl(var(--portal-text-primary))]",
              "hover:bg-[hsl(var(--portal-bg-hover))]",
              "focus:ring-2 focus:ring-[hsl(var(--portal-accent-blue)/0.3)]",
              "transition-colors",
              selectedCampaignId && "border-[hsl(var(--portal-accent-blue))]",
              showBothDropdowns ? "w-[120px]" : "w-[100px]"
            )}
            aria-label="Filter by campaign"
          >
            <span className="truncate">
              <SelectValue placeholder="Campaigns" />
            </span>
          </SelectTrigger>
          <SelectContent
            className={cn(
              "z-[100]",
              "bg-[hsl(var(--portal-bg-secondary))]",
              "border-[hsl(var(--portal-border))]",
              "rounded-[var(--portal-radius-sm)]",
              "shadow-lg",
              "opacity-100"
            )}
          >
            <SelectItem value="all" className="text-xs">All Campaigns</SelectItem>
            {campaignOptions.map((opt) => (
              <SelectItem key={opt.id} value={opt.id} className="text-xs truncate">
                {opt.label.length > 20 ? `${opt.label.slice(0, 20)}...` : opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Creative dropdown - only show in lg/md modes */}
      {showBothDropdowns && creativeOptions.length > 0 && (
        <Select
          value={selectedCreativeId || "all"}
          onValueChange={(v) => onCreativeChange(v === "all" ? null : v)}
        >
          <SelectTrigger
            className={cn(
              "h-9 w-[120px] text-xs",
              "rounded-[var(--portal-radius-sm)]",
              "border border-[hsl(var(--portal-border))]",
              "bg-[hsl(var(--portal-bg-secondary))]",
              "text-[hsl(var(--portal-text-primary))]",
              "hover:bg-[hsl(var(--portal-bg-hover))]",
              "focus:ring-2 focus:ring-[hsl(var(--portal-accent-blue)/0.3)]",
              "transition-colors",
              selectedCreativeId && "border-[hsl(var(--portal-accent-blue))]"
            )}
            aria-label="Filter by creative"
          >
            <span className="truncate">
              <SelectValue placeholder="Creatives" />
            </span>
          </SelectTrigger>
          <SelectContent
            className={cn(
              "z-[100]",
              "bg-[hsl(var(--portal-bg-secondary))]",
              "border-[hsl(var(--portal-border))]",
              "rounded-[var(--portal-radius-sm)]",
              "shadow-lg",
              "opacity-100"
            )}
          >
            <SelectItem value="all" className="text-xs">All Creatives</SelectItem>
            {creativeOptions.map((opt) => (
              <SelectItem key={opt.id} value={opt.id} className="text-xs truncate">
                {opt.label.length > 20 ? `${opt.label.slice(0, 20)}...` : opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};

// ============================================================================
// Main Toolbar Component
// ============================================================================

export const PerformanceControlsToolbar: React.FC<PerformanceControlsToolbarProps> = ({
  campaignOptions = [],
  creativeOptions = [],
  showRefresh = false,
  onRefresh,
  isRefreshing = false,
  className,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const containerWidth = useContainerWidth(containerRef);
  const layoutMode = getLayoutMode(containerWidth);
  const { dateRange, setDateRange } = useDashboardStore();
  // Initialize preset based on stored date range, not hardcoded
  const [selectedPreset, setSelectedPreset] = React.useState<PresetKey>(() => 
    detectPresetFromDateRange(dateRange.startDate, dateRange.endDate)
  );
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);

  // Sync preset when date range changes externally (e.g., from persisted storage or other components)
  React.useEffect(() => {
    const detectedPreset = detectPresetFromDateRange(dateRange.startDate, dateRange.endDate);
    if (detectedPreset !== selectedPreset) {
      setSelectedPreset(detectedPreset);
    }
  }, [dateRange.startDate, dateRange.endDate]);

  // Filter state from store
  const selectedCampaignId = useDashboardStore((s) => s.selectedCampaignId);
  const selectedCreativeId = useDashboardStore((s) => s.selectedCreativeId);
  const setSelectedCampaignId = useDashboardStore((s) => s.setSelectedCampaignId);
  const setSelectedCreativeId = useDashboardStore((s) => s.setSelectedCreativeId);

  // Parse store dates
  const parseStoreDate = (dateStr: string): Date =>
    parse(dateStr, "yyyy-MM-dd", new Date());

  const startDate = parseStoreDate(dateRange.startDate);
  const endDate = parseStoreDate(dateRange.endDate);

  // Draft range for calendar selection
  const [draftRange, setDraftRange] = React.useState<DateRange | undefined>({
    from: startDate,
    to: endDate,
  });
  const [anchorDate, setAnchorDate] = React.useState<Date | null>(null);

  // Sync draft range when calendar opens
  React.useEffect(() => {
    if (isCalendarOpen) {
      setAnchorDate(null);
      setDraftRange({ from: startDate, to: endDate });
    }
  }, [isCalendarOpen, dateRange.startDate, dateRange.endDate]);

  // Handle preset change
  const handlePresetChange = (preset: PresetKey) => {
    setSelectedPreset(preset);
    if (preset !== "custom") {
      const { start, end } = presets[preset].getValue();
      setDateRange(format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd"));
    }
  };

  // Handle calendar date selection
  const handleDateSelect: SelectRangeEventHandler = (_range, selectedDay) => {
    if (!selectedDay) return;

    if (anchorDate === null) {
      setAnchorDate(selectedDay);
      setDraftRange({ from: selectedDay, to: undefined });
    } else {
      const [rangeStart, rangeEnd] =
        selectedDay < anchorDate
          ? [selectedDay, anchorDate]
          : [anchorDate, selectedDay];

      setDraftRange({ from: rangeStart, to: rangeEnd });
      setDateRange(format(rangeStart, "yyyy-MM-dd"), format(rangeEnd, "yyyy-MM-dd"));
      setSelectedPreset("custom");
      setAnchorDate(null);
      setIsCalendarOpen(false);
    }
  };

  const hasFilters = campaignOptions.length > 0 || creativeOptions.length > 0;
  const showSegmentedPresets = layoutMode === "lg";
  const presetKeys: PresetKey[] = ["today", "yesterday", "7d", "14d", "30d", "90d"];

  return (
    <div
      ref={containerRef}
      data-testid="perf-controls-toolbar"
      role="toolbar"
      aria-label="Dashboard controls"
      className={cn(
        // Always allow the toolbar to shrink within a flex/grid parent
        "w-full min-w-0 max-w-full",
        // Container queries support
        "[container-type:inline-size]",
        // Keep the root layout simple: children manage their own reflow.
        // (Avoid multi-column CSS grid here, which can trap Row 1 in a narrow auto column.)
        "grid grid-cols-1 gap-2",
        className
      )}
    >
      {/* Row 1: Presets (or dropdown) + Date Range + Refresh */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 min-w-0 max-w-full w-full overflow-x-auto scrollbar-hide",
          // Desktop: align cluster to the end; on smaller screens, let it flow naturally
          layoutMode === "lg" && "lg:justify-end"
        )}
      >
        {/* Presets: Segmented on lg, dropdown on smaller */}
        {showSegmentedPresets ? (
          <SegmentedPresets
            value={selectedPreset}
            onChange={handlePresetChange}
            presetKeys={presetKeys}
          />
        ) : (
          <PresetDropdown value={selectedPreset} onChange={handlePresetChange} />
        )}

        {/* Date Range Picker */}
        <div className="shrink-0">
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <DateRangeButton
                startDate={startDate}
                endDate={endDate}
                containerWidth={containerWidth}
                isOpen={isCalendarOpen}
              />
            </PopoverTrigger>
            <PopoverContent
              className={cn(
                "w-auto p-0",
                "bg-[hsl(var(--portal-bg-secondary))]",
                "border-[hsl(var(--portal-border))]",
                "rounded-[var(--portal-radius-lg)]",
                "shadow-lg"
              )}
              align={layoutMode === "lg" ? "end" : "start"}
              sideOffset={4}
              avoidCollisions={true}
              collisionPadding={12}
            >
              <PortalCalendar
                mode="range"
                selected={draftRange}
                onSelect={handleDateSelect}
                numberOfMonths={layoutMode === "lg" && containerWidth >= 768 ? 2 : 1}
                defaultMonth={new Date()}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Filters inline on wide layouts (wraps to a second line if needed) */}
        {hasFilters && layoutMode === "lg" && (
          <div className="min-w-0">
            <FilterControl
              campaignOptions={campaignOptions}
              creativeOptions={creativeOptions}
              selectedCampaignId={selectedCampaignId}
              selectedCreativeId={selectedCreativeId}
              onCampaignChange={setSelectedCampaignId}
              onCreativeChange={setSelectedCreativeId}
              layoutMode={layoutMode}
            />
          </div>
        )}

        {/* Refresh button - always visible in row 1 */}
        {showRefresh && onRefresh && (
          <RefreshButton onClick={onRefresh} isRefreshing={isRefreshing} />
        )}
      </div>

      {/* Row 2 (md): Filters */}
      {hasFilters && layoutMode === "md" && (
        <div className="min-w-0 w-full">
          <FilterControl
            campaignOptions={campaignOptions}
            creativeOptions={creativeOptions}
            selectedCampaignId={selectedCampaignId}
            selectedCreativeId={selectedCreativeId}
            onCampaignChange={setSelectedCampaignId}
            onCreativeChange={setSelectedCreativeId}
            layoutMode={layoutMode}
          />
        </div>
      )}

      {/* Row 2 (sm/xs): Filters stacked */}
      {hasFilters && (layoutMode === "sm" || layoutMode === "xs") && (
        <div className="flex items-center gap-1.5 w-full min-w-0 overflow-x-auto">
          <FilterControl
            campaignOptions={campaignOptions}
            creativeOptions={creativeOptions}
            selectedCampaignId={selectedCampaignId}
            selectedCreativeId={selectedCreativeId}
            onCampaignChange={setSelectedCampaignId}
            onCreativeChange={setSelectedCreativeId}
            layoutMode={layoutMode}
          />
        </div>
      )}
    </div>
  );
};

PerformanceControlsToolbar.displayName = "PerformanceControlsToolbar";

export default PerformanceControlsToolbar;
