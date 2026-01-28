import { Users, Repeat, UserPlus, Smartphone, Monitor, DollarSign, TrendingUp } from "lucide-react";
import { V3KPICard } from "@/components/v3";
import { formatCurrency, formatNumber } from "@/lib/chart-formatters";

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
  // Safely access values with defaults
  const safeTransactionCount = totals?.transaction_count ?? 0;
  const safeTotalRevenue = totals?.total_revenue ?? 0;
  const safeUniqueDonorCount = totals?.unique_donor_count ?? 0;
  const safeRecurringPercentage = totals?.recurring_percentage ?? 0;
  const safeRecurringDonors = totals?.recurring_donors ?? 0;
  const safeMobilePercentage = totals?.mobile_percentage ?? 0;
  
  const safeRepeatRate = repeatStats?.repeat_rate ?? 0;
  const safeRepeatDonors = repeatStats?.repeat_donors ?? 0;
  const safeNewDonorRevenue = repeatStats?.new_donor_revenue ?? 0;
  const safeNewDonors = repeatStats?.new_donors ?? 0;

  // Calculate average donation
  const avgDonation = safeTransactionCount > 0 
    ? safeTotalRevenue / safeTransactionCount 
    : 0;

  return (
    <div className={className}>
      {/* Row 1: Core metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <V3KPICard
          label="Unique Donors"
          value={formatNumber(safeUniqueDonorCount)}
          icon={Users}
          accent="blue"
        />
        <V3KPICard
          label="Total Revenue"
          value={formatCurrency(safeTotalRevenue)}
          icon={DollarSign}
          accent="green"
        />
        <V3KPICard
          label="Avg. Donation"
          value={formatCurrency(avgDonation)}
          icon={TrendingUp}
          accent="purple"
        />
      </div>

      {/* Row 2: Behavior insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Recurring Donors */}
        <V3KPICard
          label="Recurring Donors"
          value={`${safeRecurringPercentage.toFixed(1)}%`}
          subtitle={`${formatNumber(safeRecurringDonors)} of ${formatNumber(safeUniqueDonorCount)}`}
          icon={Repeat}
          accent="blue"
        />
        
        {/* Repeat Donor Rate */}
        <V3KPICard
          label="Repeat Donor Rate"
          value={`${safeRepeatRate.toFixed(1)}%`}
          subtitle={`${formatNumber(safeRepeatDonors)} repeat donors`}
          icon={UserPlus}
          accent="green"
        />
        
        {/* New Donor Revenue */}
        <V3KPICard
          label="New Donor Revenue"
          value={formatCurrency(safeNewDonorRevenue)}
          subtitle={`${formatNumber(safeNewDonors)} new donors`}
          icon={Users}
          accent="purple"
        />
      </div>

      {/* Row 3: Device breakdown (compact) */}
      <div className="mt-4 p-3 rounded-lg bg-[hsl(var(--portal-bg-secondary))] border border-[hsl(var(--portal-border))]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-[hsl(var(--portal-accent-blue))]" />
              <span className="text-sm text-[hsl(var(--portal-text-secondary))]">
                Mobile: <span className="font-medium text-[hsl(var(--portal-text-primary))]">{safeMobilePercentage.toFixed(1)}%</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
              <span className="text-sm text-[hsl(var(--portal-text-secondary))]">
                Desktop: <span className="font-medium text-[hsl(var(--portal-text-primary))]">{(100 - safeMobilePercentage).toFixed(1)}%</span>
              </span>
            </div>
          </div>
          <span className="text-xs text-[hsl(var(--portal-text-muted))]">
            {formatNumber(safeTransactionCount)} total donations
          </span>
        </div>
      </div>
    </div>
  );
}

export default DonorBehaviorKPIs;
