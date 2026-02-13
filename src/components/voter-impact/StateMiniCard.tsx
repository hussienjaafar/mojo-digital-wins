/**
 * StateMiniCard Component
 *
 * A small colored card for non-contiguous states (Alaska, Hawaii).
 * Displays state abbreviation and formatted metric value, colored
 * using the same color scale as the main map.
 */

import { useCallback } from "react";

interface StateMiniCardProps {
  stateCode: string;
  stateName: string;
  formattedValue: string;
  fillColor: string;
  onSelect: (regionId: string | null, type: "state" | "district") => void;
  onHover?: (regionId: string | null, type: "state" | "district") => void;
}

export function StateMiniCard({
  stateCode,
  stateName,
  formattedValue,
  fillColor,
  onSelect,
  onHover,
}: StateMiniCardProps) {
  const handleClick = useCallback(() => {
    onSelect(stateCode, "state");
  }, [stateCode, onSelect]);

  const handleMouseEnter = useCallback(() => {
    onHover?.(stateCode, "state");
  }, [stateCode, onHover]);

  const handleMouseLeave = useCallback(() => {
    onHover?.(null, "state");
  }, [onHover]);

  return (
    <button
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="group flex items-center gap-2.5 rounded-lg border border-[#1e2a45] bg-[#0a0f1a]/90 backdrop-blur-md px-3 py-2 cursor-pointer transition-all hover:border-[#3b82f6] hover:shadow-lg hover:shadow-blue-500/10"
      aria-label={`${stateName}: ${formattedValue}`}
    >
      <div
        className="w-3 h-8 rounded-sm shrink-0"
        style={{ backgroundColor: fillColor }}
      />
      <div className="text-left">
        <div className="text-xs font-bold text-[#e2e8f0] leading-tight">
          {stateCode}
        </div>
        <div className="text-[10px] text-[#94a3b8] leading-tight group-hover:text-[#cbd5e1] transition-colors">
          {formattedValue}
        </div>
      </div>
    </button>
  );
}
