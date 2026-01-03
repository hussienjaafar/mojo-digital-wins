/**
 * DonationHeatmap - Premium V3 Donation Activity Heatmap
 * 
 * Visualizes donation patterns by day-of-week × hour-of-day
 * with interactive cell selection, metric toggle, peak time chips, and export.
 */

import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  V3TimeHeatmap, 
  V3TimeHeatmapPeakChips, 
  V3TimeHeatmapDetailsPanel,
  V3TimeHeatmapLegend,
  V3TimeHeatmapMetricToggle,
} from "@/components/charts/V3TimeHeatmap";
import { 
  V3Card, 
  V3CardHeader, 
  V3CardTitle, 
  V3CardContent, 
  V3LoadingState, 
  V3EmptyState, 
  V3ErrorState 
} from "@/components/v3";
import { Button } from "@/components/ui/button";
import { Clock, Download, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatNumber } from "@/lib/chart-formatters";
import {
  type HeatmapDataPoint,
  type HeatmapMetric,
  type RankedCell,
  normalizeHeatmapData,
  transformGridForMetric,
  calculateHeatmapStats,
  exportHeatmapToCSV,
  getMetricLabel,
} from "@/lib/heatmap-utils";

interface DonationHeatmapProps {
  organizationId: string;
  startDate: string;
  endDate: string;
  /** Timezone for hour bucketing (default: browser timezone) */
  timezone?: string;
}

// Get browser timezone
const getBrowserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
};

