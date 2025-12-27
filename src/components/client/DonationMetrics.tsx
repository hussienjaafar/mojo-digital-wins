import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  V3Card,
  V3CardContent,
  V3CardHeader,
  V3CardTitle,
  V3KPICard,
  V3ChartWrapper,
  V3LoadingState,
  V3ErrorState,
  V3EmptyState,
} from "@/components/v3";
import { PortalBadge } from "@/components/portal/PortalBadge";
import { Input } from "@/components/ui/input";
import { Search, DollarSign, Users, Repeat, TrendingUp, PieChart, BarChart3, Filter, ShieldAlert, Heart, UserPlus, Receipt } from "lucide-react";
import { format, parseISO } from "date-fns";
import { PortalTable, PortalTableRenderers } from "@/components/portal/PortalTable";
import { NoResultsEmptyState } from "@/components/portal/PortalEmptyState";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PortalLineChart } from "@/components/portal/PortalLineChart";
import { PortalMultiBarChart } from "@/components/portal/PortalMultiBarChart";
import { PortalPieChart } from "@/components/portal/PortalPieChart";
import { usePIIAccess } from "@/hooks/usePIIAccess";
import { maskDonorInfo } from "@/lib/pii-masking";
import { useDonationMetricsQuery } from "@/queries";
import { formatCurrency } from "@/lib/chart-formatters";

type Props = {
  organizationId: string;
  startDate: string;
  endDate: string;
};

const CHART_COLORS = [
  "hsl(var(--portal-accent-blue))",
  "hsl(var(--portal-success))",
  "hsl(var(--portal-accent-purple))",
  "hsl(var(--portal-warning))",
  "hsl(var(--portal-error))",
  "hsl(var(--portal-text-muted))",
];

// Animation variants for staggered KPI cards
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

