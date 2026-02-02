/**
 * MapLegend Component
 *
 * Displays the color scale legend for the voter impact map.
 * Shows flippability levels based on mobilizable Muslim voters vs election margin.
 */

const legendItems = [
  { color: "#22c55e", label: "High", description: "Can flip election" },
  { color: "#eab308", label: "Medium", description: "25-50% of margin" },
  { color: "#ef4444", label: "Low", description: "< 25% of margin" },
  { color: "#374151", label: "None", description: "No data" },
];

export const MapLegend: React.FC = () => {
  return (
    <div className="absolute bottom-4 left-4 bg-[#141b2d]/90 backdrop-blur-sm rounded-lg border border-[#1e2a45] p-3">
      <div className="text-xs text-[#64748b] uppercase tracking-wide mb-2">
        Flippability Score
      </div>
      <div className="flex flex-col gap-1.5">
        {legendItems.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <div
              className="w-4 h-3 rounded-sm"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs text-white font-medium w-14">
              {item.label}
            </span>
            <span className="text-xs text-[#64748b]">{item.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MapLegend;
