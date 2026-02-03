/**
 * MapLegend Component
 *
 * Displays the color scale legend for the voter impact map.
 * Shows flippability levels based on mobilizable Muslim voters vs election margin.
 */

import { IMPACT_COLORS } from "@/types/voter-impact";

const legendItems = [
  { color: IMPACT_COLORS.HIGH, label: "High", description: "Can flip district" },
  { color: IMPACT_COLORS.MEDIUM, label: "Medium", description: "Strong influence" },
  { color: IMPACT_COLORS.LOW, label: "Low", description: "Some influence" },
  { color: IMPACT_COLORS.NONE, label: "None", description: "Minimal impact" },
];

export const MapLegend: React.FC = () => {
  return (
    <div
      className="absolute bottom-4 left-4 bg-[#141b2d]/90 backdrop-blur-sm rounded-lg border border-[#1e2a45] p-3"
      role="region"
      aria-label="Map legend"
    >
      <div className="text-xs text-[#94a3b8] uppercase tracking-wide mb-2" id="legend-title">
        Flippability Score
      </div>
      <ul className="flex flex-col gap-1.5" role="list" aria-labelledby="legend-title">
        {legendItems.map((item) => (
          <li key={item.label} role="listitem" className="flex items-center gap-2">
            <div
              className="w-4 h-3 rounded-sm"
              style={{ backgroundColor: item.color }}
              aria-label={`${item.label} impact: ${item.description}`}
              role="img"
            />
            <span className="text-xs text-white font-medium w-14">
              {item.label}
            </span>
            <span className="text-xs text-[#94a3b8]">{item.description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MapLegend;