export const DonationHeatmap = ({
  organizationId,
  startDate,
  endDate,
  timezone = getBrowserTimezone()
}: DonationHeatmapProps) => {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  
  // Selected cell state
  const [selectedCell, setSelectedCell] = useState<HeatmapDataPoint | null>(null);
  
  // Metric state
  const [metric, setMetric] = useState<HeatmapMetric>('revenue');

  // Fetch heatmap data from RPC
  const { data: rpcData, isLoading, isError, error } = useQuery({
    queryKey: ["donations", "heatmap", organizationId, startDate, endDate, timezone],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_donation_heatmap", {
        _organization_id: organizationId,
        _start_date: startDate,
        _end_date: endDate,
        _timezone: timezone,
      });

      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  });

  // Process data into normalized grid (base data with all metrics)
  const baseHeatmapData = useMemo<HeatmapDataPoint[]>(() => {
    return normalizeHeatmapData(rpcData);
  }, [rpcData]);

  // Transform data for current metric
  const heatmapData = useMemo<HeatmapDataPoint[]>(() => {
    return transformGridForMetric(baseHeatmapData, metric);
  }, [baseHeatmapData, metric]);

  // Calculate stats for current metric view
  const stats = useMemo(() => {
    return calculateHeatmapStats(heatmapData, 5);
  }, [heatmapData]);

  // Get the value type for formatting
  const valueType = useMemo(() => {
    switch (metric) {
      case 'revenue': return 'currency' as const;
      case 'count': return 'number' as const;
      case 'avg_donation': return 'currency' as const;
      default: return 'currency' as const;
    }
  }, [metric]);

  // Format value based on metric
  const formatValue = useCallback((value: number): string => {
    switch (metric) {
      case 'revenue':
      case 'avg_donation':
        return formatCurrency(value);
      case 'count':
        return formatNumber(value);
      default:
        return formatCurrency(value);
    }
  }, [metric]);

  // Format value compact
  const formatValueCompact = useCallback((value: number): string => {
    switch (metric) {
      case 'revenue':
      case 'avg_donation':
        return formatCurrency(value, true);
      case 'count':
        return formatNumber(value, true);
      default:
        return formatCurrency(value, true);
    }
  }, [metric]);

  // Handle cell selection
  const handleCellSelect = useCallback((cell: HeatmapDataPoint | null) => {
    setSelectedCell(cell);
  }, []);

  // Handle peak chip click
  const handlePeakSelect = useCallback((peak: RankedCell) => {
    const cell = heatmapData.find(
      d => d.dayOfWeek === peak.dayOfWeek && d.hour === peak.hour
    );
    if (cell) {
      // Toggle if same cell
      if (selectedCell && selectedCell.dayOfWeek === peak.dayOfWeek && selectedCell.hour === peak.hour) {
        setSelectedCell(null);
      } else {
        setSelectedCell(cell);
      }
    }
  }, [heatmapData, selectedCell]);

  // Handle metric change - keep selection but update view
  const handleMetricChange = useCallback((newMetric: HeatmapMetric) => {
    setMetric(newMetric);
    // If a cell is selected, update it with new metric value
    if (selectedCell) {
      const updatedGrid = transformGridForMetric(baseHeatmapData, newMetric);
      const updatedCell = updatedGrid.find(
        d => d.dayOfWeek === selectedCell.dayOfWeek && d.hour === selectedCell.hour
      );
      if (updatedCell) {
        setSelectedCell(updatedCell);
      }
    }
  }, [selectedCell, baseHeatmapData]);

  // Clear selection
  const handleClearSelection = useCallback(() => {
    setSelectedCell(null);
  }, []);

  // Export to CSV
  const handleExportCSV = useCallback(() => {
    exportHeatmapToCSV(heatmapData, {
      metricLabel: getMetricLabel(metric),
      filename: `donation-heatmap-${metric}-${startDate}-to-${endDate}.csv`,
      formatValue: formatValue,
      includeCount: true,
    });

    toast({
      title: "Export successful",
      description: "Heatmap data downloaded as CSV.",
    });
  }, [heatmapData, metric, startDate, endDate, toast, formatValue]);

  // Loading state
  if (isLoading) {
    return <V3LoadingState variant="chart" height={400} />;
  }

  // Error state
  if (isError) {
    return (
      <V3ErrorState
        title="Failed to load donation heatmap"
        message={error instanceof Error ? error.message : "An error occurred"}
      />
    );
  }

  // Empty state
  if (!rpcData || rpcData.length === 0 || stats.totalValue === 0) {
    return (
      <V3EmptyState
        icon={Clock}
        title="No donation activity"
        description="Not enough donations to determine peak times. Check back when you have more data."
      />
    );
  }

  return (
    <V3Card>
      <V3CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <V3CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4" aria-hidden="true" />
              Donation Activity by Time
            </V3CardTitle>
            <p className="text-sm text-[hsl(var(--portal-text-muted))] mt-1">
              Discover peak donation times to optimize send schedules
            </p>
          </div>
          <div className="flex items-center gap-2">
            <V3TimeHeatmapMetricToggle
              metric={metric}
              onMetricChange={handleMetricChange}
              availableMetrics={['revenue', 'count', 'avg_donation']}
              compact={isMobile}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="shrink-0"
            >
              <Download className="h-4 w-4 mr-1.5" aria-hidden="true" />
              {!isMobile && 'Export'}
            </Button>
          </div>
        </div>
      </V3CardHeader>
      
      <V3CardContent className="space-y-4">
        {/* Explicit Legend */}
        <V3TimeHeatmapLegend
          metricLabel={getMetricLabel(metric)}
          minValue={stats.minValue}
          maxValue={stats.p95Value}
          avgValue={stats.avgValue}
          formatValue={formatValueCompact}
          colorScheme="blue"
          showHelp={true}
          scaleMode="linear"
        />

        {/* Main Heatmap */}
        <div
          role="figure"
          aria-label={`Heatmap showing ${getMetricLabel(metric).toLowerCase()} by day of week and hour`}
          tabIndex={0}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--portal-accent-blue)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--portal-bg-secondary))] rounded-lg"
        >
          <V3TimeHeatmap
            data={heatmapData}
            metric={metric}
            valueType={valueType}
            valueLabel={getMetricLabel(metric)}
            height={isMobile ? 340 : 300}
            colorScheme="blue"
            compact={isMobile}
            selectedCell={selectedCell}
            onCellSelect={handleCellSelect}
          />
        </div>

        {/* Selection Details Panel */}
        {selectedCell && (
          <V3TimeHeatmapDetailsPanel
            selectedCell={selectedCell}
            totalValue={stats.totalValue}
            totalCount={stats.totalCount}
            allCells={heatmapData}
            onClear={handleClearSelection}
            formatValue={formatValue}
            valueLabel={getMetricLabel(metric)}
            metric={metric}
          />
        )}

        {/* Peak Times Section */}
        {stats.peakCells.length > 0 && (
          <div className="p-3 rounded-lg bg-[hsl(var(--portal-bg-elevated))]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-[hsl(var(--portal-text-muted))]">
                Top Performing Times ({getMetricLabel(metric)})
              </p>
              {selectedCell && (
                <button
                  onClick={handleClearSelection}
                  className="inline-flex items-center gap-1 text-xs text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-text-primary))] transition-colors"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                  Clear selection
                </button>
              )}
            </div>
            <V3TimeHeatmapPeakChips
              peakCells={stats.peakCells}
              selectedCell={selectedCell}
              onSelect={handlePeakSelect}
              formatValue={formatValue}
              colorScheme="blue"
              metricLabel={getMetricLabel(metric)}
            />
          </div>
        )}
      </V3CardContent>
    </V3Card>
  );
};

export default DonationHeatmap;