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

  return (
    <div className="grid grid-cols-3 gap-4 py-2 border-b border-[hsl(var(--portal-border))] last:border-b-0">
      <div className={`text-right ${winner === 1 ? "text-[hsl(var(--portal-success))] font-semibold" : ""}`}>
        {formatValue(value1)}
        {winner === 1 && <ArrowUp className="inline h-3 w-3 ml-1" />}
      </div>
      <div className="text-center text-sm text-[hsl(var(--portal-text-muted))]">
        {label}
      </div>
      <div className={`text-left ${winner === 2 ? "text-[hsl(var(--portal-success))] font-semibold" : ""}`}>
        {winner === 2 && <ArrowUp className="inline h-3 w-3 mr-1" />}
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
      <div className="flex-1 min-w-0 p-4 rounded-xl border-2 border-dashed border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-secondary))]">
        <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-[hsl(var(--portal-text-muted))]">
          <Pin className="h-8 w-8 mb-2 opacity-50" />
          <p className="text-sm">Pin a creative to compare</p>
          <p className="text-xs opacity-70 mt-1">Click pin icon in Gallery</p>
        </div>
      </div>
    );
  }

  const isVideo = creative.creative_type?.toLowerCase().includes("video");

  return (
    <div className="flex-1 min-w-0 rounded-xl border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-card))] overflow-hidden">
      {/* Header with remove button */}
      <div className="flex items-center justify-between p-3 border-b border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-secondary))]">
        <span className="text-xs font-medium text-[hsl(var(--portal-text-muted))]">
          Creative {slot + 1}
        </span>
        <button
          onClick={onRemove}
          className="p-1 rounded hover:bg-[hsl(var(--portal-bg-elevated))] transition-colors"
        >
          <X className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
        </button>
      </div>

      {/* Thumbnail */}
      <div className="relative aspect-video bg-[hsl(var(--portal-bg-secondary))]">
        {creative.thumbnail_url ? (
          <img
            src={creative.thumbnail_url}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {isVideo ? (
              <Video className="h-8 w-8 text-[hsl(var(--portal-text-muted))]" />
            ) : (
              <ImageIcon className="h-8 w-8 text-[hsl(var(--portal-text-muted))]" />
            )}
          </div>
        )}
      </div>

      {/* Creative info */}
      <div className="p-4">
        <h4 className="font-medium text-sm text-[hsl(var(--portal-text-primary))] line-clamp-2 mb-2">
          {creative.headline || creative.issue_primary || "Untitled Creative"}
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
    <V3Card>
      <V3CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pin className="h-5 w-5 text-[hsl(var(--portal-accent-blue))]" />
            <V3CardTitle>Creative Comparison</V3CardTitle>
          </div>
          <V3Button variant="ghost" size="sm" onClick={onClear}>
            Clear All
          </V3Button>
        </div>
      </V3CardHeader>
      <V3CardContent>
        {/* Creative slots */}
        <div className="flex gap-4 mb-6">
          <CreativeSlot creative={creative1} slot={0} onRemove={() => onRemove(0)} />
          <CreativeSlot creative={creative2} slot={1} onRemove={() => onRemove(1)} />
        </div>

        {/* Comparison metrics */}
        {hasBoth && (
          <div className="rounded-xl border border-[hsl(var(--portal-border))] p-4">
            <h4 className="text-sm font-medium text-[hsl(var(--portal-text-primary))] mb-4 text-center">
              Performance Comparison
            </h4>
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
        )}

        {!hasBoth && (
          <div className="text-center text-sm text-[hsl(var(--portal-text-muted))] py-4">
            Pin another creative to see the comparison
          </div>
        )}
      </V3CardContent>
    </V3Card>
  );
}
