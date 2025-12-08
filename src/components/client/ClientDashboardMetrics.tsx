import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PortalMetric } from "@/components/portal/PortalMetric";
import { PortalCard, PortalCardHeader, PortalCardTitle, PortalCardContent } from "@/components/portal/PortalCard";
import { PortalLineChart } from "@/components/portal/PortalLineChart";
import { PortalBarChart } from "@/components/portal/PortalBarChart";
import { DollarSign, Users, TrendingUp, Repeat, Target, MessageSquare, Wifi, WifiOff, Wallet } from "lucide-react";
import { format, parseISO, eachDayOfInterval, subDays } from "date-fns";
import { logger } from "@/lib/logger";
import { toast } from "sonner";

interface ClientDashboardMetricsProps {
  organizationId: string;
  startDate: string;
  endDate: string;
}

interface DonationData {
  amount: number;
  net_amount: number | null;
  fee: number | null;
  donor_email: string;
  donor_id_hash?: string | null;
  is_recurring: boolean;
  recurring_upsell_shown: boolean | null;
  recurring_upsell_succeeded: boolean | null;
  transaction_date: string;
  transaction_type?: string | null;  // Track refunds/cancellations
  refcode: string | null;
  source_campaign: string | null;
}

interface MetaData {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

interface SMSData {
  send_date: string;
  messages_sent: number;
  conversions: number;
  cost: number;
  amount_raised: number;
}

export const ClientDashboardMetrics = ({ organizationId, startDate, endDate }: ClientDashboardMetricsProps) => {
  const [donations, setDonations] = useState<DonationData[]>([]);
  const [metaMetrics, setMetaMetrics] = useState<MetaData[]>([]);
  const [smsMetrics, setSmsMetrics] = useState<SMSData[]>([]);
  const [prevDonations, setPrevDonations] = useState<DonationData[]>([]);
  const [prevMetaMetrics, setPrevMetaMetrics] = useState<MetaData[]>([]);
  const [prevSmsMetrics, setPrevSmsMetrics] = useState<SMSData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  // Calculate previous period dates for comparison
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
    loadAllData();
  }, [organizationId, startDate, endDate]);

  const loadAllData = async () => {
    setIsLoading(true);
    const prevPeriod = getPreviousPeriod();
    
    try {
      // Load current period donations (using secure view for defense-in-depth PII protection)
      // Now fetching net_amount, fee, and recurring upsell data for enhanced analytics
      const { data: donationData } = await (supabase as any)
        .from('actblue_transactions_secure')
        .select('amount, net_amount, fee, donor_email, donor_id_hash, is_recurring, recurring_upsell_shown, recurring_upsell_succeeded, transaction_type, transaction_date, refcode, source_campaign')
        .eq('organization_id', organizationId)
        .gte('transaction_date', startDate)
        .lte('transaction_date', `${endDate}T23:59:59`);
      
      setDonations(donationData || []);

      // Load previous period donations (using secure view for defense-in-depth PII protection)
      const { data: prevDonationData } = await (supabase as any)
        .from('actblue_transactions_secure')
        .select('amount, net_amount, fee, donor_email, donor_id_hash, is_recurring, recurring_upsell_shown, recurring_upsell_succeeded, transaction_type, transaction_date, refcode, source_campaign')
        .eq('organization_id', organizationId)
        .gte('transaction_date', prevPeriod.start)
        .lte('transaction_date', `${prevPeriod.end}T23:59:59`);
      
      setPrevDonations(prevDonationData || []);

      // Load current period Meta metrics
      const { data: metaData } = await (supabase as any)
        .from('meta_ad_metrics')
        .select('date, spend, impressions, clicks, conversions')
        .eq('organization_id', organizationId)
        .gte('date', startDate)
        .lte('date', endDate);
      
      setMetaMetrics(metaData || []);

      // Load previous period Meta metrics
      const { data: prevMetaData } = await (supabase as any)
        .from('meta_ad_metrics')
        .select('date, spend, impressions, clicks, conversions')
        .eq('organization_id', organizationId)
        .gte('date', prevPeriod.start)
        .lte('date', prevPeriod.end);
      
      setPrevMetaMetrics(prevMetaData || []);

      // Load current period SMS metrics
      const { data: smsData } = await (supabase as any)
        .from('sms_campaigns')
        .select('send_date, messages_sent, conversions, cost, amount_raised')
        .eq('organization_id', organizationId)
        .gte('send_date', startDate)
        .lte('send_date', `${endDate}T23:59:59`)
        .neq('status', 'draft');
      
      setSmsMetrics(smsData || []);

      // Load previous period SMS metrics
      const { data: prevSmsData } = await (supabase as any)
        .from('sms_campaigns')
        .select('send_date, messages_sent, conversions, cost, amount_raised')
        .eq('organization_id', organizationId)
        .gte('send_date', prevPeriod.start)
        .lte('send_date', `${prevPeriod.end}T23:59:59`)
        .neq('status', 'draft');
      
      setPrevSmsMetrics(prevSmsData || []);
    } catch (error) {
      logger.error('Failed to load dashboard metrics', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Real-time subscription for live donation updates
  useEffect(() => {
    const channel = supabase
      .channel(`dashboard-realtime-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'actblue_transactions',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          logger.info('New donation received via realtime', payload.new);
          const newDonation = payload.new as any;
          
          // Check if donation falls within current date range
          const txDate = newDonation.transaction_date;
          if (txDate >= startDate && txDate <= `${endDate}T23:59:59`) {
            setDonations(prev => [{
              amount: newDonation.amount,
              net_amount: newDonation.fee != null ? newDonation.amount - newDonation.fee : newDonation.amount,
              fee: newDonation.fee,
              donor_email: newDonation.donor_email,
              donor_id_hash: newDonation.donor_id_hash || newDonation.donor_email || null,
              is_recurring: newDonation.is_recurring,
              recurring_upsell_shown: newDonation.recurring_upsell_shown,
              recurring_upsell_succeeded: newDonation.recurring_upsell_succeeded,
              transaction_date: newDonation.transaction_date,
              transaction_type: newDonation.transaction_type || 'donation',
              refcode: newDonation.refcode,
              source_campaign: newDonation.source_campaign,
            }, ...prev]);
            
            toast.success(`New donation: $${Number(newDonation.amount).toFixed(2)}`, {
              description: newDonation.donor_name || 'Anonymous donor',
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsRealtimeConnected(true);
          logger.info('Dashboard realtime connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setIsRealtimeConnected(false);
          logger.warn('Dashboard realtime disconnected');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, startDate, endDate]);

  // Calculate percentage change
  const calcChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  // Calculate KPIs for current period - now with net revenue and upsell metrics
  const kpis = useMemo(() => {
    const totalRaised = donations.reduce((sum, d) => sum + Number(d.amount || 0), 0);
    // Net revenue = gross - fees (using net_amount when available)
    const totalNetRevenue = donations.reduce((sum, d) => sum + Number(d.net_amount ?? d.amount ?? 0), 0);
    const totalFees = donations.reduce((sum, d) => sum + Number(d.fee || 0), 0);
    const feePercentage = totalRaised > 0 ? (totalFees / totalRaised) * 100 : 0;
    const refunds = donations.filter(d => d.transaction_type === 'refund');
    const refundAmount = refunds.reduce((sum, d) => sum + Number(d.net_amount ?? d.amount ?? 0), 0);
    const refundRate = totalRaised > 0 ? (refundAmount / totalRaised) * 100 : 0;
    
    const uniqueDonors = new Set(donations.map(d => d.donor_id_hash || d.donor_email)).size;
    const recurringDonors = donations.filter(d => d.is_recurring).length;
    const recurringPercentage = donations.length > 0 ? (recurringDonors / donations.length) * 100 : 0;
    
    // Recurring upsell metrics
    const upsellShown = donations.filter(d => d.recurring_upsell_shown).length;
    const upsellSucceeded = donations.filter(d => d.recurring_upsell_succeeded).length;
    const upsellConversionRate = upsellShown > 0 ? (upsellSucceeded / upsellShown) * 100 : 0;
    
    // Attribution breakdown by source
    const bySource = donations.reduce((acc, d) => {
      const source = d.source_campaign || 'direct';
      acc[source] = (acc[source] || 0) + Number(d.amount || 0);
      return acc;
    }, {} as Record<string, number>);
    
    const totalMetaSpend = metaMetrics.reduce((sum, m) => sum + Number(m.spend || 0), 0);
    const totalSMSCost = smsMetrics.reduce((sum, s) => sum + Number(s.cost || 0), 0);
    const totalSpend = totalMetaSpend + totalSMSCost;
    
    // Use net revenue for accurate ROI calculation
    const roi = totalSpend > 0 ? totalNetRevenue / totalSpend : 0;
    
    const totalImpressions = metaMetrics.reduce((sum, m) => sum + (m.impressions || 0), 0);
    const totalClicks = metaMetrics.reduce((sum, m) => sum + (m.clicks || 0), 0);
    const avgDonation = donations.length > 0 ? totalRaised / donations.length : 0;

    return {
      totalRaised,
      totalNetRevenue,
      totalFees,
      feePercentage,
      refundAmount,
      refundRate,
      uniqueDonors,
      recurringPercentage,
      upsellConversionRate,
      roi,
      totalSpend,
      totalImpressions,
      totalClicks,
      avgDonation,
      donationCount: donations.length,
      revenueBySource: bySource,
    };
  }, [donations, metaMetrics, smsMetrics]);

  // Calculate KPIs for previous period
  const prevKpis = useMemo(() => {
    const totalRaised = prevDonations.reduce((sum, d) => sum + Number(d.amount || 0), 0);
    const totalNetRevenue = prevDonations.reduce((sum, d) => sum + Number(d.net_amount ?? d.amount ?? 0), 0);
    const refunds = prevDonations.filter(d => d.transaction_type === 'refund');
    const refundAmount = refunds.reduce((sum, d) => sum + Number(d.net_amount ?? d.amount ?? 0), 0);
    const refundRate = totalRaised > 0 ? (refundAmount / totalRaised) * 100 : 0;
    const uniqueDonors = new Set(prevDonations.map(d => d.donor_id_hash || d.donor_email)).size;
    const recurringDonors = prevDonations.filter(d => d.is_recurring).length;
    const recurringPercentage = prevDonations.length > 0 ? (recurringDonors / prevDonations.length) * 100 : 0;
    
    const totalMetaSpend = prevMetaMetrics.reduce((sum, m) => sum + Number(m.spend || 0), 0);
    const totalSMSCost = prevSmsMetrics.reduce((sum, s) => sum + Number(s.cost || 0), 0);
    const totalSpend = totalMetaSpend + totalSMSCost;
    
    const roi = totalSpend > 0 ? totalNetRevenue / totalSpend : 0;

    return {
      totalRaised,
      totalNetRevenue,
      refundAmount,
      refundRate,
      uniqueDonors,
      recurringPercentage,
      roi,
      totalSpend,
    };
  }, [prevDonations, prevMetaMetrics, prevSmsMetrics]);

  // Build time series data for charts
  const timeSeriesData = useMemo(() => {
    const days = eachDayOfInterval({
      start: parseISO(startDate),
      end: parseISO(endDate),
    });

    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayLabel = format(day, 'MMM d');
      
      const dayDonations = donations.filter(d => d.transaction_date?.startsWith(dayStr));
      const dayMeta = metaMetrics.filter(m => m.date === dayStr);
      const daySms = smsMetrics.filter(s => s.send_date?.startsWith(dayStr));

      return {
        name: dayLabel,
        donations: dayDonations.reduce((sum, d) => sum + Number(d.amount || 0), 0),
        metaSpend: dayMeta.reduce((sum, m) => sum + Number(m.spend || 0), 0),
        smsSpend: daySms.reduce((sum, s) => sum + Number(s.cost || 0), 0),
      };
    });
  }, [donations, metaMetrics, smsMetrics, startDate, endDate]);

  // Channel breakdown for bar chart
  const channelBreakdown = useMemo(() => {
    const metaConversions = metaMetrics.reduce((sum, m) => sum + (m.conversions || 0), 0);
    const smsConversions = smsMetrics.reduce((sum, s) => sum + (s.conversions || 0), 0);
    const directDonations = donations.filter(d => !d.refcode).length;

    return [
      { name: "Meta Ads", value: metaConversions, label: `${metaConversions}` },
      { name: "SMS", value: smsConversions, label: `${smsConversions}` },
      { name: "Direct", value: directDonations, label: `${directDonations}` },
    ];
  }, [donations, metaMetrics, smsMetrics]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  };

  const heroKpis = [
    {
      label: "Net Revenue",
      value: formatCurrency(kpis.totalNetRevenue),
      icon: Wallet,
      trend: { value: Math.round(calcChange(kpis.totalNetRevenue, prevKpis.totalNetRevenue)), isPositive: kpis.totalNetRevenue >= prevKpis.totalNetRevenue },
      subtitle: `Gross: ${formatCurrency(kpis.totalRaised)} (${kpis.feePercentage.toFixed(1)}% fees)`,
    },
    {
      label: "Unique Donors",
      value: kpis.uniqueDonors.toLocaleString(),
      icon: Users,
      trend: { value: Math.round(calcChange(kpis.uniqueDonors, prevKpis.uniqueDonors)), isPositive: kpis.uniqueDonors >= prevKpis.uniqueDonors },
      subtitle: `Avg: ${formatCurrency(kpis.avgDonation)}`,
    },
    {
      label: "Net ROI",
      value: `${kpis.roi.toFixed(1)}x`,
      icon: TrendingUp,
      trend: { value: Math.round(calcChange(kpis.roi, prevKpis.roi)), isPositive: kpis.roi >= prevKpis.roi },
      subtitle: `Spend: ${formatCurrency(kpis.totalSpend)}`,
    },
    {
      label: "Recurring Rate",
      value: `${kpis.recurringPercentage.toFixed(0)}%`,
      icon: Repeat,
      trend: { value: Math.round(calcChange(kpis.recurringPercentage, prevKpis.recurringPercentage)), isPositive: kpis.recurringPercentage >= prevKpis.recurringPercentage },
      subtitle: kpis.upsellConversionRate > 0 ? `${kpis.upsellConversionRate.toFixed(0)}% upsell conv.` : "Monthly sustainers",
    },
    {
      label: "Refund Rate",
      value: `${kpis.refundRate.toFixed(1)}%`,
      icon: Target,
      trend: { value: Math.round(calcChange(kpis.refundRate, prevKpis.refundRate)), isPositive: kpis.refundRate <= prevKpis.refundRate },
      subtitle: `Refunds: ${formatCurrency(kpis.refundAmount)}`,
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="portal-card p-6 animate-pulse">
              <div className="h-4 w-24 bg-[hsl(var(--portal-bg-elevated))] rounded mb-3" />
              <div className="h-8 w-20 bg-[hsl(var(--portal-bg-elevated))] rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Realtime Connection Indicator */}
      <div className="flex items-center gap-2 text-sm">
        {isRealtimeConnected ? (
          <>
            <Wifi className="h-4 w-4 text-emerald-500" />
            <span className="portal-text-muted">Live updates enabled</span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4 portal-text-muted" />
            <span className="portal-text-muted">Connecting...</span>
          </>
        )}
      </div>

      {/* Hero KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {heroKpis.map((metric, index) => (
          <PortalMetric
            key={metric.label}
            label={metric.label}
            value={metric.value}
            icon={metric.icon}
            trend={metric.trend}
            subtitle={metric.subtitle}
            className={`portal-delay-${index * 100}`}
          />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fundraising Trend - Main Chart */}
        <PortalCard className="lg:col-span-2 portal-animate-slide-in-left">
          <PortalCardHeader>
            <PortalCardTitle>Fundraising Performance</PortalCardTitle>
            <div className="flex items-center gap-6 mt-3">
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold portal-text-primary">{formatCurrency(kpis.totalRaised)}</div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-[#10B981]" />
                  <span className="text-xs portal-text-muted">Donations</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold portal-text-primary">{formatCurrency(kpis.totalSpend)}</div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-[#0D84FF]" />
                  <span className="text-xs portal-text-muted">Meta Spend</span>
                </div>
              </div>
            </div>
          </PortalCardHeader>
          <PortalCardContent>
            <PortalLineChart
              data={timeSeriesData}
              lines={[
                { dataKey: "donations", stroke: "#10B981", name: "Donations", valueType: "currency" },
                { dataKey: "metaSpend", stroke: "#0D84FF", name: "Meta Spend", valueType: "currency" },
                { dataKey: "smsSpend", stroke: "#A78BFA", name: "SMS Spend", valueType: "currency" },
              ]}
              height={280}
              valueType="currency"
            />
          </PortalCardContent>
        </PortalCard>

        {/* Channel Performance Summary */}
        <PortalCard className="portal-animate-slide-in-right portal-delay-100">
          <PortalCardHeader>
            <PortalCardTitle>Channel Performance</PortalCardTitle>
            <p className="text-sm portal-text-muted mt-1">Conversions by source</p>
          </PortalCardHeader>
          <PortalCardContent>
            <div className="space-y-4">
              {/* Meta Ads */}
              <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'hsl(var(--portal-bg-elevated))' }}>
                <div className="p-2 rounded-lg bg-[#0D84FF]/10">
                  <Target className="h-4 w-4 text-[#0D84FF]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium portal-text-primary">Meta Ads</p>
                  <p className="text-xs portal-text-muted">
                    {formatCurrency(metaMetrics.reduce((s, m) => s + Number(m.spend || 0), 0))} spent
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold portal-text-primary">
                    {metaMetrics.reduce((s, m) => s + (m.conversions || 0), 0)}
                  </p>
                  <p className="text-xs portal-text-muted">conversions</p>
                </div>
              </div>

              {/* SMS */}
              <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'hsl(var(--portal-bg-elevated))' }}>
                <div className="p-2 rounded-lg bg-[#A78BFA]/10">
                  <MessageSquare className="h-4 w-4 text-[#A78BFA]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium portal-text-primary">SMS Campaigns</p>
                  <p className="text-xs portal-text-muted">
                    {smsMetrics.reduce((s, m) => s + (m.messages_sent || 0), 0).toLocaleString()} sent
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold portal-text-primary">
                    {smsMetrics.reduce((s, m) => s + (m.conversions || 0), 0)}
                  </p>
                  <p className="text-xs portal-text-muted">conversions</p>
                </div>
              </div>

              {/* Direct */}
              <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'hsl(var(--portal-bg-elevated))' }}>
                <div className="p-2 rounded-lg bg-[#10B981]/10">
                  <DollarSign className="h-4 w-4 text-[#10B981]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium portal-text-primary">Direct Donations</p>
                  <p className="text-xs portal-text-muted">No attribution</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold portal-text-primary">
                    {donations.filter(d => !d.refcode).length}
                  </p>
                  <p className="text-xs portal-text-muted">donations</p>
                </div>
              </div>
            </div>
          </PortalCardContent>
        </PortalCard>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversion Sources Bar Chart */}
        <PortalCard className="lg:col-span-2 portal-animate-fade-in portal-delay-200">
          <PortalCardHeader>
            <PortalCardTitle>Conversion Sources</PortalCardTitle>
          </PortalCardHeader>
          <PortalCardContent>
            <PortalBarChart data={channelBreakdown} height={200} valueType="number" />
          </PortalCardContent>
        </PortalCard>

        {/* Quick Stats */}
        <PortalCard className="portal-animate-scale-in portal-delay-300">
          <PortalCardHeader>
            <PortalCardTitle>Campaign Health</PortalCardTitle>
            <p className="text-sm portal-text-muted mt-1">Key efficiency metrics</p>
          </PortalCardHeader>
          <PortalCardContent className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-[hsl(var(--portal-border))]">
              <span className="text-sm portal-text-muted">Average Donation</span>
              <span className="text-sm font-semibold portal-text-primary">{formatCurrency(kpis.avgDonation)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[hsl(var(--portal-border))]">
              <span className="text-sm portal-text-muted">Total Impressions</span>
              <span className="text-sm font-semibold portal-text-primary">{kpis.totalImpressions.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[hsl(var(--portal-border))]">
              <span className="text-sm portal-text-muted">Total Clicks</span>
              <span className="text-sm font-semibold portal-text-primary">{kpis.totalClicks.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm portal-text-muted">Cost Per Donor</span>
              <span className="text-sm font-semibold portal-text-primary">
                {kpis.uniqueDonors > 0 ? formatCurrency(kpis.totalSpend / kpis.uniqueDonors) : '$0'}
              </span>
            </div>
          </PortalCardContent>
        </PortalCard>
      </div>
    </div>
  );
};
