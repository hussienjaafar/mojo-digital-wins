import { Users, UserPlus, DollarSign, TrendingUp } from "lucide-react";
import { V3Card, V3CardHeader, V3CardTitle, V3CardDescription, V3CardContent } from "@/components/v3/V3Card";
import { V3LoadingState } from "@/components/v3/V3LoadingState";
import type { DonorSegmentation } from "@/hooks/useCreativeIntelligence";

interface DonorSegmentationCardProps {
  data: DonorSegmentation | undefined | null;
  isLoading?: boolean;
}

interface SegmentRowProps {
  label: string;
  count: number;
  amount: number;
  percentage: number;
  variant: "small" | "large";
}

function SegmentRow({ label, count, amount, percentage, variant }: SegmentRowProps) {
  const bgColor = variant === "small"
    ? "bg-[hsl(var(--portal-accent-blue)/0.1)]"
    : "bg-[hsl(var(--portal-accent-purple)/0.1)]";
  const textColor = variant === "small"
    ? "text-[hsl(var(--portal-accent-blue))]"
    : "text-[hsl(var(--portal-accent-purple))]";
  const barColor = variant === "small"
    ? "bg-[hsl(var(--portal-accent-blue))]"
    : "bg-[hsl(var(--portal-accent-purple))]";

  return (
    <div className="p-4 rounded-lg bg-[hsl(var(--portal-bg-secondary))]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${bgColor}`}>
            {variant === "small" ? (
              <Users className={`h-4 w-4 ${textColor}`} />
            ) : (
              <UserPlus className={`h-4 w-4 ${textColor}`} />
            )}
          </div>
          <div>
            <div className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
              {label}
            </div>
            <div className="text-xs text-[hsl(var(--portal-text-muted))]">
              {variant === "small" ? "< $200 lifetime" : ">= $200 lifetime"}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold text-[hsl(var(--portal-text-primary))]">
            {count.toLocaleString()}
          </div>
          <div className="text-xs text-[hsl(var(--portal-text-muted))]">donors</div>
        </div>
      </div>

      {/* Amount and percentage bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[hsl(var(--portal-text-secondary))]">
            Total: ${amount.toLocaleString()}
          </span>
          <span className={`font-medium ${textColor}`}>
            {percentage.toFixed(1)}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-[hsl(var(--portal-bg-elevated))]">
          <div
            className={`h-2 rounded-full ${barColor} transition-all duration-500`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function DonorSegmentationCard({ data, isLoading }: DonorSegmentationCardProps) {
  if (isLoading) {
    return (
      <V3Card accent="blue">
        <V3CardHeader>
          <V3CardTitle>Donor Segmentation</V3CardTitle>
        </V3CardHeader>
        <V3CardContent>
          <V3LoadingState variant="card" />
        </V3CardContent>
      </V3Card>
    );
  }

  if (!data) {
    return (
      <V3Card accent="blue">
        <V3CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[hsl(var(--portal-accent-blue))]" />
            <V3CardTitle>Donor Segmentation</V3CardTitle>
          </div>
          <V3CardDescription>
            Breakdown of small vs large donors
          </V3CardDescription>
        </V3CardHeader>
        <V3CardContent>
          <div className="p-4 text-center text-[hsl(var(--portal-text-muted))] text-sm">
            No donor data available for this date range
          </div>
        </V3CardContent>
      </V3Card>
    );
  }

  return (
    <V3Card accent="blue">
      <V3CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-[hsl(var(--portal-accent-blue))]" />
          <V3CardTitle>Donor Segmentation</V3CardTitle>
        </div>
        <V3CardDescription>
          FEC-compliant breakdown of small (&lt;$200) vs large donors
        </V3CardDescription>
      </V3CardHeader>
      <V3CardContent>
        <div className="space-y-4">
          {/* Segment rows */}
          <SegmentRow
            label="Small Donors"
            count={data.small_donors.count}
            amount={data.small_donors.total_amount}
            percentage={data.small_donors.percentage_of_total}
            variant="small"
          />
          <SegmentRow
            label="Large Donors"
            count={data.large_donors.count}
            amount={data.large_donors.total_amount}
            percentage={data.large_donors.percentage_of_total}
            variant="large"
          />

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-[hsl(var(--portal-border))]">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <DollarSign className="h-3.5 w-3.5 text-[hsl(var(--portal-success))]" />
                <span className="text-xs text-[hsl(var(--portal-text-muted))]">Avg</span>
              </div>
              <div className="text-lg font-semibold text-[hsl(var(--portal-text-primary))]">
                ${data.average_donation.toFixed(0)}
              </div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <TrendingUp className="h-3.5 w-3.5 text-[hsl(var(--portal-accent-purple))]" />
                <span className="text-xs text-[hsl(var(--portal-text-muted))]">Median</span>
              </div>
              <div className="text-lg font-semibold text-[hsl(var(--portal-text-primary))]">
                ${data.median_donation.toFixed(0)}
              </div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Users className="h-3.5 w-3.5 text-[hsl(var(--portal-accent-blue))]" />
                <span className="text-xs text-[hsl(var(--portal-text-muted))]">Total</span>
              </div>
              <div className="text-lg font-semibold text-[hsl(var(--portal-text-primary))]">
                {data.total_donors.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Total donations footnote */}
          <div className="text-center text-xs text-[hsl(var(--portal-text-muted))] pt-2">
            {data.total_donations.toLocaleString()} total donations
          </div>
        </div>
      </V3CardContent>
    </V3Card>
  );
}
