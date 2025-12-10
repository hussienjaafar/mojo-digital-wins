import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Search, DollarSign, Users, Repeat, TrendingUp, PieChart, BarChart3, Filter, ShieldAlert, Heart } from "lucide-react";
import { format, subDays, parseISO } from "date-fns";
import { logger } from "@/lib/logger";
import { PortalTable, PortalTableRenderers } from "@/components/portal/PortalTable";
import { NoResultsEmptyState } from "@/components/portal/PortalEmptyState";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveLineChart, ResponsiveBarChart, ResponsivePieChart } from "@/components/charts";
import { usePIIAccess } from "@/hooks/usePIIAccess";
import { maskDonorInfo } from "@/lib/pii-masking";

type Props = {
  organizationId: string;
  startDate: string;
  endDate: string;
};

type Transaction = {
  id: string;
  transaction_id: string;
  donor_name: string;
  first_name: string | null;
  last_name: string | null;
  donor_email: string;
  amount: number;
  refcode: string | null;
  source_campaign: string | null;
  transaction_type: string;
  is_recurring: boolean;
  transaction_date: string;
  state: string | null;
  city: string | null;
};

type DailyDonation = {
  date: string;
  amount: number;
  count: number;
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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [previousTransactions, setPreviousTransactions] = useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [amountFilter, setAmountFilter] = useState<string>("all");

  // PII access control - masks donor names/emails for users without PII access
  const { shouldMaskPII, isLoading: piiLoading } = usePIIAccess(organizationId);

  // Apply PII masking to transactions based on user's access level
  const maskedTransactions = useMemo(() => {
    if (!shouldMaskPII) return transactions;
    return transactions.map(t => maskDonorInfo(t, true) as Transaction);
  }, [transactions, shouldMaskPII]);

  const getPreviousPeriod = () => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const prevEnd = subDays(start, 1);
    const prevStart = subDays(prevEnd, daysDiff);
    return {
      start: format(prevStart, 'yyyy-MM-dd'),
      end: format(prevEnd, 'yyyy-MM-dd'),
    };
  };

  useEffect(() => {
    loadData();
  }, [organizationId, startDate, endDate]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    const prevPeriod = getPreviousPeriod();

    try {
      // ActBlue uses Eastern Time, so convert date boundaries accordingly
      const startDateObj = parseISO(startDate);
      const endDateObj = parseISO(endDate);

      // Convert to UTC boundaries that capture Eastern Time day
      const utcStart = new Date(startDateObj);
      utcStart.setUTCHours(4, 0, 0, 0);

      const utcEnd = new Date(endDateObj);
      utcEnd.setDate(utcEnd.getDate() + 1);
      utcEnd.setUTCHours(5, 0, 0, 0);

      logger.info('Loading ActBlue transactions', {
        organizationId,
        startDate,
        endDate,
        utcStart: utcStart.toISOString(),
        utcEnd: utcEnd.toISOString(),
        prevPeriod
      });

      // Current period (using secure view for defense-in-depth PII protection)
      const { data, error: queryError } = await (supabase as any)
        .from('actblue_transactions_secure')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('transaction_date', utcStart.toISOString())
        .lt('transaction_date', utcEnd.toISOString())
        .order('transaction_date', { ascending: false });

      if (queryError) {
        logger.error('ActBlue query error', { error: queryError, organizationId });
        throw queryError;
      }

      logger.info('ActBlue transactions loaded', {
        count: data?.length || 0,
        organizationId
      });

      setTransactions(data || []);

      // Previous period - also use Eastern Time boundaries
      const prevStartObj = parseISO(prevPeriod.start);
      const prevEndObj = parseISO(prevPeriod.end);

      const prevUtcStart = new Date(prevStartObj);
      prevUtcStart.setUTCHours(4, 0, 0, 0);

      const prevUtcEnd = new Date(prevEndObj);
      prevUtcEnd.setDate(prevUtcEnd.getDate() + 1);
      prevUtcEnd.setUTCHours(5, 0, 0, 0);

      // Previous period (using secure view for defense-in-depth PII protection)
      const { data: prevData } = await (supabase as any)
        .from('actblue_transactions_secure')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('transaction_date', prevUtcStart.toISOString())
        .lt('transaction_date', prevUtcEnd.toISOString());

      setPreviousTransactions(prevData || []);
    } catch (err) {
      logger.error('Failed to load transactions', err);
      setError('Failed to load donation data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter transactions (use masked data for display)
  const filteredTransactions = useMemo(() => {
    let filtered = maskedTransactions;

    if (searchTerm) {
      // Search on original data for accuracy, then filter masked results
      const originalMatches = new Set(
        transactions
          .filter(t =>
            t.donor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.transaction_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.refcode?.toLowerCase().includes(searchTerm.toLowerCase())
          )
          .map(t => t.id)
      );
      filtered = filtered.filter(t => originalMatches.has(t.id));
    }

    if (typeFilter === "recurring") {
      filtered = filtered.filter(t => t.is_recurring);
    } else if (typeFilter === "one-time") {
      filtered = filtered.filter(t => !t.is_recurring);
    }

    if (amountFilter === "small") {
      filtered = filtered.filter(t => t.amount <= 25);
    } else if (amountFilter === "medium") {
      filtered = filtered.filter(t => t.amount > 25 && t.amount <= 100);
    } else if (amountFilter === "large") {
      filtered = filtered.filter(t => t.amount > 100 && t.amount <= 500);
    } else if (amountFilter === "major") {
      filtered = filtered.filter(t => t.amount > 500);
    }

    return filtered;
  }, [searchTerm, transactions, maskedTransactions, typeFilter, amountFilter]);

  // Calculate current period metrics
  const metrics = useMemo(() => {
    const donations = filteredTransactions.filter(t => t.transaction_type === 'donation');
    const totalAmount = donations.reduce((sum, t) => sum + Number(t.amount), 0);
    const avgDonation = donations.length > 0 ? totalAmount / donations.length : 0;
    const recurringCount = donations.filter(t => t.is_recurring).length;
    const recurringPercentage = donations.length > 0 ? (recurringCount / donations.length) * 100 : 0;
    const uniqueDonors = new Set(donations.map(d => d.donor_email)).size;

    return {
      totalAmount,
      donationCount: donations.length,
      avgDonation,
      recurringCount,
      recurringPercentage,
      uniqueDonors,
    };
  }, [filteredTransactions]);

  // Calculate previous period metrics
  const previousMetrics = useMemo(() => {
    const donations = previousTransactions.filter(t => t.transaction_type === 'donation');
    const totalAmount = donations.reduce((sum, t) => sum + Number(t.amount), 0);
    const uniqueDonors = new Set(donations.map(d => d.donor_email)).size;
    const avgDonation = donations.length > 0 ? totalAmount / donations.length : 0;

    return {
      totalAmount,
      donationCount: donations.length,
      avgDonation,
      uniqueDonors,
    };
  }, [previousTransactions]);

  const calcChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  // Attribution breakdown by refcode
  const attributionData = useMemo(() => {
    const donations = transactions.filter(t => t.transaction_type === 'donation');
    const byRefcode: Record<string, { amount: number; count: number }> = {};

    donations.forEach(t => {
      const source = t.refcode || t.source_campaign || 'Direct';
      if (!byRefcode[source]) {
        byRefcode[source] = { amount: 0, count: 0 };
      }
      byRefcode[source].amount += Number(t.amount);
      byRefcode[source].count += 1;
    });

    return Object.entries(byRefcode)
      .map(([name, data]) => ({
        name: name.length > 15 ? name.slice(0, 15) + '...' : name,
        fullName: name,
        value: data.amount,
        count: data.count,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [transactions]);

  // Gift size distribution
  const giftSizeData = useMemo(() => {
    const donations = transactions.filter(t => t.transaction_type === 'donation');
    const buckets = [
      { name: '$0-25', min: 0, max: 25, count: 0, amount: 0 },
      { name: '$25-100', min: 25, max: 100, count: 0, amount: 0 },
      { name: '$100-500', min: 100, max: 500, count: 0, amount: 0 },
      { name: '$500+', min: 500, max: Infinity, count: 0, amount: 0 },
    ];

    donations.forEach(t => {
      const bucket = buckets.find(b => t.amount > b.min && t.amount <= b.max) || buckets[buckets.length - 1];
      bucket.count += 1;
      bucket.amount += Number(t.amount);
    });

    return buckets;
  }, [transactions]);

  // Daily donation trend
  const dailyTrend = useMemo(() => {
    const donations = transactions.filter(t => t.transaction_type === 'donation');
    const byDate: Record<string, DailyDonation> = {};

    donations.forEach(t => {
      const date = t.transaction_date.split('T')[0];
      if (!byDate[date]) {
        byDate[date] = { date, amount: 0, count: 0 };
      }
      byDate[date].amount += Number(t.amount);
      byDate[date].count += 1;
    });

    return Object.values(byDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        name: format(parseISO(d.date), 'MMM d'),
        Amount: d.amount,
        Donations: d.count,
      }));
  }, [transactions]);

  // New vs repeat donors (use original data for accurate counts)
  const donorInsights = useMemo(() => {
    const donations = transactions.filter(t => t.transaction_type === 'donation');
    const donorEmails = new Set(donations.map(d => d.donor_email));
    const prevDonorEmails = new Set(previousTransactions.filter(t => t.transaction_type === 'donation').map(d => d.donor_email));

    let newDonors = 0;
    let repeatDonors = 0;

    donorEmails.forEach(email => {
      if (prevDonorEmails.has(email)) {
        repeatDonors++;
      } else {
        newDonors++;
      }
    });

    return { newDonors, repeatDonors };
  }, [transactions, previousTransactions]);

  // PII masking indicator component
  const PIIMaskingIndicator = () => shouldMaskPII ? (
    <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--portal-text-muted))] bg-[hsl(var(--portal-bg-elevated))] px-2 py-1 rounded border border-[hsl(var(--portal-border))]">
      <ShieldAlert className="h-3 w-3" aria-hidden="true" />
      <span>Donor PII masked</span>
    </div>
  ) : null;

  // Show loading state
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
        message={error}
        onRetry={loadData}
      />
    );
  }

  // Show empty state if no transactions
  if (transactions.length === 0 && !isLoading) {
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
      {/* Primary KPIs with Period Comparison */}
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
            value={`$${metrics.totalAmount.toLocaleString()}`}
            trend={{ value: calcChange(metrics.totalAmount, previousMetrics.totalAmount) }}
            accent="green"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <V3KPICard
            icon={Users}
            label="Unique Donors"
            value={metrics.uniqueDonors.toLocaleString()}
            trend={{ value: calcChange(metrics.uniqueDonors, previousMetrics.uniqueDonors) }}
            accent="blue"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <V3KPICard
            icon={TrendingUp}
            label="Avg Donation"
            value={`$${metrics.avgDonation.toFixed(2)}`}
            trend={{ value: calcChange(metrics.avgDonation, previousMetrics.avgDonation) }}
            accent="purple"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <V3KPICard
            icon={Repeat}
            label="Recurring"
            value={`${metrics.recurringPercentage.toFixed(0)}%`}
            subtitle={`${metrics.recurringCount} sustainers`}
            accent="amber"
          />
        </motion.div>
      </motion.div>

      {/* Secondary Donor Insights Row */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants}>
          <div className="rounded-lg p-3 border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-elevated))]">
            <span className="text-xs text-[hsl(var(--portal-text-secondary))]">New Donors</span>
            <div className="text-lg font-semibold text-[hsl(var(--portal-success))]">{donorInsights.newDonors}</div>
          </div>
        </motion.div>
        <motion.div variants={itemVariants}>
          <div className="rounded-lg p-3 border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-elevated))]">
            <span className="text-xs text-[hsl(var(--portal-text-secondary))]">Repeat Donors</span>
            <div className="text-lg font-semibold text-[hsl(var(--portal-accent-blue))]">{donorInsights.repeatDonors}</div>
          </div>
        </motion.div>
        <motion.div variants={itemVariants}>
          <div className="rounded-lg p-3 border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-elevated))]">
            <span className="text-xs text-[hsl(var(--portal-text-secondary))]">Total Donations</span>
            <div className="text-lg font-semibold text-[hsl(var(--portal-text-primary))]">{metrics.donationCount}</div>
          </div>
        </motion.div>
        <motion.div variants={itemVariants}>
          <div className="rounded-lg p-3 border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-elevated))]">
            <span className="text-xs text-[hsl(var(--portal-text-secondary))]">Avg Gifts/Donor</span>
            <div className="text-lg font-semibold text-[hsl(var(--portal-text-primary))]">
              {metrics.uniqueDonors > 0 ? (metrics.donationCount / metrics.uniqueDonors).toFixed(1) : '0'}
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Donation Trend Chart */}
      {dailyTrend.length > 0 && (
        <V3ChartWrapper
          title="Donation Trend"
          icon={TrendingUp}
          ariaLabel="Donation trend chart showing daily amounts and counts over time"
          description="Line chart displaying daily donation amounts and transaction counts"
          accent="green"
        >
          <ResponsiveLineChart
            data={dailyTrend}
            lines={[
              { dataKey: "Amount", name: "Amount", color: "hsl(var(--portal-success))", valueType: "currency" },
              { dataKey: "Donations", name: "Donations", color: "hsl(var(--portal-accent-blue))", valueType: "number" },
            ]}
            valueType="currency"
          />
        </V3ChartWrapper>
      )}

      {/* Attribution & Gift Size Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Attribution Breakdown */}
        {attributionData.length > 0 && (
          <V3ChartWrapper
            title="Attribution by Source"
            icon={PieChart}
            ariaLabel="Donation attribution pie chart showing contributions by source"
            description="Pie chart showing donation amounts broken down by attribution source or refcode"
            accent="green"
          >
            <ResponsivePieChart
              data={attributionData}
              valueType="currency"
              innerRadius={45}
              colors={CHART_COLORS}
            />
          </V3ChartWrapper>
        )}

        {/* Gift Size Distribution */}
        <V3ChartWrapper
          title="Gift Size Distribution"
          icon={BarChart3}
          ariaLabel="Gift size distribution bar chart showing donation count by amount range"
          description="Bar chart showing the number of donations in each gift size category"
          accent="green"
        >
          <ResponsiveBarChart
            data={giftSizeData}
            bars={[
              { dataKey: "count", name: "Donations", color: "hsl(var(--portal-accent-blue))" },
            ]}
            valueType="number"
          />
        </V3ChartWrapper>
      </div>

      {/* Transactions Table with Filters */}
      <V3Card accent="green">
        <V3CardHeader>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <V3CardTitle>Recent Transactions</V3CardTitle>
              <PIIMaskingIndicator />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--portal-text-muted))]" aria-hidden="true" />
                <Input
                  placeholder="Search by donor, ID, or refcode..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-8 text-sm"
                  aria-label="Search transactions"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" aria-hidden="true" />
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[110px] h-8 text-xs" aria-label="Filter by type">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="one-time">One-time</SelectItem>
                    <SelectItem value="recurring">Recurring</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={amountFilter} onValueChange={setAmountFilter}>
                  <SelectTrigger className="w-[110px] h-8 text-xs" aria-label="Filter by amount">
                    <SelectValue placeholder="Amount" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Amounts</SelectItem>
                    <SelectItem value="small">$0-25</SelectItem>
                    <SelectItem value="medium">$25-100</SelectItem>
                    <SelectItem value="large">$100-500</SelectItem>
                    <SelectItem value="major">$500+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </V3CardHeader>
        <V3CardContent>
          <PortalTable
            data={filteredTransactions.slice(0, 100)}
            columns={[
              {
                key: "transaction_date",
                label: "Date",
                sortable: true,
                render: (value) => (
                  <span className="text-[hsl(var(--portal-text-secondary))] text-sm">
                    {format(new Date(value), 'MMM d, yyyy')}
                  </span>
                ),
              },
              {
                key: "donor_name",
                label: "Donor",
                sortable: true,
                render: (value, row) => {
                  // Display name, fallback to first+last, then email
                  const displayName = value
                    || (row.first_name && row.last_name ? `${row.first_name} ${row.last_name}` : null)
                    || row.first_name
                    || row.last_name
                    || null;

                  // Build location string
                  const location = row.city && row.state
                    ? `${row.city}, ${row.state}`
                    : (row.city || row.state || null);

                  return (
                    <div className="flex flex-col">
                      <span className="font-medium text-[hsl(var(--portal-text-primary))]">
                        {displayName || row.donor_email || 'Anonymous'}
                      </span>
                      {location && (
                        <span className="text-xs text-[hsl(var(--portal-text-muted))]">{location}</span>
                      )}
                    </div>
                  );
                },
              },
              {
                key: "amount",
                label: "Amount",
                sortable: true,
                className: "text-right",
                render: (value) => (
                  <span className="font-semibold text-[hsl(var(--portal-text-primary))]">
                    {PortalTableRenderers.currency(Number(value))}
                  </span>
                ),
              },
              {
                key: "refcode",
                label: "Source",
                className: "text-sm",
                render: (value, row) => (
                  <span className="text-[hsl(var(--portal-text-secondary))]">{value || row.source_campaign || '-'}</span>
                ),
                hiddenOnMobile: true,
              },
              {
                key: "is_recurring",
                label: "Type",
                mobileLabel: "Type",
                render: (value) => value ? (
                  <PortalBadge variant="info" icon={Repeat}>Recurring</PortalBadge>
                ) : (
                  <PortalBadge variant="neutral">One-time</PortalBadge>
                ),
              },
            ]}
            keyExtractor={(row) => row.id}
            isLoading={isLoading}
            emptyMessage={searchTerm ? "No transactions match your search" : "No transactions found"}
            emptyAction={
              searchTerm ? (
                <NoResultsEmptyState onClear={() => setSearchTerm("")} />
              ) : (
                <p className="text-sm text-[hsl(var(--portal-text-muted))]">
                  Transactions will appear here once donations are received
                </p>
              )
            }
          />
        </V3CardContent>
      </V3Card>
    </div>
  );
};

export default DonationMetrics;
