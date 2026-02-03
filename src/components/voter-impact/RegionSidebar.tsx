/**
 * RegionSidebar Component
 *
 * Sidebar showing region details and comparison mode for the voter impact map.
 * Displays district or state information based on selection.
 */

import { X, Plus, Trash2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

import type {
  VoterImpactState,
  VoterImpactDistrict,
} from "@/queries/useVoterImpactQueries";
import { calculateImpactScore, IMPACT_THRESHOLDS } from "@/types/voter-impact";

// ============================================================================
// Types
// ============================================================================

export interface RegionSidebarProps {
  selectedRegion: {
    type: "state" | "district";
    data: VoterImpactState | VoterImpactDistrict;
  } | null;
  comparisonItems: Array<{
    type: "state" | "district";
    data: VoterImpactState | VoterImpactDistrict;
  }>;
  onAddToCompare: () => void;
  onRemoveFromCompare: (id: string) => void;
  onClearComparison: () => void;
}

// ============================================================================
// Type Guards
// ============================================================================

function isDistrict(
  data: VoterImpactState | VoterImpactDistrict
): data is VoterImpactDistrict {
  return "cd_code" in data;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function formatPercent(pct: number): string {
  return `${(pct * 100).toFixed(1)}%`;
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toLocaleString()}`;
}

function getImpactLevel(
  district: VoterImpactDistrict
): "HIGH" | "MEDIUM" | "LOW" | "NO IMPACT" {
  if (!district.can_impact) {
    return "NO IMPACT";
  }
  const score = calculateImpactScore(district);
  if (score >= IMPACT_THRESHOLDS.HIGH) {
    return "HIGH";
  }
  if (score >= IMPACT_THRESHOLDS.MEDIUM) {
    return "MEDIUM";
  }
  return "LOW";
}

function getRegionId(
  type: "state" | "district",
  data: VoterImpactState | VoterImpactDistrict
): string {
  if (type === "district" && isDistrict(data)) {
    return data.cd_code;
  }
  return (data as VoterImpactState).state_code;
}

// ============================================================================
// Sub-Components
// ============================================================================

interface ImpactBadgeProps {
  level: "HIGH" | "MEDIUM" | "LOW" | "NO IMPACT";
}

function ImpactBadge({ level }: ImpactBadgeProps) {
  const colors: Record<string, string> = {
    HIGH: "bg-[#22c55e] text-white",
    MEDIUM: "bg-[#eab308] text-black",
    LOW: "bg-[#ef4444] text-white",
    "NO IMPACT": "bg-[#374151] text-white",
  };

  return (
    <Badge className={`${colors[level]} border-0`}>
      {level}
    </Badge>
  );
}

interface PartyBadgeProps {
  party: string | null;
}

function PartyBadge({ party }: PartyBadgeProps) {
  if (!party) return null;

  const isDemocrat = party === "D";
  const color = isDemocrat ? "bg-blue-500" : "bg-red-500";
  const label = isDemocrat ? "D" : "R";

  return (
    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold text-white ${color}`}>
      {label}
    </span>
  );
}

interface InfoCardProps {
  title: string;
  children: React.ReactNode;
}

