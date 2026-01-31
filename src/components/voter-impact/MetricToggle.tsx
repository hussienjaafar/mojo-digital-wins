/**
 * MetricToggle Component
 *
 * Dropdown component for selecting the metric type to display on the voter impact map.
 * Options: Impact Potential, Muslim Voters, Untapped Voters, Turnout Rate.
 */

import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { MetricType } from "@/types/voter-impact";

// ============================================================================
// Types
// ============================================================================

interface MetricToggleProps {
  value: MetricType;
  onChange: (value: MetricType) => void;
}

// ============================================================================
// Constants
// ============================================================================

const METRIC_LABELS: Record<MetricType, string> = {
  impact: "Impact Potential",
  population: "Muslim Voters",
  untapped: "Untapped Voters",
  turnout: "Turnout Rate",
};

const METRIC_OPTIONS: MetricType[] = ["impact", "population", "untapped", "turnout"];

// ============================================================================
// Component
// ============================================================================

export function MetricToggle({ value, onChange }: MetricToggleProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="bg-[#141b2d]/90 border-[#1e2a45] text-[#e2e8f0] hover:bg-[#1e2a45] hover:text-[#e2e8f0]"
        >
          {METRIC_LABELS[value]}
          <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="bg-[#141b2d] border-[#1e2a45]"
      >
        {METRIC_OPTIONS.map((metric) => (
          <DropdownMenuItem
            key={metric}
            onClick={() => onChange(metric)}
            className={`text-[#e2e8f0] hover:bg-[#1e2a45] focus:bg-[#1e2a45] cursor-pointer ${
              value === metric ? "bg-[#1e2a45]" : ""
            }`}
          >
            {METRIC_LABELS[metric]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default MetricToggle;
