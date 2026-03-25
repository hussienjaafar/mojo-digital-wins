import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import {
  V3Card,
  V3CardContent,
  V3CardHeader,
  V3CardTitle,
  V3ChartWrapper,
  V3LoadingState,
  V3ErrorState,
  V3EmptyState,
  V3DataTable,
  V3InsightBadge,
} from "@/components/v3";
import type { V3Column } from "@/components/v3/V3DataTable";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, DollarSign, Users, Repeat, TrendingUp, PieChart, BarChart3, ShieldAlert, Receipt, ArrowUpDown, Filter } from "lucide-react";
import { format, parseISO } from "date-fns";
import { EChartsLineChart, EChartsCombinationChart, V3DonutChart } from "@/components/charts/echarts";
import { usePIIAccess } from "@/hooks/usePIIAccess";
import { useIsSingleDayView } from "@/hooks/useHourlyMetrics";
import { maskName, maskEmail } from "@/lib/pii-masking";
import { useDonationMetricsQuery, DonationRow } from "@/queries";
import { formatCurrency } from "@/lib/chart-formatters";
import { getOrgToday } from "@/lib/timezone";
import { HeroKpiCard } from "@/components/client/HeroKpiCard";
import { V3KPIDrilldownDrawer, type KPIDrilldownData } from "@/components/v3/V3KPIDrilldownDrawer";
import { useDashboardStore, useSelectedKpiKey, useIsDrilldownOpen, type KpiKey } from "@/stores/dashboardStore";

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
  const [sortBy, setSortBy] = useState<"amount" | "recent" | "state">("recent");
  const [filterRecurring, setFilterRecurring] = useState<"all" | "one-time" | "recurring">("all");
  const [currentPage, setCurrentPage] = useState(1);

  // PII access control - masks donor names/emails for users without PII access
  const { hasPIIAccess, isLoading: piiLoading } = usePIIAccess(organizationId);
  // Default to masked while loading (fail-closed security)
  const effectiveMaskPII = piiLoading ? true : !hasPIIAccess;

  // Fetch donation metrics
  const { data, isLoading, error, refetch } = useDonationMetricsQuery(organizationId, startDate, endDate);

  // Check if this is a single-day view
  const isSingleDay = useIsSingleDayView();

  const metrics = data?.metrics;
  const timeSeries = data?.timeSeries || [];
  const bySource = data?.bySource || [];
  const recentDonations = data?.recentDonations || [];

  // Derive latest data date and check for stale data
  const latestDataDate = useMemo(() => {
    if (timeSeries.length === 0) return null;
    return timeSeries[timeSeries.length - 1].date;
  }, [timeSeries]);

  // Uses org timezone for accurate "today" detection
  const isShowingStaleData = useMemo(() => {
    if (!latestDataDate) return false;
    const today = getOrgToday();
    return startDate === today && latestDataDate !== today;
  }, [latestDataDate, startDate]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortBy, filterRecurring]);

  // Prepare chart data
  const trendChartData = useMemo(() => timeSeries.map(d => ({
    name: format(parseISO(d.date), 'MMM d'),
    Amount: d.amount,
    Donations: d.donations,
  })), [timeSeries]);

  // Build trend data for expandable KPI cards
  const grossRaisedTrend = useMemo(() => timeSeries.map(d => ({
    date: d.date,
    value: d.amount,
  })), [timeSeries]);

  const donationCountTrend = useMemo(() => timeSeries.map(d => ({
    date: d.date,
    value: d.donations,
  })), [timeSeries]);

  // ========== Centralized Drawer State ==========
  const selectedKpiKey = useSelectedKpiKey();
  const isDrilldownOpen = useIsDrilldownOpen();
  const { setDrilldownOpen, setSelectedKpiKey } = useDashboardStore();

  // Build drilldown data for each KPI - centralized so only one drawer instance is needed
  const drilldownDataMap = useMemo((): Partial<Record<KpiKey, KPIDrilldownData>> => {
    // Use safe fallback metrics to prevent null-pointer closures during loading/refetch
    const safeMetrics = metrics ?? {
      totalRaised: 0,
      netRaised: 0,
      totalDonations: 0,
      uniqueDonors: 0,
      averageDonation: 0,
      oneTimeRevenue: 0,
      recurringRevenue: 0,
      oneTimeCount: 0,
      recurringCount: 0,
      refundAmount: 0,
      refundCount: 0,
    };
    
    // Log when using fallback metrics
    if (!metrics) {
      console.log('[DonationMetrics] Using fallback metrics - real metrics not yet available');
    }
    
    const seriesColor = "hsl(var(--portal-success))";
    
    return {
      channel_grossRaised: {
        label: "Gross Raised",
        value: formatCurrency(safeMetrics.totalRaised, true),
        icon: DollarSign,
        description: "Total donations before fees and refunds",
        timeSeriesData: grossRaisedTrend,
        timeSeriesConfig: {
          xAxisKey: "date",
          series: [{ dataKey: "value", name: "Gross Raised", color: seriesColor, type: "area", areaStyle: { opacity: 0.1 } }],
        },
        breakdown: [
          { label: "One-time", value: formatCurrency(safeMetrics.oneTimeRevenue, true) },
          { label: "Recurring", value: formatCurrency(safeMetrics.recurringRevenue, true) },
        ],
      },
      channel_uniqueDonors: {
        label: "Unique Donors",
        value: safeMetrics.uniqueDonors.toLocaleString(),
        icon: Users,
        timeSeriesData: donationCountTrend,
        timeSeriesConfig: {
          xAxisKey: "date",
          series: [{ dataKey: "value", name: "Donors", color: "hsl(var(--portal-accent-blue))", type: "area", areaStyle: { opacity: 0.1 } }],
        },
        breakdown: [
          { label: "One-time", value: safeMetrics.oneTimeCount.toLocaleString() },
          { label: "Recurring", value: safeMetrics.recurringCount.toLocaleString() },
        ],
      },
      channel_avgDonation: {
        label: "Avg Donation",
        value: `$${safeMetrics.averageDonation.toFixed(2)}`,
        icon: TrendingUp,
        breakdown: [
          { label: "One-time Avg", value: formatCurrency(safeMetrics.oneTimeRevenue / (safeMetrics.oneTimeCount || 1), true) },
          { label: "Recurring Avg", value: formatCurrency(safeMetrics.recurringRevenue / (safeMetrics.recurringCount || 1), true) },
        ],
      },
      channel_recurringPercent: {
        label: "Recurring",
        value: `${safeMetrics.totalDonations > 0 ? ((safeMetrics.recurringCount / safeMetrics.totalDonations) * 100).toFixed(0) : 0}%`,
        icon: Repeat,
        breakdown: [
          { label: "Recurring Count", value: safeMetrics.recurringCount.toLocaleString() },
          { label: "One-time Count", value: safeMetrics.oneTimeCount.toLocaleString() },
          { label: "Recurring Revenue", value: formatCurrency(safeMetrics.recurringRevenue, true) },
        ],
      },
      channel_netRaisedDonations: {
        label: "Net Revenue",
        value: formatCurrency(safeMetrics.netRaised, true),
        icon: DollarSign,
        timeSeriesData: grossRaisedTrend,
        timeSeriesConfig: {
          xAxisKey: "date",
          series: [{ dataKey: "value", name: "Revenue", color: seriesColor, type: "area", areaStyle: { opacity: 0.1 } }],
        },
        breakdown: [
          { label: "Gross Raised", value: formatCurrency(safeMetrics.totalRaised, true) },
          { label: "Fees", value: formatCurrency(safeMetrics.totalRaised - safeMetrics.netRaised, true) },
          { label: "Refunds", value: formatCurrency(safeMetrics.refundAmount, true) },
        ],
      },
      channel_totalDonations: {
        label: "Total Donations",
        value: safeMetrics.totalDonations.toLocaleString(),
        icon: Receipt,
        timeSeriesData: donationCountTrend,
        timeSeriesConfig: {
          xAxisKey: "date",
          series: [{ dataKey: "value", name: "Donations", color: "hsl(var(--portal-accent-blue))", type: "area", areaStyle: { opacity: 0.1 } }],
        },
        breakdown: [
          { label: "One-time", value: safeMetrics.oneTimeCount.toLocaleString() },
          { label: "Recurring", value: safeMetrics.recurringCount.toLocaleString() },
          { label: "Refunds", value: safeMetrics.refundCount.toLocaleString() },
        ],
      },
      channel_recurringRevenue: {
        label: "Recurring Revenue",
        value: formatCurrency(safeMetrics.recurringRevenue, true),
        icon: Repeat,
        breakdown: [
          { label: "Recurring Count", value: safeMetrics.recurringCount.toLocaleString() },
          { label: "Avg Recurring", value: formatCurrency(safeMetrics.recurringRevenue / (safeMetrics.recurringCount || 1), true) },
        ],
      },
      channel_refundAmount: {
        label: "Refunds",
        value: formatCurrency(safeMetrics.refundAmount, true),
        icon: TrendingUp,
        breakdown: [
          { label: "Refund Count", value: safeMetrics.refundCount.toLocaleString() },
          { label: "Avg Refund", value: formatCurrency(safeMetrics.refundAmount / (safeMetrics.refundCount || 1), true) },
        ],
      },
    };
  }, [metrics, grossRaisedTrend, donationCountTrend]);

  // Get current drilldown data based on selected KPI
  const currentDrilldownData = selectedKpiKey ? drilldownDataMap[selectedKpiKey] ?? null : null;

  // Debug logging for drilldown issues
  useEffect(() => {
    if (selectedKpiKey || isDrilldownOpen) {
      console.log('[DonationMetrics Drawer Debug]', {
        selectedKpiKey,
        isDrilldownOpen,
        hasMetrics: !!metrics,
        metricsTotal: metrics?.totalDonations,
        hasDrilldownData: !!currentDrilldownData,
        drilldownMapKeys: Object.keys(drilldownDataMap),
        isLoading,
        willDrawerOpen: isDrilldownOpen && currentDrilldownData !== null,
      });
    }
  }, [selectedKpiKey, isDrilldownOpen, metrics, currentDrilldownData, drilldownDataMap, isLoading]);

  // Handle drawer close
  const handleDrawerOpenChange = (open: boolean) => {
    console.log('[DonationMetrics] handleDrawerOpenChange called:', { open, selectedKpiKey });
    setDrilldownOpen(open);
    if (!open) {
      setSelectedKpiKey(null);
    }
  };

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

  // Filtered and sorted donations for the Recent Donations table
  const filteredDonations = useMemo(() => {
    let result = [...recentDonations];
    
    // Apply search filter (name, email, state, refcode)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(d => 
        d.donorName.toLowerCase().includes(term) || 
        d.email.toLowerCase().includes(term) ||
        (d.state?.toLowerCase().includes(term) ?? false) ||
        (d.refcode?.toLowerCase().includes(term) ?? false)
      );
    }
    
    // Apply recurring filter
    if (filterRecurring === "one-time") {
      result = result.filter(d => !d.isRecurring);
    } else if (filterRecurring === "recurring") {
      result = result.filter(d => d.isRecurring);
    }
    
    // Apply sorting
    switch (sortBy) {
      case "amount":
        result.sort((a, b) => b.netAmount - a.netAmount);
        break;
      case "state":
        result.sort((a, b) => (a.state || "ZZZ").localeCompare(b.state || "ZZZ"));
        break;
      case "recent":
      default:
        result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        break;
    }
    
    // Apply PII masking after filtering (so search works on real data)
    // Use effectiveMaskPII which defaults to masked while loading
    if (effectiveMaskPII) {
      result = result.map(d => ({
        ...d,
        donorName: maskName(d.donorName),
        email: maskEmail(d.email),
      }));
    }
    
    return result;
  }, [recentDonations, searchTerm, sortBy, filterRecurring, effectiveMaskPII]);

  // PII masking indicator component - shows when masked or still checking
  const PIIMaskingIndicator = () => {
    if (piiLoading) {
      return (
        <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--portal-text-muted))] bg-[hsl(var(--portal-bg-elevated))] px-2 py-1 rounded border border-[hsl(var(--portal-border))]">
          <ShieldAlert className="h-3 w-3 animate-pulse" aria-hidden="true" />
          <span>Checking permissions...</span>
        </div>
      );
    }
    if (effectiveMaskPII) {
      return (
        <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--portal-text-muted))] bg-[hsl(var(--portal-bg-elevated))] px-2 py-1 rounded border border-[hsl(var(--portal-border))]">
          <ShieldAlert className="h-3 w-3" aria-hidden="true" />
          <span>Donor PII masked</span>
        </div>
      );
    }
    return null;
  };

  // Determine content to render - but keep drawer always mounted outside conditionals
  const renderContent = () => {
    // Show loading state ONLY for donation data - PII is non-blocking (defaults to masked)
    if (isLoading) {
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
      {/* Stale data indicator */}
      {isShowingStaleData && latestDataDate && (
        <V3InsightBadge type="anomaly-high">
          Showing data from {format(parseISO(latestDataDate), 'MMM d')} — today's data not yet synced
        </V3InsightBadge>
      )}

      {/* Primary KPIs */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants}>
          <HeroKpiCard
            kpiKey="channel_grossRaised"
            icon={DollarSign}
            label="Gross Raised"
            value={formatCurrency(metrics.totalRaised, true)}
            subtitle="Before fees"
            accent="green"
            trendData={grossRaisedTrend}
            trendXAxisKey="date"
            breakdown={[
              { label: "One-time", value: formatCurrency(metrics.oneTimeRevenue, true) },
              { label: "Recurring", value: formatCurrency(metrics.recurringRevenue, true) },
            ]}
            expansionMode="drawer"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <HeroKpiCard
            kpiKey="channel_uniqueDonors"
            icon={Users}
            label="Unique Donors"
            value={metrics.uniqueDonors.toLocaleString()}
            accent="blue"
            trendData={donationCountTrend}
            trendXAxisKey="date"
            breakdown={[
              { label: "One-time", value: metrics.oneTimeCount.toLocaleString() },
              { label: "Recurring", value: metrics.recurringCount.toLocaleString() },
            ]}
            expansionMode="drawer"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <HeroKpiCard
            kpiKey="channel_avgDonation"
            icon={TrendingUp}
            label="Avg Donation"
            value={`$${metrics.averageDonation.toFixed(2)}`}
            accent="purple"
            breakdown={[
              { label: "One-time Avg", value: formatCurrency(metrics.oneTimeRevenue / (metrics.oneTimeCount || 1), true) },
              { label: "Recurring Avg", value: formatCurrency(metrics.recurringRevenue / (metrics.recurringCount || 1), true) },
            ]}
            expansionMode="drawer"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <HeroKpiCard
            kpiKey="channel_recurringPercent"
            icon={Repeat}
            label="Recurring"
            value={`${metrics.totalDonations > 0 ? ((metrics.recurringCount / metrics.totalDonations) * 100).toFixed(0) : 0}%`}
            subtitle={`${metrics.recurringCount} sustainers`}
            accent="amber"
            breakdown={[
              { label: "Recurring Count", value: metrics.recurringCount.toLocaleString() },
              { label: "One-time Count", value: metrics.oneTimeCount.toLocaleString() },
              { label: "Recurring Revenue", value: formatCurrency(metrics.recurringRevenue, true) },
            ]}
            expansionMode="drawer"
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
          <HeroKpiCard
            kpiKey="channel_netRaisedDonations"
            icon={DollarSign}
            label="Net Revenue"
            value={formatCurrency(metrics.netRaised, true)}
            accent="green"
            trendData={grossRaisedTrend}
            trendXAxisKey="date"
            breakdown={[
              { label: "Gross Raised", value: formatCurrency(metrics.totalRaised, true) },
              { label: "Fees", value: formatCurrency(metrics.totalRaised - metrics.netRaised, true) },
              { label: "Refunds", value: formatCurrency(metrics.refundAmount, true) },
            ]}
            expansionMode="drawer"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <HeroKpiCard
            kpiKey="channel_totalDonations"
            icon={Receipt}
            label="Total Donations"
            value={metrics.totalDonations.toLocaleString()}
            accent="default"
            trendData={donationCountTrend}
            trendXAxisKey="date"
            breakdown={[
              { label: "One-time", value: metrics.oneTimeCount.toLocaleString() },
              { label: "Recurring", value: metrics.recurringCount.toLocaleString() },
              { label: "Refunds", value: metrics.refundCount.toLocaleString() },
            ]}
            expansionMode="drawer"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <HeroKpiCard
            kpiKey="channel_recurringRevenue"
            icon={Repeat}
            label="Recurring Revenue"
            value={formatCurrency(metrics.recurringRevenue, true)}
            accent="blue"
            breakdown={[
              { label: "Recurring Count", value: metrics.recurringCount.toLocaleString() },
              { label: "Avg Recurring", value: formatCurrency(metrics.recurringRevenue / (metrics.recurringCount || 1), true) },
            ]}
            expansionMode="drawer"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <HeroKpiCard
            kpiKey="channel_refundAmount"
            icon={TrendingUp}
            label="Refunds"
            value={formatCurrency(metrics.refundAmount, true)}
            subtitle={`${metrics.refundCount} refunds`}
            accent={metrics.refundAmount > 0 ? "red" : "default"}
            breakdown={[
              { label: "Refund Count", value: metrics.refundCount.toLocaleString() },
              { label: "Avg Refund", value: formatCurrency(metrics.refundAmount / (metrics.refundCount || 1), true) },
            ]}
            expansionMode="drawer"
          />
        </motion.div>
      </motion.div>

      {/* Multi-Day View: Donation Trend Chart */}
      {!isSingleDay && trendChartData.length > 0 && (
        <V3ChartWrapper
          title="Donation Trend"
          icon={TrendingUp}
          ariaLabel="Donation trend chart showing daily amounts and counts over time"
          description="Line chart displaying daily donation amounts and transaction counts"
          accent="green"
        >
          <EChartsLineChart
            data={trendChartData}
            xAxisKey="name"
            series={[
              { dataKey: "Amount", name: "Amount", color: "hsl(var(--portal-success))", valueType: "currency", yAxisIndex: 0 },
              { dataKey: "Donations", name: "Donations", color: "hsl(var(--portal-accent-blue))", valueType: "number", yAxisIndex: 1 },
            ]}
            valueType="currency"
            dualYAxis
            yAxisValueTypeLeft="currency"
            yAxisValueTypeRight="number"
            height={280}
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
            <V3DonutChart
              data={attributionData.map((d, i) => ({ 
                name: d.name, 
                value: d.value,
                color: CHART_COLORS[i % CHART_COLORS.length]
              }))}
              valueType="currency"
              height={280}
              centerLabel="Net Revenue"
              topN={8}
              overrideTotal={metrics.netRaised}
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
            <EChartsCombinationChart
              data={giftSizeData}
              xAxisKey="name"
              series={[
                { 
                  dataKey: "amount", 
                  name: "Amount", 
                  type: "bar",
                  color: "hsl(var(--portal-accent-blue))",
                  yAxisIndex: 0,
                  valueType: "currency"
                },
                { 
                  dataKey: "count", 
                  name: "Count", 
                  type: "line",
                  color: "hsl(var(--portal-accent-purple))",
                  yAxisIndex: 1,
                  valueType: "number",
                  showSymbol: true,
                  lineWidth: 3
                },
              ]}
              dualYAxis
              yAxisValueTypeLeft="currency"
              yAxisValueTypeRight="number"
              yAxisNameLeft="Amount"
              yAxisNameRight="Count"
              height={280}
            />
          </V3ChartWrapper>
        )}
      </div>

      {/* Recent Donations Table */}
      <V3Card accent="green">
        <V3CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <V3CardTitle>Recent Donations</V3CardTitle>
            <div className="flex items-center gap-2">
              <PIIMaskingIndicator />
            </div>
          </div>
          {/* Search, Sort, and Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
              <Input
                placeholder="Search by name, email, state, refcode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))]"
              />
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as "amount" | "recent" | "state")}>
              <SelectTrigger className="w-[160px] bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))]">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="amount">Highest Amount</SelectItem>
                <SelectItem value="state">Location</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterRecurring} onValueChange={(v) => setFilterRecurring(v as "all" | "one-time" | "recurring")}>
              <SelectTrigger className="w-[140px] bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="one-time">One-time</SelectItem>
                <SelectItem value="recurring">Recurring</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </V3CardHeader>
        <V3CardContent>
          <V3DataTable<DonationRow>
            data={filteredDonations}
            getRowKey={(row) => row.id}
            columns={[
              {
                key: "donor",
                header: "Donor",
                render: (row) => (
                  <div className="min-w-0">
                    <div className="font-medium text-[hsl(var(--portal-text-primary))] truncate">
                      {row.donorName}
                    </div>
                    <div className="text-xs text-[hsl(var(--portal-text-muted))] truncate">
                      {row.email}
                    </div>
                  </div>
                ),
              },
              {
                key: "amount",
                header: "Amount",
                align: "right",
                render: (row) => (
                  <div>
                    <div className="font-medium text-[hsl(var(--portal-success))]">
                      {formatCurrency(row.netAmount)}
                    </div>
                    {row.isRecurring && (
                      <span className="text-xs text-[hsl(var(--portal-accent-blue))]">Recurring</span>
                    )}
                  </div>
                ),
              },
              {
                key: "state",
                header: "Location",
                hideOnMobile: true,
                render: (row) => (
                  <span className="text-[hsl(var(--portal-text-secondary))]">
                    {row.state || "—"}
                  </span>
                ),
              },
              {
                key: "date",
                header: "Date",
                render: (row) => (
                  <span className="text-[hsl(var(--portal-text-muted))]">
                    {row.date ? format(parseISO(row.date), 'MMM d, yyyy') : "—"}
                  </span>
                ),
              },
              {
                key: "source",
                header: "Source",
                hideOnMobile: true,
                render: (row) => (
                  <span className="text-[hsl(var(--portal-text-secondary))] truncate max-w-[120px] block">
                    {row.refcode || "Direct"}
                  </span>
                ),
              },
            ] as V3Column<DonationRow>[]}
            emptyTitle="No donations found"
            emptyDescription="No donations match your search criteria"
            isLoading={false}
            pagination
            pageSize={25}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        </V3CardContent>
      </V3Card>

      </div>
    );
  };

  return (
    <>
      {renderContent()}
      
      {/* Centralized Drilldown Drawer - ALWAYS MOUNTED outside conditionals */}
      {/* This survives loading/error/empty state changes so drawer stays open */}
      <V3KPIDrilldownDrawer
        open={isDrilldownOpen && currentDrilldownData !== null}
        onOpenChange={handleDrawerOpenChange}
        data={currentDrilldownData}
      />
    </>
  );
};

export default DonationMetrics;
