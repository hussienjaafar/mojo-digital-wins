import * as React from "react";
import { format, subDays, startOfMonth, endOfMonth, subMonths, subYears, differenceInDays, parseISO } from "date-fns";
import { Calendar as CalendarIcon, ChevronDown, GitCompare } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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

type PresetKey = 'today' | 'yesterday' | '7d' | '14d' | '30d' | '90d' | 'mtd' | 'last-month' | 'custom';
type CompareMode = 'none' | 'previous' | 'last-month' | 'last-year';

interface Preset {
  label: string;
  getValue: () => { start: Date; end: Date };
}

const presets: Record<PresetKey, Preset> = {
  today: {
    label: "Today",
    getValue: () => ({ start: new Date(), end: new Date() }),
  },
  yesterday: {
    label: "Yesterday",
    getValue: () => {
      const yesterday = subDays(new Date(), 1);
      return { start: yesterday, end: yesterday };
    },
  },
  "7d": {
    label: "Last 7 days",
    getValue: () => ({ start: subDays(new Date(), 7), end: new Date() }),
  },
  "14d": {
    label: "Last 14 days",
    getValue: () => ({ start: subDays(new Date(), 14), end: new Date() }),
  },
  "30d": {
    label: "Last 30 days",
    getValue: () => ({ start: subDays(new Date(), 30), end: new Date() }),
  },
  "90d": {
    label: "Last 90 days",
    getValue: () => ({ start: subDays(new Date(), 90), end: new Date() }),
  },
  mtd: {
    label: "Month to date",
    getValue: () => ({ start: startOfMonth(new Date()), end: new Date() }),
  },
  "last-month": {
    label: "Last month",
    getValue: () => ({
      start: startOfMonth(subMonths(new Date(), 1)),
      end: endOfMonth(subMonths(new Date(), 1)),
    }),
  },
  custom: {
    label: "Custom range",
    getValue: () => ({ start: subDays(new Date(), 30), end: new Date() }),
  },
};

/**
 * Detects which preset matches the given date range.
 * Returns 'custom' if no preset matches.
 */
function detectPresetFromDateRange(startDate: string, endDate: string): PresetKey {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const yesterdayStr = format(subDays(today, 1), "yyyy-MM-dd");
  
  // Check for single-day presets first
  if (startDate === endDate) {
    if (startDate === todayStr) return "today";
    if (startDate === yesterdayStr) return "yesterday";
    // Any other single day is custom
    return "custom";
  }
  
  // Only match multi-day presets if the end date is today
  if (endDate !== todayStr) {
    return "custom";
  }
  
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const daysDiff = differenceInDays(end, start);
  
  // Match against known presets with small tolerance
  if (daysDiff >= 6 && daysDiff <= 8) return "7d";
  if (daysDiff >= 13 && daysDiff <= 15) return "14d";
  if (daysDiff >= 29 && daysDiff <= 31) return "30d";
  if (daysDiff >= 89 && daysDiff <= 91) return "90d";
  
  // Check if it's month-to-date
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
  if (startDate === monthStart) return "mtd";
  
  // Check if it's last month
  const lastMonthStart = format(startOfMonth(subMonths(today, 1)), "yyyy-MM-dd");
  const lastMonthEnd = format(endOfMonth(subMonths(today, 1)), "yyyy-MM-dd");
  if (startDate === lastMonthStart && endDate === lastMonthEnd) return "last-month";
  
  return "custom";
}

