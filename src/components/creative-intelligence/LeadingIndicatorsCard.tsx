import { Activity, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { V3Card, V3CardHeader, V3CardTitle, V3CardDescription, V3CardContent } from "@/components/v3/V3Card";
import { V3LoadingState } from "@/components/v3/V3LoadingState";
import type { LeadingIndicators } from "@/hooks/useCreativeIntelligence";

interface LeadingIndicatorsCardProps {
  data: LeadingIndicators | undefined;
  isLoading?: boolean;
}

function CorrelationMeter({ value, label }: { value: number; label: string }) {
  const absValue = Math.abs(value);
  const isPositive = value > 0;
  const isStrong = absValue > 0.5;
  const isModerate = absValue > 0.3;

  const Icon = isStrong || isModerate
    ? (isPositive ? TrendingUp : TrendingDown)
    : Minus;

  const color = isStrong
    ? isPositive
      ? "text-[hsl(var(--portal-success))]"
      : "text-[hsl(var(--portal-error))]"
    : isModerate
    ? "text-[hsl(var(--portal-warning))]"
    : "text-[hsl(var(--portal-text-muted))]";

  const bgColor = isStrong
    ? isPositive
      ? "bg-[hsl(var(--portal-success))]"
      : "bg-[hsl(var(--portal-error))]"
    : isModerate
    ? "bg-[hsl(var(--portal-warning))]"
    : "bg-[hsl(var(--portal-text-muted))]";

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--portal-bg-secondary))]">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${bgColor}/10`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-[hsl(var(--portal-text-muted))]">
            {isStrong ? "Strong" : isModerate ? "Moderate" : "Weak"} correlation
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className={`text-lg font-semibold ${color}`}>
          {value >= 0 ? "+" : ""}{value.toFixed(2)}
        </div>
        <div className="text-xs text-[hsl(var(--portal-text-muted))]">r value</div>
      </div>
    </div>
  );
}

export function LeadingIndicatorsCard({ data, isLoading }: LeadingIndicatorsCardProps) {
  if (isLoading) {
    return (
      <V3Card accent="purple">
        <V3CardHeader>
          <V3CardTitle>Leading Indicators</V3CardTitle>
        </V3CardHeader>
        <V3CardContent>
          <V3LoadingState variant="card" />
        </V3CardContent>
      </V3Card>
    );
  }

  const ctrCorrelation = data?.correlations?.early_ctr_to_roas ?? 0;
  const cpmCorrelation = data?.correlations?.early_cpm_to_roas ?? 0;
  const sampleSize = data?.sample_size ?? 0;

  return (
    <V3Card accent="purple">
      <V3CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-[hsl(var(--portal-accent-purple))]" />
          <V3CardTitle>Leading Indicators</V3CardTitle>
        </div>
        <V3CardDescription>
          Early signals (first 3 days) that predict final ROAS
        </V3CardDescription>
      </V3CardHeader>
      <V3CardContent>
        <div className="space-y-3">
          <CorrelationMeter value={ctrCorrelation} label="Early CTR → ROAS" />
          <CorrelationMeter value={cpmCorrelation} label="Early CPM → ROAS" />
        </div>

        {/* Insight box */}
        <div className="mt-4 p-3 rounded-lg bg-[hsl(var(--portal-accent-purple)/0.05)] border border-[hsl(var(--portal-accent-purple)/0.2)]">
          <div className="text-sm font-medium text-[hsl(var(--portal-accent-purple))] mb-1">
            Insight
          </div>
          <div className="text-sm text-[hsl(var(--portal-text-secondary))]">
            {data?.insight || "Insufficient data for correlation analysis"}
          </div>
          <div className="text-xs text-[hsl(var(--portal-text-muted))] mt-2">
            Based on {sampleSize} creatives with 6+ days of data
          </div>
        </div>
      </V3CardContent>
    </V3Card>
  );
}
