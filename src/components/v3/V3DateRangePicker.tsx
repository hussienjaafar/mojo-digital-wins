import * as React from "react";
import { format, subDays, startOfMonth, endOfMonth, subMonths, subYears, differenceInDays } from "date-fns";
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

type PresetKey = 'today' | '7d' | '14d' | '30d' | '90d' | 'mtd' | 'last-month' | 'custom';
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
  const [selectedPreset, setSelectedPreset] = React.useState<PresetKey>("30d");
  const [compareMode, setCompareMode] = React.useState<CompareMode>("none");
  const [isOpen, setIsOpen] = React.useState(false);

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
          <SelectTrigger className="w-[140px] h-9 bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-primary))]">
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
              "bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))]",
              "text-[hsl(var(--portal-text-primary))] hover:bg-[hsl(var(--portal-bg-hover))]"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
            <span className="hidden sm:inline">
              {format(startDate, "MMM d, yyyy")} - {format(endDate, "MMM d, yyyy")}
            </span>
            <span className="sm:hidden">
              {format(startDate, "MMM d")} - {format(endDate, "MMM d")}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
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
          <SelectTrigger className="w-[180px] h-9 bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-primary))]">
            <GitCompare className="mr-2 h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
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