function InfoCard({ title, children }: InfoCardProps) {
  return (
    <Card className="bg-[#0a0f1a] border-[#1e2a45]">
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-sm font-medium text-[#64748b]">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        {children}
      </CardContent>
    </Card>
  );
}

interface DistrictDetailsProps {
  district: VoterImpactDistrict;
}

function DistrictDetails({ district }: DistrictDetailsProps) {
  const impactLevel = getImpactLevel(district);
  const turnoutPct = district.turnout_pct * 100;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#e2e8f0]">{district.cd_code}</h2>
        <ImpactBadge level={impactLevel} />
      </div>

      {/* Muslim Voters Card */}
      <InfoCard title="Muslim Voters">
        <div className="space-y-2">
          <div className="flex justify-between text-[#e2e8f0]">
            <span>Total</span>
            <span className="font-semibold">{formatNumber(district.muslim_voters)}</span>
          </div>
          <div className="flex justify-between text-[#e2e8f0]">
            <span>Registered</span>
            <span className="font-semibold text-[#22c55e]">{formatNumber(district.muslim_registered)}</span>
          </div>
          <div className="flex justify-between text-[#e2e8f0]">
            <span>Unregistered</span>
            <span className="font-semibold text-[#ef4444]">{formatNumber(district.muslim_unregistered)}</span>
          </div>
        </div>
      </InfoCard>

      {/* 2024 Turnout Card */}
      <InfoCard title="2024 Turnout">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[#e2e8f0]">
            <span>Turnout Rate</span>
            <span className="font-semibold">{formatPercent(district.turnout_pct)}</span>
          </div>
          <Progress
            value={turnoutPct}
            className="h-2 bg-[#1e2a45]"
            indicatorClassName="bg-blue-500"
          />
          <div className="flex justify-between text-sm">
            <span className="text-[#22c55e]">Voted: {formatNumber(district.voted_2024)}</span>
            <span className="text-[#ef4444]">Didn't Vote: {formatNumber(district.didnt_vote_2024)}</span>
          </div>
        </div>
      </InfoCard>

      {/* Election Margin Card */}
      <InfoCard title="Election Margin">
        <div className="space-y-2">
          <div className="flex justify-between text-[#e2e8f0]">
            <span>Margin</span>
            <span className="font-semibold">
              {district.margin_votes !== null ? formatNumber(district.margin_votes) : "N/A"} votes
              {district.margin_pct !== null && ` (${formatPercent(district.margin_pct)})`}
            </span>
          </div>
          <div className="flex items-center justify-between text-[#e2e8f0]">
            <span className="flex items-center gap-2">
              Winner
              <PartyBadge party={district.winner_party} />
            </span>
            <span className="font-semibold">{district.winner || "N/A"}</span>
          </div>
          <div className="flex items-center justify-between text-[#e2e8f0]">
            <span className="flex items-center gap-2">
              Runner-up
              <PartyBadge party={district.runner_up_party} />
            </span>
            <span className="font-semibold">{district.runner_up || "N/A"}</span>
          </div>
        </div>
      </InfoCard>

      {/* Mobilization Card (only if can_impact) */}
      {district.can_impact && (
        <InfoCard title="Mobilization Potential">
          <div className="space-y-2">
            <div className="flex justify-between text-[#e2e8f0]">
              <span>Votes Needed</span>
              <span className="font-semibold text-[#eab308]">
                {district.votes_needed !== null ? formatNumber(district.votes_needed) : "N/A"}
              </span>
            </div>
            <div className="flex justify-between text-[#e2e8f0]">
              <span>Cost Estimate</span>
              <span className="font-semibold text-[#22c55e]">
                {district.cost_estimate !== null ? formatCurrency(district.cost_estimate) : "N/A"}
              </span>
            </div>
          </div>
        </InfoCard>
      )}
    </div>
  );
}

interface StateDetailsProps {
  state: VoterImpactState;
}

function StateDetails({ state }: StateDetailsProps) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#e2e8f0]">{state.state_name}</h2>
          <span className="text-sm text-[#64748b]">{state.state_code}</span>
        </div>
      </div>

      {/* Muslim Voters Card */}
      <InfoCard title="Muslim Voters">
        <div className="space-y-2">
          <div className="flex justify-between text-[#e2e8f0]">
            <span>Total</span>
            <span className="font-semibold">{formatNumber(state.muslim_voters)}</span>
          </div>
          <div className="flex justify-between text-[#e2e8f0]">
            <span>Registered</span>
            <span className="font-semibold text-[#22c55e]">{formatNumber(state.registered)}</span>
          </div>
          <div className="flex justify-between text-[#e2e8f0]">
            <span>Registration Rate</span>
            <span className="font-semibold">{formatPercent(state.registered_pct)}</span>
          </div>
        </div>
      </InfoCard>

      {/* Voting History Card */}
      <InfoCard title="Voting History">
        <div className="space-y-2">
          <div className="flex justify-between text-[#e2e8f0]">
            <span>2024 Turnout</span>
            <span className="font-semibold">{formatPercent(state.vote_2024_pct)}</span>
          </div>
          <Progress
            value={state.vote_2024_pct * 100}
            className="h-2 bg-[#1e2a45]"
            indicatorClassName="bg-blue-500"
          />
          <div className="flex justify-between text-[#e2e8f0]">
            <span>2022 Turnout</span>
            <span className="font-semibold">{formatPercent(state.vote_2022_pct)}</span>
          </div>
          <Progress
            value={state.vote_2022_pct * 100}
            className="h-2 bg-[#1e2a45]"
            indicatorClassName="bg-[#64748b]"
          />
        </div>
      </InfoCard>

      {/* Political Engagement Card */}
      <InfoCard title="Political Engagement">
        <div className="space-y-2">
          <div className="flex justify-between text-[#e2e8f0]">
            <span>Political Donors</span>
            <span className="font-semibold">{formatNumber(state.political_donors)}</span>
          </div>
          <div className="flex justify-between text-[#e2e8f0]">
            <span>Political Activists</span>
            <span className="font-semibold">{formatNumber(state.political_activists)}</span>
          </div>
        </div>
      </InfoCard>
    </div>
  );
}