const DonationMetrics = ({ organizationId, startDate, endDate }: Props) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [amountFilter, setAmountFilter] = useState<string>("all");

  // PII access control - masks donor names/emails for users without PII access
  const { shouldMaskPII, isLoading: piiLoading } = usePIIAccess(organizationId);

  // Use TanStack Query hook instead of direct Supabase calls
  const { data, isLoading, error, refetch } = useDonationMetricsQuery(organizationId);

  // Extract data from query result
  const metrics = data?.metrics;
  const timeSeries = data?.timeSeries || [];
  const bySource = data?.bySource || [];
  const topDonors = data?.topDonors || [];

  // Prepare chart data
  const trendChartData = useMemo(() => timeSeries.map(d => ({
    name: format(parseISO(d.date), 'MMM d'),
    Amount: d.amount,
    Donations: d.donations,
  })), [timeSeries]);

  // Attribution pie chart data
  const attributionData = useMemo(() => bySource.slice(0, 6).map(s => ({
    name: s.source.length > 15 ? s.source.slice(0, 15) + '...' : s.source,
    fullName: s.source,
    value: s.amount,
    count: s.count,
  })), [bySource]);

  // Gift size distribution (derived from metrics)
  const giftSizeData = useMemo(() => {
    if (!metrics) return [];
    // Since we don't have raw transactions, we'll show a simplified view
    return [
      { name: 'One-time', count: metrics.oneTimeCount, amount: metrics.oneTimeRevenue },
      { name: 'Recurring', count: metrics.recurringCount, amount: metrics.recurringRevenue },
    ];
  }, [metrics]);

  // Masked top donors for display
  const maskedTopDonors = useMemo(() => {
    if (!shouldMaskPII) return topDonors;
    return topDonors.map(d => ({
      ...d,
      email: '***@***.***',
    }));
  }, [topDonors, shouldMaskPII]);

  // PII masking indicator component
  const PIIMaskingIndicator = () => shouldMaskPII ? (
    <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--portal-text-muted))] bg-[hsl(var(--portal-bg-elevated))] px-2 py-1 rounded border border-[hsl(var(--portal-border))]">
      <ShieldAlert className="h-3 w-3" aria-hidden="true" />
      <span>Donor PII masked</span>
    </div>
  ) : null;

  // Show loading state
  if (isLoading || piiLoading) {
    return (
      <div className="space-y-6">
        <V3LoadingState variant="kpi-grid" count={4} />
        <V3LoadingState variant="kpi-grid" count={4} />
        <V3LoadingState variant="chart" height={280} />
        <V3LoadingState variant="table" />
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <V3ErrorState
        title="Failed to load donation data"
        message={error instanceof Error ? error.message : 'An error occurred'}
        onRetry={() => refetch()}
      />
    );
  }

  // Show empty state if no data
  if (!metrics || metrics.totalDonations === 0) {
    return (
      <V3EmptyState
        icon={DollarSign}
        title="No donations found"
        description="Transactions will appear here once donations are received through ActBlue."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Primary KPIs */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants}>
          <V3KPICard
            icon={DollarSign}
            label="Total Raised"
            value={formatCurrency(metrics.totalRaised, true)}
            accent="green"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <V3KPICard
            icon={Users}
            label="Unique Donors"
            value={metrics.uniqueDonors.toLocaleString()}
            accent="blue"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <V3KPICard
            icon={TrendingUp}
            label="Avg Donation"
            value={`$${metrics.averageDonation.toFixed(2)}`}
            accent="purple"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <V3KPICard
            icon={Repeat}
            label="Recurring"
            value={`${metrics.totalDonations > 0 ? ((metrics.recurringCount / metrics.totalDonations) * 100).toFixed(0) : 0}%`}
            subtitle={`${metrics.recurringCount} sustainers`}
            accent="amber"
          />
        </motion.div>
      </motion.div>

      {/* Secondary KPIs */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants}>
          <V3KPICard
            icon={DollarSign}
            label="Net Revenue"
            value={formatCurrency(metrics.netRaised, true)}
            accent="green"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <V3KPICard
            icon={Receipt}
            label="Total Donations"
            value={metrics.totalDonations.toLocaleString()}
            accent="default"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <V3KPICard
            icon={Repeat}
            label="Recurring Revenue"
            value={formatCurrency(metrics.recurringRevenue, true)}
            accent="blue"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <V3KPICard
            icon={TrendingUp}
            label="Refunds"
            value={formatCurrency(metrics.refundAmount, true)}
            subtitle={`${metrics.refundCount} refunds`}
            accent={metrics.refundAmount > 0 ? "red" : "default"}
          />
        </motion.div>
      </motion.div>

      {/* Donation Trend Chart */}
      {trendChartData.length > 0 && (
        <V3ChartWrapper
          title="Donation Trend"
          icon={TrendingUp}
          ariaLabel="Donation trend chart showing daily amounts and counts over time"
          description="Line chart displaying daily donation amounts and transaction counts"
          accent="green"
        >
          <PortalLineChart
            data={trendChartData}
            lines={[
              { dataKey: "Amount", name: "Amount", stroke: "hsl(var(--portal-success))", valueType: "currency" },
              { dataKey: "Donations", name: "Donations", stroke: "hsl(var(--portal-accent-blue))", valueType: "number" },
            ]}
            valueType="currency"
            ariaLabel="Donation trend showing daily amounts and transaction counts over time"
          />
        </V3ChartWrapper>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attribution Chart */}
        {attributionData.length > 0 && (
          <V3ChartWrapper
            title="Attribution by Source"
            icon={PieChart}
            ariaLabel="Pie chart showing donation attribution by source"
            description="Distribution of donations by refcode and source campaign"
            accent="blue"
          >
            <PortalPieChart
              data={attributionData}
              colors={CHART_COLORS}
              valueType="currency"
              ariaLabel="Attribution breakdown by source showing donation amounts"
            />
          </V3ChartWrapper>
        )}

        {/* Gift Size Distribution */}
        {giftSizeData.length > 0 && (
          <V3ChartWrapper
            title="Donation Type Breakdown"
            icon={BarChart3}
            ariaLabel="Bar chart showing donation type breakdown"
            description="Comparison of one-time vs recurring donations"
            accent="purple"
          >
            <PortalMultiBarChart
              data={giftSizeData}
              bars={[
                { dataKey: "amount", name: "Amount", fill: "hsl(var(--portal-success))", valueType: "currency" },
                { dataKey: "count", name: "Count", fill: "hsl(var(--portal-accent-blue))", valueType: "number" },
              ]}
              valueType="currency"
              ariaLabel="Donation type breakdown showing one-time vs recurring"
            />
          </V3ChartWrapper>
        )}
      </div>

      {/* Top Donors Table */}
      <V3Card accent="green">
        <V3CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <V3CardTitle>Top Donors</V3CardTitle>
            <PIIMaskingIndicator />
          </div>
        </V3CardHeader>
        <V3CardContent>
          <PortalTable
            data={maskedTopDonors}
            keyExtractor={(row) => row.email}
            columns={[
              {
                key: "email",
                label: "Donor",
                sortable: true,
                render: (value) => (
                  <span className="font-medium text-[hsl(var(--portal-text-primary))]">
                    {value}
                  </span>
                ),
              },
              {
                key: "totalAmount",
                label: "Total",
                sortable: true,
                className: "text-right",
                render: PortalTableRenderers.currency,
              },
              {
                key: "donationCount",
                label: "Donations",
                sortable: true,
                className: "text-right",
                render: PortalTableRenderers.number,
              },
            ]}
            emptyMessage="No donor data available"
          />
        </V3CardContent>
      </V3Card>
    </div>
  );
};

export default DonationMetrics;
