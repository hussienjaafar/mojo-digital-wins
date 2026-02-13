/**
 * MapLegend Component
 *
 * Displays a continuous gradient bar legend for the Muslim voter population heatmap.
 */

import { getColorStopsForMetric, getMetricLabel, METRIC_CONFIGS } from "@/types/voter-impact";
import type { MetricType } from "@/types/voter-impact";

interface MapLegendProps {
  isDistrictView?: boolean;
  activeMetric?: MetricType;
}

export const MapLegend: React.FC<MapLegendProps> = ({ isDistrictView = false, activeMetric = "population" }) => {
  const config = METRIC_CONFIGS[activeMetric];
  const colorStops = getColorStopsForMetric(activeMetric);

  // Show "not available" for district-level metrics that don't exist
  const noDistrictData = isDistrictView && !config.districtField;

  // Build gradient string from color stops
  const gradientColors = colorStops.map(
    (stop, i) => `${stop.color} ${(i / (colorStops.length - 1)) * 100}%`
  ).join(", ");

  // Build ticks from color stops - show first, last, and evenly spaced middle ones
  const maxTicks = 6;
  const step = Math.max(1, Math.floor((colorStops.length - 1) / (maxTicks - 1)));
  const ticks: { label: string; pos: number }[] = [];
  for (let i = 0; i < colorStops.length; i += step) {
    ticks.push({
      label: colorStops[i].label,
      pos: (i / (colorStops.length - 1)) * 100,
    });
  }
  // Ensure last tick is always included
  const lastStop = colorStops[colorStops.length - 1];
  if (ticks[ticks.length - 1]?.label !== lastStop.label) {
    ticks.push({ label: lastStop.label + "+", pos: 100 });
  }

  return (
    <div
      className="absolute bottom-4 left-4 bg-[#0a0f1a]/95 backdrop-blur-md rounded-xl border border-[#1e2a45] p-4 shadow-xl min-w-[220px]"
      role="region"
      aria-label="Map legend"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
        <span className="text-xs text-[#64748b] uppercase tracking-wider font-medium">
          {getMetricLabel(activeMetric)} {isDistrictView ? "(Districts)" : "(States)"}
        </span>
      </div>

      {noDistrictData && (
        <div className="text-xs text-[#f59e0b] mb-2">
          ⚠ Not available at district level
        </div>
      )}

      {/* Gradient bar */}
      <div
        className="h-3 rounded-full mb-2"
        style={{
          background: `linear-gradient(to right, ${gradientColors})`,
        }}
        role="img"
        aria-label="Color scale from dark (zero voters) to bright yellow (500K+ voters)"
      />

      {/* Tick labels */}
      <div className="relative h-4">
        {ticks.map((tick) => (
          <span
            key={tick.label}
            className="absolute text-[10px] text-[#94a3b8] -translate-x-1/2"
            style={{ left: `${tick.pos}%` }}
          >
            {tick.label}
          </span>
        ))}
      </div>
    </div>
  );
};

export default MapLegend;