interface ComparisonItemProps {
  type: "state" | "district";
  data: VoterImpactState | VoterImpactDistrict;
  onRemove: () => void;
}

function ComparisonItem({ type, data, onRemove }: ComparisonItemProps) {
  const label = type === "district" && isDistrict(data)
    ? data.cd_code
    : (data as VoterImpactState).state_name;

  return (
    <div className="flex items-center justify-between p-2 bg-[#0a0f1a] border border-[#1e2a45] rounded">
      <span className="text-sm text-[#e2e8f0]">{label}</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="h-6 w-6 p-0 text-[#64748b] hover:text-[#ef4444] hover:bg-transparent"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function RegionSidebar({
  selectedRegion,
  comparisonItems,
  onAddToCompare,
  onRemoveFromCompare,
  onClearComparison,
}: RegionSidebarProps) {
  const canAddToCompare =
    selectedRegion !== null &&
    comparisonItems.length < 4 &&
    !comparisonItems.some(
      (item) =>
        getRegionId(item.type, item.data) ===
        getRegionId(selectedRegion.type, selectedRegion.data)
    );

  return (
    <div className="w-80 bg-[#141b2d] border-l border-[#1e2a45] flex flex-col h-full overflow-hidden">
      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {selectedRegion ? (
          <>
            {selectedRegion.type === "district" && isDistrict(selectedRegion.data) ? (
              <DistrictDetails district={selectedRegion.data} />
            ) : (
              <StateDetails state={selectedRegion.data as VoterImpactState} />
            )}

            {/* Add to Compare Button */}
            {canAddToCompare && (
              <Button
                variant="outline"
                size="sm"
                onClick={onAddToCompare}
                className="w-full mt-4 bg-[#0a0f1a] border-[#1e2a45] text-[#e2e8f0] hover:bg-[#1e2a45] hover:text-[#e2e8f0]"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add to Compare
              </Button>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <p className="text-[#64748b] text-sm">
              Select a region on the map to view details
            </p>
          </div>
        )}
      </div>

      {/* Comparison Mode Section */}
      {comparisonItems.length > 0 && (
        <div className="border-t border-[#1e2a45] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-[#e2e8f0]">
              Comparing ({comparisonItems.length}/4)
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearComparison}
              className="h-7 px-2 text-[#64748b] hover:text-[#ef4444] hover:bg-transparent"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Clear All
            </Button>
          </div>
          <div className="space-y-2">
            {comparisonItems.map((item) => {
              const id = getRegionId(item.type, item.data);
              return (
                <ComparisonItem
                  key={id}
                  type={item.type}
                  data={item.data}
                  onRemove={() => onRemoveFromCompare(id)}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default RegionSidebar;
