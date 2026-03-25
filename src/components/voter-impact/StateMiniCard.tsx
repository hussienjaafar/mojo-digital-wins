/**
 * StateMiniCard Component
 *
 * A small colored card for non-contiguous states (Alaska, Hawaii).
 * Displays a simplified SVG outline of the state shape filled with
 * the metric-derived color, plus state abbreviation and formatted value.
 */

import { useCallback } from "react";

/** Simplified SVG path data for AK and HI state outlines */
const STATE_OUTLINES: Record<string, { viewBox: string; d: string }> = {
  AK: {
    viewBox: "0 0 100 80",
    d: "M2 38 L8 28 L18 22 L28 18 L38 12 L48 8 L58 4 L68 2 L78 6 L88 12 L95 22 L98 32 L92 42 L82 48 L72 52 L68 62 L58 68 L48 72 L38 76 L28 72 L18 64 L10 54 L4 48 Z M60 60 L55 65 L50 62 L52 58 Z",
  },
  HI: {
    viewBox: "0 0 100 70",
    d: "M62 8 L72 4 L82 8 L88 16 L92 26 L88 34 L78 38 L68 34 L62 24 L60 16 Z M42 28 L52 24 L58 32 L54 40 L44 42 L38 36 Z M22 38 L32 34 L38 42 L34 50 L24 52 L18 46 Z M6 48 L14 44 L20 52 L16 60 L8 62 L2 56 Z",
  },
};

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

  const outline = STATE_OUTLINES[stateCode];

  return (
    <button
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="group flex items-center gap-2.5 rounded-lg border border-[#1e2a45] bg-[#0a0f1a]/90 backdrop-blur-md px-3 py-2 cursor-pointer transition-all hover:border-[#3b82f6] hover:shadow-lg hover:shadow-blue-500/10"
      aria-label={`${stateName}: ${formattedValue}`}
    >
      {outline ? (
        <svg
          viewBox={outline.viewBox}
          className="w-7 h-6 shrink-0"
          aria-hidden="true"
        >
          <path
            d={outline.d}
            fill={fillColor}
            stroke="#64748b"
            strokeWidth="2"
          />
        </svg>
      ) : (
        <div
          className="w-3 h-8 rounded-sm shrink-0"
          style={{ backgroundColor: fillColor }}
        />
      )}
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