const compareModes: Record<CompareMode, { label: string; getRange: (start: Date, end: Date) => { start: Date; end: Date } | null }> = {
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

interface V3DateRangePickerProps {
  className?: string;
  showPresets?: boolean;
  showCompareSelector?: boolean;
  onCompareChange?: (compareRange: { start: Date; end: Date } | null, mode: CompareMode) => void;
}

export const V3DateRangePicker: React.FC<V3DateRangePickerProps> = ({
  className,
  showPresets = true,
  showCompareSelector = false,
  onCompareChange,
}) => {
  const { dateRange, setDateRange } = useDashboardStore();
  // Initialize preset based on stored date range, not hardcoded
  const [selectedPreset, setSelectedPreset] = React.useState<PresetKey>(() => 
    detectPresetFromDateRange(dateRange.startDate, dateRange.endDate)
  );
  const [compareMode, setCompareMode] = React.useState<CompareMode>("none");
  const [isOpen, setIsOpen] = React.useState(false);

  // Sync preset when date range changes externally (e.g., from persisted storage or other components)
  React.useEffect(() => {
    const detectedPreset = detectPresetFromDateRange(dateRange.startDate, dateRange.endDate);
    if (detectedPreset !== selectedPreset) {
      setSelectedPreset(detectedPreset);
    }
  }, [dateRange.startDate, dateRange.endDate]);

  const startDate = new Date(dateRange.startDate);
  const endDate = new Date(dateRange.endDate);

  const handlePresetChange = (preset: PresetKey) => {
    setSelectedPreset(preset);
    if (preset !== "custom") {
      const { start, end } = presets[preset].getValue();
      setDateRange(format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd"));
    }
  };

  const handleDateSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (range?.from) {
      setDateRange(
        format(range.from, "yyyy-MM-dd"),
        format(range.to || range.from, "yyyy-MM-dd")
      );
      setSelectedPreset("custom");
    }
  };

  const handleCompareModeChange = (mode: CompareMode) => {
    setCompareMode(mode);
    const compareRange = compareModes[mode].getRange(startDate, endDate);
    onCompareChange?.(compareRange, mode);
  };

  // Update compare range when date range changes
  React.useEffect(() => {
    if (compareMode !== "none" && onCompareChange) {
      const compareRange = compareModes[compareMode].getRange(startDate, endDate);
      onCompareChange(compareRange, compareMode);
    }
  }, [dateRange.startDate, dateRange.endDate, compareMode]);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showPresets && (
        <Select value={selectedPreset} onValueChange={(v) => handlePresetChange(v as PresetKey)}>
          <SelectTrigger
            className={cn(
              "w-[140px] h-9",
              "bg-[hsl(var(--portal-bg-secondary))] border-[hsl(var(--portal-border))]",
              "text-[hsl(var(--portal-text-primary))]",
              // Premium hover styling matching hero KPI cards
              "transition-all duration-200",
              "hover:border-[hsl(var(--portal-accent-blue)/0.5)]",
              "hover:shadow-[0_0_12px_hsl(var(--portal-accent-blue)/0.08)]",
              "focus:border-[hsl(var(--portal-accent-blue))]",
              "focus:shadow-[0_0_16px_hsl(var(--portal-accent-blue)/0.12)]"
            )}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(presets).map(([key, preset]) => (
              <SelectItem key={key} value={key}>
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "h-9 justify-start text-left font-normal",
              "bg-[hsl(var(--portal-bg-secondary))] border-[hsl(var(--portal-border))]",
              "text-[hsl(var(--portal-text-primary))]",
              // Premium hover styling matching hero KPI cards
              "transition-all duration-200",
              "hover:bg-[hsl(var(--portal-bg-hover))]",
              "hover:border-[hsl(var(--portal-accent-blue)/0.5)]",
              "hover:shadow-[0_0_12px_hsl(var(--portal-accent-blue)/0.08)]",
              // Active/open state
              isOpen && [
                "border-[hsl(var(--portal-accent-blue))]",
                "shadow-[0_0_16px_hsl(var(--portal-accent-blue)/0.12)]",
              ]
            )}
          >
            <CalendarIcon className={cn(
              "mr-2 h-4 w-4 transition-colors duration-200",
              isOpen ? "text-[hsl(var(--portal-accent-blue))]" : "text-[hsl(var(--portal-text-muted))]"
            )} />
            <span className="hidden sm:inline">
              {format(startDate, "MMM d, yyyy")} - {format(endDate, "MMM d, yyyy")}
            </span>
            <span className="sm:hidden">
              {format(startDate, "MMM d")} - {format(endDate, "MMM d")}
            </span>
            <ChevronDown className={cn(
              "ml-2 h-4 w-4 transition-transform duration-200",
              isOpen ? "rotate-180 text-[hsl(var(--portal-accent-blue))]" : "text-[hsl(var(--portal-text-muted))]"
            )} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            selected={{ from: startDate, to: endDate }}
            onSelect={handleDateSelect}
            numberOfMonths={2}
            defaultMonth={subDays(new Date(), 30)}
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>

      {showCompareSelector && (
        <Select value={compareMode} onValueChange={(v) => handleCompareModeChange(v as CompareMode)}>
          <SelectTrigger
            className={cn(
              "w-[180px] h-9",
              "bg-[hsl(var(--portal-bg-secondary))] border-[hsl(var(--portal-border))]",
              "text-[hsl(var(--portal-text-primary))]",
              // Premium hover styling matching hero KPI cards
              "transition-all duration-200",
              "hover:border-[hsl(var(--portal-accent-purple)/0.5)]",
              "hover:shadow-[0_0_12px_hsl(var(--portal-accent-purple)/0.08)]",
              "focus:border-[hsl(var(--portal-accent-purple))]",
              "focus:shadow-[0_0_16px_hsl(var(--portal-accent-purple)/0.12)]",
              // Active state when comparing
              compareMode !== "none" && [
                "border-[hsl(var(--portal-accent-purple)/0.5)]",
                "bg-[hsl(var(--portal-accent-purple)/0.05)]",
              ]
            )}
          >
            <GitCompare className={cn(
              "mr-2 h-4 w-4 transition-colors duration-200",
              compareMode !== "none" ? "text-[hsl(var(--portal-accent-purple))]" : "text-[hsl(var(--portal-text-muted))]"
            )} />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(compareModes).map(([key, mode]) => (
              <SelectItem key={key} value={key}>
                {mode.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};

V3DateRangePicker.displayName = "V3DateRangePicker";

// Export types for external use
export type { CompareMode };
