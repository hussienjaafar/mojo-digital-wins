import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PortalCard, PortalCardContent, PortalCardHeader, PortalCardTitle } from "@/components/portal/PortalCard";
import { PortalMetric } from "@/components/portal/PortalMetric";
import { PortalBadge } from "@/components/portal/PortalBadge";
import { Input } from "@/components/ui/input";
import { Search, DollarSign, Users, Repeat, TrendingUp, TrendingDown, PieChart, BarChart3, Filter } from "lucide-react";
import { format, subDays, parseISO } from "date-fns";
import { logger } from "@/lib/logger";
import { PortalTable, PortalTableRenderers } from "@/components/portal/PortalTable";
import { NoResultsEmptyState } from "@/components/portal/PortalEmptyState";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveLineChart, ResponsiveBarChart, ResponsivePieChart } from "@/components/charts";
import { formatCurrency } from "@/lib/chart-formatters";

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

const DonationMetrics = ({ organizationId, startDate, endDate }: Props) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [previousTransactions, setPreviousTransactions] = useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [amountFilter, setAmountFilter] = useState<string>("all");

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
    const prevPeriod = getPreviousPeriod();

    try {
      logger.info('Loading ActBlue transactions', { 
        organizationId, 
        startDate, 
        endDate,
        prevPeriod 
      });

      // Current period
      const { data, error } = await (supabase as any)
        .from('actblue_transactions')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('transaction_date', startDate)
        .lte('transaction_date', `${endDate}T23:59:59`)
        .order('transaction_date', { ascending: false });

      if (error) {
        logger.error('ActBlue query error', { error, organizationId });
        throw error;
      }
      
      logger.info('ActBlue transactions loaded', { 
        count: data?.length || 0,
        organizationId 
      });
      
      setTransactions(data || []);

      // Previous period
      const { data: prevData } = await (supabase as any)
        .from('actblue_transactions')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('transaction_date', prevPeriod.start)
        .lte('transaction_date', `${prevPeriod.end}T23:59:59`);

      setPreviousTransactions(prevData || []);
    } catch (error) {
      logger.error('Failed to load transactions', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;

    if (searchTerm) {
      filtered = filtered.filter(t =>
        t.donor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.transaction_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.refcode?.toLowerCase().includes(searchTerm.toLowerCase())
      );
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
  }, [searchTerm, transactions, typeFilter, amountFilter]);

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

  // New vs repeat donors
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

  const TrendIndicator = ({ value, isPositive }: { value: number; isPositive?: boolean }) => {
    const positive = isPositive ?? value >= 0;
    return (
      <span className={`flex items-center gap-0.5 text-xs font-medium ${positive ? 'text-[hsl(var(--portal-success))]' : 'text-[hsl(var(--portal-error))]'}`}>
        {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {Math.abs(value).toFixed(1)}%
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* KPIs with Period Comparison */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="portal-bg-elevated rounded-lg p-4 border border-[hsl(var(--portal-border))]">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-4 w-4 text-[hsl(var(--portal-success))]" />
            <span className="text-xs portal-text-secondary">Total Raised</span>
          </div>
          <div className="text-xl font-bold portal-text-primary">${metrics.totalAmount.toLocaleString()}</div>
          <TrendIndicator value={calcChange(metrics.totalAmount, previousMetrics.totalAmount)} />
        </div>
        <div className="portal-bg-elevated rounded-lg p-4 border border-[hsl(var(--portal-border))]">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-[hsl(var(--portal-accent-blue))]" />
            <span className="text-xs portal-text-secondary">Unique Donors</span>
          </div>
          <div className="text-xl font-bold portal-text-primary">{metrics.uniqueDonors.toLocaleString()}</div>
          <TrendIndicator value={calcChange(metrics.uniqueDonors, previousMetrics.uniqueDonors)} />
        </div>
        <div className="portal-bg-elevated rounded-lg p-4 border border-[hsl(var(--portal-border))]">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-[hsl(var(--portal-accent-purple))]" />
            <span className="text-xs portal-text-secondary">Avg Donation</span>
          </div>
          <div className="text-xl font-bold portal-text-primary">${metrics.avgDonation.toFixed(2)}</div>
          <TrendIndicator value={calcChange(metrics.avgDonation, previousMetrics.avgDonation)} />
        </div>
        <div className="portal-bg-elevated rounded-lg p-4 border border-[hsl(var(--portal-border))]">
          <div className="flex items-center gap-2 mb-1">
            <Repeat className="h-4 w-4 text-[hsl(var(--portal-warning))]" />
            <span className="text-xs portal-text-secondary">Recurring</span>
          </div>
          <div className="text-xl font-bold portal-text-primary">{metrics.recurringPercentage.toFixed(0)}%</div>
          <span className="text-xs portal-text-muted">{metrics.recurringCount} sustainers</span>
        </div>
      </div>

      {/* Donor Insights Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="portal-bg-elevated rounded-lg p-3 border border-[hsl(var(--portal-border))]">
          <span className="text-xs portal-text-secondary">New Donors</span>
          <div className="text-lg font-semibold text-[hsl(var(--portal-success))]">{donorInsights.newDonors}</div>
        </div>
        <div className="portal-bg-elevated rounded-lg p-3 border border-[hsl(var(--portal-border))]">
          <span className="text-xs portal-text-secondary">Repeat Donors</span>
          <div className="text-lg font-semibold text-[hsl(var(--portal-accent-blue))]">{donorInsights.repeatDonors}</div>
        </div>
        <div className="portal-bg-elevated rounded-lg p-3 border border-[hsl(var(--portal-border))]">
          <span className="text-xs portal-text-secondary">Total Donations</span>
          <div className="text-lg font-semibold portal-text-primary">{metrics.donationCount}</div>
        </div>
        <div className="portal-bg-elevated rounded-lg p-3 border border-[hsl(var(--portal-border))]">
          <span className="text-xs portal-text-secondary">Avg Gifts/Donor</span>
          <div className="text-lg font-semibold portal-text-primary">
            {metrics.uniqueDonors > 0 ? (metrics.donationCount / metrics.uniqueDonors).toFixed(1) : '0'}
          </div>
        </div>
      </div>

      {/* Donation Trend Chart */}
      {dailyTrend.length > 0 && (
        <PortalCard>
          <PortalCardHeader>
            <PortalCardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Donation Trend
            </PortalCardTitle>
          </PortalCardHeader>
          <PortalCardContent>
            <ResponsiveLineChart
              data={dailyTrend}
              lines={[
                { dataKey: "Amount", name: "Amount", color: "hsl(var(--portal-success))", valueType: "currency" },
                { dataKey: "Donations", name: "Donations", color: "hsl(var(--portal-accent-blue))", valueType: "number" },
              ]}
              valueType="currency"
            />
          </PortalCardContent>
        </PortalCard>
      )}

      {/* Attribution & Gift Size Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Attribution Breakdown */}
        {attributionData.length > 0 && (
          <PortalCard>
            <PortalCardHeader>
              <PortalCardTitle className="flex items-center gap-2">
                <PieChart className="h-4 w-4" />
                Attribution by Source
              </PortalCardTitle>
            </PortalCardHeader>
            <PortalCardContent>
              <ResponsivePieChart
                data={attributionData}
                valueType="currency"
                innerRadius={45}
                colors={CHART_COLORS}
              />
            </PortalCardContent>
          </PortalCard>
        )}

        {/* Gift Size Distribution */}
        <PortalCard>
          <PortalCardHeader>
            <PortalCardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Gift Size Distribution
            </PortalCardTitle>
          </PortalCardHeader>
          <PortalCardContent>
            <ResponsiveBarChart
              data={giftSizeData}
              bars={[
                { dataKey: "count", name: "Donations", color: "hsl(var(--portal-accent-blue))" },
              ]}
              valueType="number"
            />
          </PortalCardContent>
        </PortalCard>
      </div>

      {/* Transactions Table with Filters */}
      <PortalCard>
        <PortalCardHeader>
          <div className="flex flex-col gap-3">
            <PortalCardTitle>Recent Transactions</PortalCardTitle>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 portal-text-muted" />
                <Input
                  placeholder="Search by donor, ID, or refcode..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 portal-input h-8 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 portal-text-muted" />
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[110px] h-8 text-xs">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="one-time">One-time</SelectItem>
                    <SelectItem value="recurring">Recurring</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={amountFilter} onValueChange={setAmountFilter}>
                  <SelectTrigger className="w-[110px] h-8 text-xs">
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
        </PortalCardHeader>
        <PortalCardContent>
          <PortalTable
            data={filteredTransactions.slice(0, 100)}
            columns={[
              {
                key: "transaction_date",
                label: "Date",
                sortable: true,
                render: (value) => (
                  <span className="portal-text-secondary text-sm">
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
                    || row.donor_email 
                    || 'Anonymous';
                  return <span className="font-medium portal-text-primary">{displayName}</span>;
                },
              },
              {
                key: "amount",
                label: "Amount",
                sortable: true,
                className: "text-right",
                render: (value) => (
                  <span className="font-semibold portal-text-primary">
                    {PortalTableRenderers.currency(Number(value))}
                  </span>
                ),
              },
              {
                key: "refcode",
                label: "Source",
                className: "text-sm",
                render: (value, row) => (
                  <span className="portal-text-secondary">{value || row.source_campaign || '-'}</span>
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
                <p className="text-sm portal-text-muted">
                  Transactions will appear here once donations are received
                </p>
              )
            }
          />
        </PortalCardContent>
      </PortalCard>
    </div>
  );
};

export default DonationMetrics;
