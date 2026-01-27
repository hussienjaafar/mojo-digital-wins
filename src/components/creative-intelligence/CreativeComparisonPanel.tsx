import { X, Pin, Video, Image as ImageIcon, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { V3Card, V3CardHeader, V3CardTitle, V3CardContent } from "@/components/v3/V3Card";
import { V3Button } from "@/components/v3";
import type { CreativeRecommendation } from "@/hooks/useCreativeIntelligence";

interface CreativeComparisonPanelProps {
  pinnedCreatives: [CreativeRecommendation | null, CreativeRecommendation | null];
  onRemove: (slot: 0 | 1) => void;
  onClear: () => void;
}

function ComparisonMetric({
  label,
  value1,
  value2,
  format = "number",
  higherIsBetter = true,
}: {
  label: string;
  value1: number | null | undefined;
  value2: number | null | undefined;
  format?: "number" | "currency" | "percent" | "roas";
  higherIsBetter?: boolean;
}) {
  const formatValue = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "—";
    switch (format) {
      case "currency":
        return `$${value.toLocaleString()}`;
      case "percent":
        return `${(value * 100).toFixed(2)}%`;
      case "roas":
        return `${value.toFixed(2)}x`;
      default:
        return value.toLocaleString();
    }
  };

  const v1 = value1 ?? 0;
  const v2 = value2 ?? 0;
  const diff = v1 - v2;
  const winner = diff === 0 ? null : (diff > 0 ? (higherIsBetter ? 1 : 2) : (higherIsBetter ? 2 : 1));

  const getWinnerDescription = () => {
    if (winner === 1) return "Creative 1 performs better";
    if (winner === 2) return "Creative 2 performs better";
    return "Both creatives perform equally";
  };

  return (
    <div
      className="grid grid-cols-3 gap-4 py-2 border-b border-[hsl(var(--portal-border))] last:border-b-0"
      role="row"
      aria-label={`${label} comparison: Creative 1 ${formatValue(value1)}, Creative 2 ${formatValue(value2)}. ${getWinnerDescription()}`}
    >
      <div
        className={`text-right ${winner === 1 ? "text-[hsl(var(--portal-success))] font-semibold" : ""}`}
        role="cell"
      >
        {formatValue(value1)}
        {winner === 1 && <ArrowUp className="inline h-3 w-3 ml-1" aria-hidden="true" />}
        {winner === 1 && <span className="sr-only">(better)</span>}
      </div>
      <div className="text-center text-sm text-[hsl(var(--portal-text-muted))]" role="rowheader">
        {label}
      </div>
      <div
        className={`text-left ${winner === 2 ? "text-[hsl(var(--portal-success))] font-semibold" : ""}`}
        role="cell"
      >
        {winner === 2 && <ArrowUp className="inline h-3 w-3 mr-1" aria-hidden="true" />}
        {winner === 2 && <span className="sr-only">(better)</span>}
        {formatValue(value2)}
      </div>
    </div>
  );
}

