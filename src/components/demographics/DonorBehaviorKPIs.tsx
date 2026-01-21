import { Users, Repeat, UserPlus, Smartphone, Monitor } from "lucide-react";
import { V3KPICard } from "@/components/v3";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/chart-formatters";

export interface DonorBehaviorTotals {
  unique_donor_count: number;
  transaction_count: number;
  total_revenue: number;
  recurring_count: number;
  recurring_donors: number;
  recurring_revenue: number;
  recurring_percentage: number;
  mobile_donations: number;
  desktop_donations: number;
  mobile_percentage: number;
}

export interface RepeatStats {
  single_donors: number;
  repeat_donors: number;
  repeat_rate: number;
  single_donor_revenue: number;
  repeat_donor_revenue: number;
  new_donors: number;
  new_donor_revenue: number;
}

export interface DonorBehaviorKPIsProps {
  totals: DonorBehaviorTotals;
  repeatStats: RepeatStats;
  className?: string;
}

export function DonorBehaviorKPIs({
  totals,
  repeatStats,
  className,
}: DonorBehaviorKPIsProps) {
  // Calculate average donation
  const avgDonation = totals.transaction_count > 0 
    ? totals.total_revenue / totals.transaction_count 
    : 0;

  return (
    <div className={className}>
      {/* Row 1: Core metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <V3KPICard
          label="Unique Donors"
          value={formatNumber(totals.unique_donor_count)}
          icon={Users}
          accent="blue"
        />
        <V3KPICard
          label="Total Revenue"
          value={formatCurrency(totals.total_revenue)}
          icon={Repeat}
          accent="green"
        />
        <V3KPICard
          label="Avg. Donation"
          value={formatCurrency(avgDonation)}
          accent="purple"
        />
      </div>

      {/* Row 2: Behavior insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Recurring Donors */}
        <V3KPICard
          label="Recurring Donors"
          value={`${totals.recurring_percentage.toFixed(1)}%`}
          sublabel={`${formatNumber(totals.recurring_donors)} of ${formatNumber(totals.unique_donor_count)}`}
          icon={Repeat}
          accent="blue"
          tooltip="Percentage of donors who have made recurring (monthly) donations"
        />
        
        {/* Repeat Donor Rate */}
        <V3KPICard
          label="Repeat Donor Rate"
          value={`${repeatStats.repeat_rate.toFixed(1)}%`}
          sublabel={`${formatNumber(repeatStats.repeat_donors)} repeat donors`}
          icon={UserPlus}
          accent="green"
          tooltip="Percentage of donors who have given 2+ times"
        />
        
        {/* New Donor Revenue */}
        <V3KPICard
          label="New Donor Revenue"
          value={formatCurrency(repeatStats.new_donor_revenue)}
          sublabel={`${formatNumber(repeatStats.new_donors)} new donors`}
          icon={UserPlus}
          accent="purple"
          tooltip="Revenue from first-time donors in this period"
        />
      </div>

      {/* Row 3: Device breakdown (compact) */}
      <div className="mt-4 p-3 rounded-lg bg-[hsl(var(--portal-bg-secondary))] border border-[hsl(var(--portal-border))]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-[hsl(var(--portal-accent-blue))]" />
              <span className="text-sm text-[hsl(var(--portal-text-secondary))]">
                Mobile: <span className="font-medium text-[hsl(var(--portal-text-primary))]">{totals.mobile_percentage.toFixed(1)}%</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
              <span className="text-sm text-[hsl(var(--portal-text-secondary))]">
                Desktop: <span className="font-medium text-[hsl(var(--portal-text-primary))]">{(100 - totals.mobile_percentage).toFixed(1)}%</span>
              </span>
            </div>
          </div>
          <span className="text-xs text-[hsl(var(--portal-text-muted))]">
            {formatNumber(totals.transaction_count)} total donations
          </span>
        </div>
      </div>
    </div>
  );
}

export default DonorBehaviorKPIs;
