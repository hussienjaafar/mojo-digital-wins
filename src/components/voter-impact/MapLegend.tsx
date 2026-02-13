/**
 * MapLegend Component
 *
 * Displays a continuous gradient bar legend for the Muslim voter population heatmap.
 */

import { POPULATION_COLOR_STOPS } from "@/types/voter-impact";

interface MapLegendProps {
  isDistrictView?: boolean;
}

export const MapLegend: React.FC<MapLegendProps> = ({ isDistrictView = false }) => {
  // Build gradient string from color stops
  const gradientColors = POPULATION_COLOR_STOPS.map(
    (stop, i) => `${stop.color} ${(i / (POPULATION_COLOR_STOPS.length - 1)) * 100}%`
  ).join(", ");

  // Show fewer tick marks to keep it clean
  const ticks = isDistrictView
    ? [
        { label: "0", pos: 0 },
        { label: "1K", pos: 15 },
        { label: "5K", pos: 33 },
        { label: "10K", pos: 44 },
        { label: "25K", pos: 56 },
        { label: "50K", pos: 67 },
        { label: "65K+", pos: 100 },
      ]
    : [
        { label: "0", pos: 0 },
        { label: "5K", pos: 22 },
        { label: "25K", pos: 44 },
        { label: "100K", pos: 67 },
        { label: "200K", pos: 78 },
        { label: "500K+", pos: 100 },
      ];

  return (
    <div
      className="absolute bottom-4 left-4 bg-[#0a0f1a]/95 backdrop-blur-md rounded-xl border border-[#1e2a45] p-4 shadow-xl min-w-[220px]"
      role="region"
      aria-label="Map legend"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
        <span className="text-xs text-[#64748b] uppercase tracking-wider font-medium">
          Muslim Voters {isDistrictView ? "(Districts)" : "(States)"}
        </span>
      </div>

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
