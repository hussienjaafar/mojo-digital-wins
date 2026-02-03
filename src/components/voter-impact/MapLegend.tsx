/**
 * MapLegend Component
 *
 * Displays the color scale legend for the voter impact map.
 * Shows flippability levels based on mobilizable Muslim voters vs election margin.
 */

import { IMPACT_COLORS } from "@/types/voter-impact";

const legendItems = [
  { color: IMPACT_COLORS.HIGH, label: "High", description: "Can flip district", bgClass: "bg-[#22c55e]/10 border-[#22c55e]/30" },
  { color: IMPACT_COLORS.MEDIUM, label: "Medium", description: "Strong influence", bgClass: "bg-[#f97316]/10 border-[#f97316]/30" },
  { color: IMPACT_COLORS.LOW, label: "Low", description: "Some influence", bgClass: "bg-[#a855f7]/10 border-[#a855f7]/30" },
  { color: IMPACT_COLORS.NONE, label: "None", description: "Minimal impact", bgClass: "bg-[#64748b]/10 border-[#64748b]/30" },
];

export const MapLegend: React.FC = () => {
  return (
    <div
      className="absolute bottom-4 left-4 bg-[#0a0f1a]/95 backdrop-blur-md rounded-xl border border-[#1e2a45] p-4 shadow-xl"
      role="region"
      aria-label="Map legend"
    >
      <div className="flex items-center gap-2 mb-3" id="legend-title">
        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
        <span className="text-xs text-[#64748b] uppercase tracking-wider font-medium">
          Impact Score
        </span>
      </div>
      <ul className="flex flex-col gap-2" role="list" aria-labelledby="legend-title">
        {legendItems.map((item) => (
          <li
            key={item.label}
            role="listitem"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${item.bgClass} transition-all hover:scale-[1.02]`}
          >
            <div
              className="w-3 h-3 rounded-full shadow-lg"
              style={{ backgroundColor: item.color, boxShadow: `0 0 8px ${item.color}50` }}
              aria-label={`${item.label} impact: ${item.description}`}
              role="img"
            />
            <div className="flex flex-col">
              <span className="text-sm text-[#e2e8f0] font-medium leading-tight">
                {item.label}
              </span>
              <span className="text-xs text-[#64748b] leading-tight">{item.description}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MapLegend;
