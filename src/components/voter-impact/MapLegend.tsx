/**
 * MapLegend Component
 *
 * Displays a continuous gradient bar legend for the Muslim voter population heatmap.
 */

import { getColorStopsForMetric, getMetricLabel, METRIC_CONFIGS } from "@/types/voter-impact";
import type { MetricType, ColorStop } from "@/types/voter-impact";

interface MapLegendProps {
  isDistrictView?: boolean;
  activeMetric?: MetricType;
  colorStopsOverride?: ColorStop[] | null;
}

export const MapLegend: React.FC<MapLegendProps> = ({ isDistrictView = false, activeMetric = "population", colorStopsOverride }) => {
  const config = METRIC_CONFIGS[activeMetric];
  const colorStops = colorStopsOverride ?? getColorStopsForMetric(activeMetric);

  // Show "not available" for district-level metrics that don't exist
  const noDistrictData = isDistrictView && !config.districtField;

  // Build gradient string from color stops
  const gradientColors = colorStops.map(
    (stop, i) => `${stop.color} ${(i / (colorStops.length - 1)) * 100}%`
  ).join(", ");

  // Build 3 ticks: start, middle, end
  const midIndex = Math.floor((colorStops.length - 1) / 2);
  const lastIndex = colorStops.length - 1;
  const ticks = [
    { label: colorStops[0].label, pos: 0, align: "left" as const },
    { label: colorStops[midIndex].label, pos: (midIndex / lastIndex) * 100, align: "center" as const },
    { label: colorStops[lastIndex].label + "+", pos: 100, align: "right" as const },
  ];

  return (
    <div
      className="absolute bottom-4 left-4 bg-[#0a0f1a]/95 backdrop-blur-md rounded-xl border border-[#1e2a45] p-4 shadow-xl min-w-[260px]"
      role="region"
      aria-label="Map legend"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
        <span className="text-xs text-[#64748b] uppercase tracking-wider font-medium">
          {getMetricLabel(activeMetric)} {isDistrictView ? "(Districts)" : "(States)"}
        </span>
        {colorStopsOverride && isDistrictView && (
          <span className="text-[10px] text-[#60a5fa] font-medium ml-1">(relative to state)</span>
        )}
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
            className={`absolute text-[10px] text-[#94a3b8] ${
              tick.align === "left" ? "translate-x-0" : tick.align === "right" ? "-translate-x-full" : "-translate-x-1/2"
            }`}
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
