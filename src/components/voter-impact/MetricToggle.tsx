/**
 * MetricToggle Component
 *
 * Dropdown component for selecting the metric type to display on the voter impact map.
 * Options: Impact Potential, Muslim Voters, Untapped Voters, Turnout Rate.
 */

import { ChevronDown, Zap, Users, UserPlus, TrendingUp } from "lucide-react";

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

const METRIC_CONFIG: Record<MetricType, { label: string; icon: React.ReactNode; color: string }> = {
  impact: { label: "Impact Potential", icon: <Zap className="h-4 w-4" />, color: "text-[#22c55e]" },
  population: { label: "Muslim Voters", icon: <Users className="h-4 w-4" />, color: "text-blue-400" },
  untapped: { label: "Untapped Voters", icon: <UserPlus className="h-4 w-4" />, color: "text-[#f59e0b]" },
  turnout: { label: "Turnout Rate", icon: <TrendingUp className="h-4 w-4" />, color: "text-[#a855f7]" },
};

const METRIC_OPTIONS: MetricType[] = ["impact", "population", "untapped", "turnout"];

// ============================================================================
// Component
// ============================================================================

export function MetricToggle({ value, onChange }: MetricToggleProps) {
  const currentConfig = METRIC_CONFIG[value];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="bg-[#0a0f1a] border-[#1e2a45] text-[#e2e8f0] hover:bg-[#1e2a45] hover:text-[#e2e8f0] rounded-lg px-3"
        >
          <span className={currentConfig.color}>{currentConfig.icon}</span>
          <span className="ml-2">{currentConfig.label}</span>
          <ChevronDown className="ml-2 h-4 w-4 text-[#64748b]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="bg-[#0a0f1a]/95 backdrop-blur-md border-[#1e2a45] rounded-xl p-1 min-w-[180px]"
      >
        {METRIC_OPTIONS.map((metric) => {
          const config = METRIC_CONFIG[metric];
          const isActive = value === metric;
          return (
            <DropdownMenuItem
              key={metric}
              onClick={() => onChange(metric)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                isActive
                  ? "bg-[#1e2a45] text-[#e2e8f0]"
                  : "text-[#94a3b8] hover:bg-[#1e2a45]/50 hover:text-[#e2e8f0]"
              }`}
            >
              <span className={config.color}>{config.icon}</span>
              <span className="font-medium">{config.label}</span>
              {isActive && (
                <span className="ml-auto w-2 h-2 rounded-full bg-blue-500" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default MetricToggle;
