/**
 * RegionSidebar Component
 *
 * Sidebar showing region details and comparison mode for the voter impact map.
 * Displays district or state information based on selection.
 */

import { X, Plus, Trash2, MapPin } from "lucide-react";

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
  onDeselect: () => void;
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

function normalizeParty(party: string | null): "D" | "R" | null {
  if (!party) return null;
  const normalized = party.toUpperCase().trim();
  if (normalized === "D" || normalized === "DEM" || normalized === "DEMOCRAT" || normalized === "DEMOCRATIC") {
    return "D";
  }
  if (normalized === "R" || normalized === "REP" || normalized === "REPUBLICAN" || normalized === "GOP") {
    return "R";
  }
  return null;
}

function PartyBadge({ party }: PartyBadgeProps) {
  const normalized = normalizeParty(party);
  if (!normalized) return null;

  const isDemocrat = normalized === "D";
  const color = isDemocrat ? "bg-blue-600" : "bg-red-600";
  const label = normalized;

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
    <Card className="bg-[#0a0f1a] border-[#1e2a45]" role="group" aria-label={title}>
      <CardHeader className="p-3 pb-2">
        <CardTitle as="h3" className="text-sm font-medium text-[#94a3b8]">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        {children}
      </CardContent>
    </Card>
  );
}

interface DistrictDetailsProps {
  district: VoterImpactDistrict;
  onDeselect: () => void;
}

