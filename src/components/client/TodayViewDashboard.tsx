import React from "react";
import { format, parseISO } from "date-fns";
import { 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Users, 
  DollarSign, 
  Repeat,
  Activity
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { V3Card, V3SectionHeader, V3LoadingState } from "@/components/v3";
import { HourlyBreakdownChart } from "./HourlyBreakdownChart";
import { RecentActivityFeed } from "./RecentActivityFeed";
import { 
  useTodayMetrics, 
  useIsTodayView,
  calculatePercentChange,
  type TodayMetricsData,
  type ComparisonMetrics 
} from "@/hooks/useHourlyMetrics";
import { useDateRange } from "@/stores/dashboardStore";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/chart-formatters";

// ============================================================================
// Types
// ============================================================================

interface TodayViewDashboardProps {
  organizationId: string;
  className?: string;
}

interface ComparisonKpiProps {
  label: string;
  value: number;
  format: "currency" | "number" | "percent";
  comparisonValue?: number | null;
  comparisonLabel?: string;
  icon: React.ElementType;
  accent: "blue" | "green" | "purple" | "amber";
}

// ============================================================================
// Animation Variants
// ============================================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

// ============================================================================
// ComparisonKpi Component
// ============================================================================

const ComparisonKpi: React.FC<ComparisonKpiProps> = ({
  label,
  value,
  format: formatType,
  comparisonValue,
  comparisonLabel = "vs yesterday",
  icon: Icon,
  accent,
}) => {
  const percentChange = comparisonValue != null 
    ? calculatePercentChange(value, comparisonValue) 
    : null;

  const formattedValue = formatType === "currency" 
    ? formatCurrency(value, false)
    : formatType === "percent"
    ? formatPercent(value, 1)
    : formatNumber(value, false);

  const accentColors = {
    blue: "bg-[hsl(var(--portal-accent-blue)/0.1)] text-[hsl(var(--portal-accent-blue))]",
    green: "bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))]",
    purple: "bg-[hsl(var(--portal-accent-purple)/0.1)] text-[hsl(var(--portal-accent-purple))]",
    amber: "bg-[hsl(var(--portal-warning)/0.1)] text-[hsl(var(--portal-warning))]",
  };

  return (
    <motion.div variants={itemVariants}>
      <V3Card className="p-4 h-full">
        <div className="flex items-start justify-between mb-2">
          <div className={cn("p-2 rounded-lg", accentColors[accent])}>
            <Icon className="h-4 w-4" />
          </div>
          {percentChange !== null && (
            <div className={cn(
              "flex items-center gap-1 text-xs font-medium",
              percentChange > 0 
                ? "text-[hsl(var(--portal-success))]" 
                : percentChange < 0 
                ? "text-[hsl(var(--portal-error))]"
                : "text-[hsl(var(--portal-text-muted))]"
            )}>
              {percentChange > 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : percentChange < 0 ? (
                <TrendingDown className="h-3 w-3" />
              ) : (
                <Minus className="h-3 w-3" />
              )}
              <span>{percentChange > 0 ? "+" : ""}{percentChange.toFixed(1)}%</span>
            </div>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">
            {formattedValue}
          </p>
          <p className="text-xs text-[hsl(var(--portal-text-muted))]">{label}</p>
          {comparisonValue != null && (
            <p className="text-xs text-[hsl(var(--portal-text-secondary))]">
              {comparisonLabel}
            </p>
          )}
        </div>
      </V3Card>
    </motion.div>
  );
};

// ============================================================================
// TodayViewDashboard Component
// ============================================================================

export const TodayViewDashboard: React.FC<TodayViewDashboardProps> = ({
  organizationId,
  className,
}) => {
  const { data, isLoading, error } = useTodayMetrics(organizationId);
  const isTodayView = useIsTodayView();
  const dateRange = useDateRange();

  // Format the selected date for display
  const selectedDate = parseISO(dateRange.startDate);
  const currentTimeLabel = isTodayView 
    ? `as of ${format(new Date(), "h:mm a")}`
    : format(selectedDate, "EEEE, MMMM d, yyyy");
  
  // Comparison label changes based on whether we're viewing today or a historical date
  const comparisonLabel = isTodayView ? "vs yesterday" : "vs day before";
  if (isLoading) {
    return (
      <div className={cn("space-y-6", className)}>
        <V3LoadingState variant="kpi-grid" />
        <V3LoadingState variant="chart" height={300} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <V3Card className={cn("p-8 text-center", className)}>
        <p className="text-[hsl(var(--portal-text-muted))]">
          Unable to load today's metrics. Please try again.
        </p>
      </V3Card>
    );
  }

  const { hourlyMetrics, comparisonMetrics, recentDonations, currentHour } = data;
  const today = comparisonMetrics.today;
  const yesterday = comparisonMetrics.yesterday;

  // Calculate recurring percentage
  const recurringPercent = today && today.donation_count > 0
    ? (today.recurring_count / today.donation_count) * 100
    : 0;

  const yesterdayRecurringPercent = yesterday && yesterday.donation_count > 0
    ? (yesterday.recurring_count / yesterday.donation_count) * 100
    : 0;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={cn("space-y-6", className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <V3SectionHeader
          title={isTodayView ? "Today's Performance" : "Daily Performance"}
          subtitle={currentTimeLabel}
          icon={Clock}
        />
        {isTodayView && (
          <div className="flex items-center gap-2 text-xs text-[hsl(var(--portal-text-muted))]">
            <Activity className="h-3 w-3 animate-pulse text-[hsl(var(--portal-success))]" />
            <span>Live updates</span>
          </div>
        )}
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ComparisonKpi
          label="Total Raised"
          value={today?.gross_amount ?? 0}
          format="currency"
          comparisonValue={yesterday?.gross_amount}
          comparisonLabel={comparisonLabel}
          icon={DollarSign}
          accent="blue"
        />
        <ComparisonKpi
          label="Donations"
          value={today?.donation_count ?? 0}
          format="number"
          comparisonValue={yesterday?.donation_count}
          comparisonLabel={comparisonLabel}
          icon={TrendingUp}
          accent="green"
        />
        <ComparisonKpi
          label="Unique Donors"
          value={today?.unique_donors ?? 0}
          format="number"
          comparisonValue={yesterday?.unique_donors}
          comparisonLabel={comparisonLabel}
          icon={Users}
          accent="purple"
        />
        <ComparisonKpi
          label="Recurring Rate"
          value={recurringPercent}
          format="percent"
          comparisonValue={yesterdayRecurringPercent}
          comparisonLabel={comparisonLabel}
          icon={Repeat}
          accent="amber"
        />
      </div>

      {/* Hourly Chart */}
      <motion.div variants={itemVariants}>
        <V3Card className="p-4 sm:p-6">
          <h3 className="text-sm font-medium text-[hsl(var(--portal-text-secondary))] mb-4">
            Hourly Breakdown
          </h3>
          <HourlyBreakdownChart 
            data={hourlyMetrics} 
            currentHour={currentHour}
            isLive={isTodayView}
          />
        </V3Card>
      </motion.div>

      {/* Bottom Row: Recent Activity + Last Week Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity Feed */}
        <motion.div variants={itemVariants}>
          <RecentActivityFeed 
            donations={recentDonations} 
            isLive={isTodayView}
          />
        </motion.div>

        {/* Week-over-Week Comparison */}
        <motion.div variants={itemVariants}>
          <V3Card className="p-4 sm:p-6">
            <h3 className="text-sm font-medium text-[hsl(var(--portal-text-secondary))] mb-4">
              {isTodayView ? "Same Day Last Week" : "Same Weekday Last Week"}
            </h3>
            <div className="space-y-4">
              <ComparisonRow
                label="Total Raised"
                current={today?.gross_amount ?? 0}
                previous={comparisonMetrics.lastWeek?.gross_amount ?? 0}
                format="currency"
              />
              <ComparisonRow
                label="Donations"
                current={today?.donation_count ?? 0}
                previous={comparisonMetrics.lastWeek?.donation_count ?? 0}
                format="number"
              />
              <ComparisonRow
                label="Unique Donors"
                current={today?.unique_donors ?? 0}
                previous={comparisonMetrics.lastWeek?.unique_donors ?? 0}
                format="number"
              />
              <ComparisonRow
                label="Avg. Gift"
                current={today?.avg_donation ?? 0}
                previous={comparisonMetrics.lastWeek?.avg_donation ?? 0}
                format="currency"
              />
            </div>
          </V3Card>
        </motion.div>
      </div>
    </motion.div>
  );
};

// ============================================================================
// ComparisonRow Component
// ============================================================================

interface ComparisonRowProps {
  label: string;
  current: number;
  previous: number;
  format: "currency" | "number" | "percent";
}

const ComparisonRow: React.FC<ComparisonRowProps> = ({
  label,
  current,
  previous,
  format: formatType,
}) => {
  const percentChange = calculatePercentChange(current, previous);
  
  const formatValue = (val: number) => {
    if (formatType === "currency") return formatCurrency(val, false);
    if (formatType === "percent") return formatPercent(val, 1);
    return formatNumber(val, false);
  };

  return (
    <div className="flex items-center justify-between py-2 border-b border-[hsl(var(--portal-border))] last:border-0">
      <span className="text-sm text-[hsl(var(--portal-text-muted))]">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
          {formatValue(current)}
        </span>
        <span className="text-xs text-[hsl(var(--portal-text-muted))]">
          vs {formatValue(previous)}
        </span>
        {percentChange !== null && (
          <span className={cn(
            "text-xs font-medium",
            percentChange > 0 
              ? "text-[hsl(var(--portal-success))]" 
              : percentChange < 0 
              ? "text-[hsl(var(--portal-error))]"
              : "text-[hsl(var(--portal-text-muted))]"
          )}>
            {percentChange > 0 ? "+" : ""}{percentChange.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
};

export default TodayViewDashboard;
