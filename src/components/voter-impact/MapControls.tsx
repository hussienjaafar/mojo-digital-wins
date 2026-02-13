/**
 * MapControls Component
 *
 * Metric toggle bar for the voter population heatmap.
 */

import type { MetricType } from "@/types/voter-impact";

// ============================================================================
// Types
// ============================================================================

export interface MapControlsProps {
  activeMetric: MetricType;
  onMetricChange: (metric: MetricType) => void;
}

const METRIC_OPTIONS: { key: MetricType; label: string }[] = [
  { key: "population", label: "Population" },
  { key: "donors", label: "Donors" },
  { key: "activists", label: "Activists" },
  { key: "turnout", label: "Turnout %" },
];

// ============================================================================
// Component
// ============================================================================

export function MapControls({
  activeMetric,
  onMetricChange,
}: MapControlsProps) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-2 bg-[#0a0f1a]/95 backdrop-blur-md border-b border-[#1e2a45]"
      role="toolbar"
      aria-label="Map filter controls"
    >
      {/* Metric Toggle */}
      <div className="flex items-center bg-[#141b2d] rounded-lg border border-[#1e2a45] p-0.5" role="radiogroup" aria-label="Select metric to visualize">
        {METRIC_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            role="radio"
            aria-checked={activeMetric === opt.key}
            onClick={() => onMetricChange(opt.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
              activeMetric === opt.key
                ? "bg-blue-600 text-white shadow-sm"
                : "text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#1e2a45]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default MapControls;