function DistrictDetails({ district, onDeselect }: DistrictDetailsProps) {
  const impactLevel = getImpactLevel(district);
  const turnoutPct = district.turnout_pct * 100;
  const winnerParty = normalizeParty(district.winner_party);
  const runnerParty = normalizeParty(district.runner_up_party);

  return (
    <article className="space-y-4" aria-labelledby="district-heading">
      {/* Header */}
      <header className="flex items-center justify-between pb-2 border-b border-[#1e2a45]">
        <div className="flex items-center gap-3">
          <h2 id="district-heading" className="text-2xl font-bold text-[#e2e8f0]">{district.cd_code}</h2>
          <ImpactBadge level={impactLevel} />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDeselect}
          className="h-7 w-7 p-0 text-[#64748b] hover:text-[#e2e8f0] hover:bg-[#1e2a45]"
          aria-label="Close details"
        >
          <X className="h-4 w-4" />
        </Button>
      </header>

      {/* Key Metric - Muslim Voter Population */}
      <div className="bg-[#0a0f1a] rounded-lg p-4 border border-[#1e2a45]">
        <div className="text-center mb-3">
          <div className="text-3xl font-bold text-[#e2e8f0]">{formatNumber(district.muslim_voters)}</div>
          <div className="text-xs text-[#64748b] uppercase tracking-wider">Muslim Voters</div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-[#141b2d] rounded p-2">
            <div className="text-lg font-semibold text-[#22c55e]">{formatNumber(district.muslim_registered)}</div>
            <div className="text-xs text-[#64748b]">Registered</div>
          </div>
          <div className="bg-[#141b2d] rounded p-2">
            <div className="text-lg font-semibold text-[#f97316]">{formatNumber(district.muslim_unregistered)}</div>
            <div className="text-xs text-[#64748b]">Unregistered</div>
          </div>
        </div>
      </div>

      {/* 2024 Turnout - Compact */}
      <div className="bg-[#0a0f1a] rounded-lg p-4 border border-[#1e2a45]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[#64748b] uppercase tracking-wider">2024 Turnout</span>
          <span className="text-xl font-bold text-[#e2e8f0]">{formatPercent(district.turnout_pct)}</span>
        </div>
        <Progress
          value={turnoutPct}
          className="h-2 bg-[#1e2a45]"
          indicatorClassName="bg-blue-500"
        />
        <div className="flex justify-between text-xs mt-2 text-[#94a3b8]">
          <span><span className="text-[#22c55e] font-medium">{formatNumber(district.voted_2024)}</span> voted</span>
          <span><span className="text-[#64748b] font-medium">{formatNumber(district.didnt_vote_2024)}</span> didn't vote</span>
        </div>
      </div>

      {/* Election Results - Redesigned */}
      <div className="bg-[#0a0f1a] rounded-lg p-4 border border-[#1e2a45]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[#64748b] uppercase tracking-wider">2024 Race</span>
          {district.margin_pct !== null && (
            <span className="text-xs px-2 py-0.5 rounded bg-[#1e2a45] text-[#94a3b8]">
              {formatPercent(district.margin_pct)}
            </span>
          )}
        </div>
        {/* Vote Margin - Key metric for analysis */}
        {district.margin_votes !== null && (
          <div className="text-center py-2 mb-3 bg-[#141b2d] rounded border border-[#1e2a45]">
            <div className="text-2xl font-bold text-[#f59e0b]">{formatNumber(district.margin_votes)}</div>
            <div className="text-xs text-[#64748b]">vote margin</div>
          </div>
        )}

        {/* Winner */}
        <div className={`flex items-center gap-3 p-2 rounded mb-2 ${winnerParty === 'D' ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
          <PartyBadge party={district.winner_party} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-[#e2e8f0] truncate">{district.winner || "Unknown"}</div>
            <div className="text-xs text-[#64748b]">Winner • {district.winner_votes ? formatNumber(district.winner_votes) + ' votes' : ''}</div>
          </div>
        </div>

        {/* Runner-up */}
        <div className={`flex items-center gap-3 p-2 rounded ${runnerParty === 'D' ? 'bg-blue-500/5 border border-blue-500/20' : 'bg-red-500/5 border border-red-500/20'}`}>
          <PartyBadge party={district.runner_up_party} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-[#94a3b8] truncate">{district.runner_up || "Unknown"}</div>
            <div className="text-xs text-[#64748b]">Runner-up • {district.runner_up_votes ? formatNumber(district.runner_up_votes) + ' votes' : ''}</div>
          </div>
        </div>
      </div>

      {/* Mobilization Opportunity - Only if impactful */}
      {district.can_impact && district.votes_needed && (
        <div className="bg-gradient-to-r from-[#22c55e]/10 to-[#0a0f1a] rounded-lg p-4 border border-[#22c55e]/30">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
            <span className="text-xs text-[#22c55e] uppercase tracking-wider font-medium">Flip Opportunity</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-2xl font-bold text-[#e2e8f0]">{formatNumber(district.votes_needed)}</div>
              <div className="text-xs text-[#64748b]">Votes to flip</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-[#22c55e]">{district.cost_estimate ? formatCurrency(district.cost_estimate) : "N/A"}</div>
              <div className="text-xs text-[#64748b]">Est. cost</div>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

interface StateDetailsProps {
  state: VoterImpactState;
  onDeselect: () => void;
}

function StateDetails({ state, onDeselect }: StateDetailsProps) {
  return (
    <article className="space-y-3" aria-labelledby="state-heading">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>
            <h2 id="state-heading" className="text-xl font-bold text-[#e2e8f0]">{state.state_name}</h2>
            <span className="text-sm text-[#94a3b8]">{state.state_code}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDeselect}
            className="h-6 w-6 p-0 text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#1e2a45]"
            aria-label="Close details"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

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
            indicatorClassName="bg-[#94a3b8]"
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
    </article>
  );
}

interface ComparisonItemProps {
  type: "state" | "district";
  data: VoterImpactState | VoterImpactDistrict;
  onRemove: () => void;
}

function ComparisonItem({ type, data, onRemove }: ComparisonItemProps) {
  const isDistrictType = type === "district" && isDistrict(data);
  const label = isDistrictType ? data.cd_code : (data as VoterImpactState).state_name;
  const muslimVoters = data.muslim_voters;

  // Get impact score for districts
  const impactScore = isDistrictType ? calculateImpactScore(data as VoterImpactDistrict) : null;
  const marginVotes = isDistrictType ? (data as VoterImpactDistrict).margin_votes : null;

  return (
    <div className="bg-[#0a0f1a] border border-[#1e2a45] rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-[#e2e8f0]">{label}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-6 w-6 p-0 text-[#64748b] hover:text-[#ef4444] hover:bg-transparent"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="text-center p-2 bg-[#141b2d] rounded">
          <div className="text-sm font-bold text-[#e2e8f0]">{formatNumber(muslimVoters)}</div>
          <div className="text-xs text-[#64748b]">Voters</div>
        </div>
        {isDistrictType && marginVotes !== null && (
          <div className="text-center p-2 bg-[#141b2d] rounded">
            <div className="text-sm font-bold text-[#f59e0b]">{formatNumber(marginVotes)}</div>
            <div className="text-xs text-[#64748b]">Margin</div>
          </div>
        )}
        {!isDistrictType && (
          <div className="text-center p-2 bg-[#141b2d] rounded">
            <div className="text-sm font-bold text-[#22c55e]">{formatPercent((data as VoterImpactState).registered_pct)}</div>
            <div className="text-xs text-[#64748b]">Registered</div>
          </div>
        )}
      </div>
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
  onDeselect,
}: RegionSidebarProps) {
  const canAddToCompare =
    selectedRegion !== null &&
    comparisonItems.length < 4 &&
    !comparisonItems.some(
      (item) =>
        getRegionId(item.type, item.data) ===
        getRegionId(selectedRegion.type, selectedRegion.data)
    );

  // Generate region name for screen reader announcement
  const selectedRegionName = selectedRegion
    ? selectedRegion.type === "district" && isDistrict(selectedRegion.data)
      ? selectedRegion.data.cd_code
      : (selectedRegion.data as VoterImpactState).state_name
    : null;

  return (
    <div
      className="w-80 bg-[#141b2d] border-l border-[#1e2a45] flex flex-col h-full overflow-hidden"
      role="region"
      aria-label="Region Details"
    >
      {/* Screen reader announcement for region selection changes */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {selectedRegionName
          ? `Now viewing details for ${selectedRegionName}`
          : "No region selected. Click on the map to select a region."}
      </div>
      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {selectedRegion ? (
          <>
            {selectedRegion.type === "district" && isDistrict(selectedRegion.data) ? (
              <DistrictDetails district={selectedRegion.data} onDeselect={onDeselect} />
            ) : (
              <StateDetails state={selectedRegion.data as VoterImpactState} onDeselect={onDeselect} />
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
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center mb-5">
              <MapPin className="h-8 w-8 text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold text-[#e2e8f0] mb-2">Select a Region</h3>
            <p className="text-sm text-[#64748b] mb-6 max-w-[200px]">
              Click on the map to explore voter impact data
            </p>
            <div className="w-full space-y-2">
              <div className="flex items-center gap-3 p-3 bg-[#0a0f1a] rounded-lg border border-[#1e2a45]">
                <div className="w-8 h-8 rounded-lg bg-[#1e2a45] flex items-center justify-center flex-shrink-0">
                  <span className="text-sm">🗺️</span>
                </div>
                <div className="text-left">
                  <div className="text-xs font-medium text-[#e2e8f0]">Click a state</div>
                  <div className="text-xs text-[#64748b]">View state overview</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-[#0a0f1a] rounded-lg border border-[#1e2a45]">
                <div className="w-8 h-8 rounded-lg bg-[#1e2a45] flex items-center justify-center flex-shrink-0">
                  <span className="text-sm">🔍</span>
                </div>
                <div className="text-left">
                  <div className="text-xs font-medium text-[#e2e8f0]">Zoom in</div>
                  <div className="text-xs text-[#64748b]">See congressional districts</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-[#0a0f1a] rounded-lg border border-[#1e2a45]">
                <div className="w-8 h-8 rounded-lg bg-[#1e2a45] flex items-center justify-center flex-shrink-0">
                  <span className="text-sm">⚡</span>
                </div>
                <div className="text-left">
                  <div className="text-xs font-medium text-[#e2e8f0]">Use presets</div>
                  <div className="text-xs text-[#64748b]">Find high-impact targets</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Comparison Mode Section */}
      {comparisonItems.length > 0 && (
        <div className="border-t border-[#1e2a45] bg-[#0a0f1a]/50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2a45]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              <h3 className="text-xs font-medium text-[#94a3b8] uppercase tracking-wider">
                Compare Mode
              </h3>
              <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded">
                {comparisonItems.length}/4
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearComparison}
              className="h-6 px-2 text-xs text-[#64748b] hover:text-[#ef4444] hover:bg-transparent"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Clear
            </Button>
          </div>
          <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
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