function CreativeSlot({
  creative,
  slot,
  onRemove,
}: {
  creative: CreativeRecommendation | null;
  slot: 0 | 1;
  onRemove: () => void;
}) {
  if (!creative) {
    return (
      <div
        className="flex-1 min-w-0 p-4 rounded-xl border-2 border-dashed border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-secondary))]"
        role="region"
        aria-label={`Comparison slot ${slot + 1} - empty`}
      >
        <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-[hsl(var(--portal-text-muted))]">
          <Pin className="h-8 w-8 mb-2 opacity-50" aria-hidden="true" />
          <p className="text-sm">Pin a creative to compare</p>
          <p className="text-xs opacity-70 mt-1">Click pin icon in Gallery</p>
        </div>
      </div>
    );
  }

  const isVideo = creative.creative_type?.toLowerCase().includes("video");
  const creativeTitle = creative.headline || creative.issue_primary || "Untitled Creative";

  return (
    <div
      className="flex-1 min-w-0 rounded-xl border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-card))] overflow-hidden"
      role="region"
      aria-label={`Comparison slot ${slot + 1}: ${creativeTitle}`}
    >
      {/* Header with remove button */}
      <div className="flex items-center justify-between p-3 border-b border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-secondary))]">
        <span className="text-xs font-medium text-[hsl(var(--portal-text-muted))]">
          Creative {slot + 1}
        </span>
        <button
          onClick={onRemove}
          aria-label={`Remove ${creativeTitle} from comparison`}
          className="p-1 rounded hover:bg-[hsl(var(--portal-bg-elevated))] transition-colors"
        >
          <X className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" aria-hidden="true" />
        </button>
      </div>

      {/* Thumbnail */}
      <div className="relative aspect-video bg-[hsl(var(--portal-bg-secondary))]">
        {creative.thumbnail_url ? (
          <img
            src={creative.thumbnail_url}
            alt={`Thumbnail for ${creativeTitle}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" aria-label={`No thumbnail available for ${isVideo ? "video" : "image"} creative`}>
            {isVideo ? (
              <Video className="h-8 w-8 text-[hsl(var(--portal-text-muted))]" aria-hidden="true" />
            ) : (
              <ImageIcon className="h-8 w-8 text-[hsl(var(--portal-text-muted))]" aria-hidden="true" />
            )}
          </div>
        )}
      </div>

      {/* Creative info */}
      <div className="p-4">
        <h4 className="font-medium text-sm text-[hsl(var(--portal-text-primary))] line-clamp-2 mb-2">
          {creativeTitle}
        </h4>
        {creative.issue_primary && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-[hsl(var(--portal-accent-purple)/0.1)] text-[hsl(var(--portal-accent-purple))]">
            {creative.issue_primary}
          </span>
        )}
      </div>
    </div>
  );
}

export function CreativeComparisonPanel({
  pinnedCreatives,
  onRemove,
  onClear,
}: CreativeComparisonPanelProps) {
  const [creative1, creative2] = pinnedCreatives;
  const hasBoth = creative1 && creative2;
  const hasAny = creative1 || creative2;

  if (!hasAny) {
    return null;
  }

  return (
    <V3Card role="region" aria-label="Creative comparison panel">
      <V3CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pin className="h-5 w-5 text-[hsl(var(--portal-accent-blue))]" aria-hidden="true" />
            <V3CardTitle>Creative Comparison</V3CardTitle>
          </div>
          <V3Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            aria-label="Clear all pinned creatives from comparison"
          >
            Clear All
          </V3Button>
        </div>
      </V3CardHeader>
      <V3CardContent>
        {/* Creative slots */}
        <div className="flex gap-4 mb-6" role="group" aria-label="Pinned creatives for comparison">
          <CreativeSlot creative={creative1} slot={0} onRemove={() => onRemove(0)} />
          <CreativeSlot creative={creative2} slot={1} onRemove={() => onRemove(1)} />
        </div>

        {/* Comparison metrics */}
        {hasBoth && (
          <div
            className="rounded-xl border border-[hsl(var(--portal-border))] p-4"
            role="table"
            aria-label="Performance metrics comparison between two creatives"
          >
            <h4 className="text-sm font-medium text-[hsl(var(--portal-text-primary))] mb-4 text-center" id="comparison-heading">
              Performance Comparison
            </h4>
            <div role="rowgroup" aria-labelledby="comparison-heading">
              <ComparisonMetric
                label="ROAS"
                value1={creative1.roas}
                value2={creative2.roas}
                format="roas"
                higherIsBetter={true}
              />
              <ComparisonMetric
                label="CTR"
                value1={creative1.ctr}
                value2={creative2.ctr}
                format="percent"
                higherIsBetter={true}
              />
              <ComparisonMetric
                label="Revenue"
                value1={creative1.total_revenue}
                value2={creative2.total_revenue}
                format="currency"
                higherIsBetter={true}
              />
              <ComparisonMetric
                label="Spend"
                value1={creative1.total_spend}
                value2={creative2.total_spend}
                format="currency"
                higherIsBetter={false}
              />
              <ComparisonMetric
                label="Impressions"
                value1={creative1.total_impressions}
                value2={creative2.total_impressions}
                format="number"
                higherIsBetter={true}
              />
              <ComparisonMetric
                label="Confidence"
                value1={creative1.confidence_score}
                value2={creative2.confidence_score}
                format="number"
                higherIsBetter={true}
              />
            </div>
          </div>
        )}

        {!hasBoth && (
          <div
            className="text-center text-sm text-[hsl(var(--portal-text-muted))] py-4"
            role="status"
            aria-live="polite"
          >
            Pin another creative to see the comparison
          </div>
        )}
      </V3CardContent>
    </V3Card>
  );
}
