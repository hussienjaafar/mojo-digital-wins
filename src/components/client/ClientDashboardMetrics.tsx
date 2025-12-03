import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PortalMetric } from "@/components/portal/PortalMetric";
import { PortalCard, PortalCardHeader, PortalCardTitle, PortalCardContent } from "@/components/portal/PortalCard";
import { PortalLineChart } from "@/components/portal/PortalLineChart";
import { PortalBarChart } from "@/components/portal/PortalBarChart";
import { DollarSign, Users, TrendingUp, Repeat, Target, MessageSquare } from "lucide-react";
import { format, parseISO, eachDayOfInterval } from "date-fns";
import { logger } from "@/lib/logger";

interface ClientDashboardMetricsProps {
  organizationId: string;
  startDate: string;
  endDate: string;
}

interface DonationData {
  amount: number;
  donor_email: string;
  is_recurring: boolean;
  transaction_date: string;
  refcode: string | null;
}

interface MetaData {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

interface SMSData {
  date: string;
  messages_sent: number;
  conversions: number;
  cost: number;
  amount_raised: number;
}

export const ClientDashboardMetrics = ({ organizationId, startDate, endDate }: ClientDashboardMetricsProps) => {
  const [donations, setDonations] = useState<DonationData[]>([]);
  const [metaMetrics, setMetaMetrics] = useState<MetaData[]>([]);
  const [smsMetrics, setSmsMetrics] = useState<SMSData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAllData();
  }, [organizationId, startDate, endDate]);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      // Load donations (ActBlue)
      const { data: donationData } = await (supabase as any)
        .from('actblue_transactions')
        .select('amount, donor_email, is_recurring, transaction_date, refcode')
        .eq('organization_id', organizationId)
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate);
      
      setDonations(donationData || []);

      // Load Meta Ads metrics
      const { data: metaData } = await (supabase as any)
        .from('meta_ad_metrics')
        .select('date, spend, impressions, clicks, conversions')
        .eq('organization_id', organizationId)
        .gte('date', startDate)
        .lte('date', endDate);
      
      setMetaMetrics(metaData || []);

      // Load SMS metrics
      const { data: smsData } = await (supabase as any)
        .from('sms_campaign_metrics')
        .select('date, messages_sent, conversions, cost, amount_raised')
        .eq('organization_id', organizationId)
        .gte('date', startDate)
        .lte('date', endDate);
      
      setSmsMetrics(smsData || []);
    } catch (error) {
      logger.error('Failed to load dashboard metrics', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate KPIs
  const kpis = useMemo(() => {
    const totalRaised = donations.reduce((sum, d) => sum + Number(d.amount || 0), 0);
    const uniqueDonors = new Set(donations.map(d => d.donor_email)).size;
    const recurringDonors = donations.filter(d => d.is_recurring).length;
    const recurringPercentage = donations.length > 0 ? (recurringDonors / donations.length) * 100 : 0;
    
    const totalMetaSpend = metaMetrics.reduce((sum, m) => sum + Number(m.spend || 0), 0);
    const totalSMSCost = smsMetrics.reduce((sum, s) => sum + Number(s.cost || 0), 0);
    const totalSpend = totalMetaSpend + totalSMSCost;
    
    const roi = totalSpend > 0 ? totalRaised / totalSpend : 0;
    
    const totalImpressions = metaMetrics.reduce((sum, m) => sum + (m.impressions || 0), 0);
    const totalClicks = metaMetrics.reduce((sum, m) => sum + (m.clicks || 0), 0);
    const avgDonation = donations.length > 0 ? totalRaised / donations.length : 0;

    return {
      totalRaised,
      uniqueDonors,
      recurringPercentage,
      roi,
      totalSpend,
      totalImpressions,
      totalClicks,
      avgDonation,
      donationCount: donations.length,
    };
  }, [donations, metaMetrics, smsMetrics]);

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
      const daySms = smsMetrics.filter(s => s.date === dayStr);

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
      label: "Total Raised",
      value: formatCurrency(kpis.totalRaised),
      icon: DollarSign,
      trend: { value: 0, isPositive: true },
      subtitle: `${kpis.donationCount} donations`,
    },
    {
      label: "Unique Donors",
      value: kpis.uniqueDonors.toLocaleString(),
      icon: Users,
      trend: { value: 0, isPositive: true },
      subtitle: `Avg: ${formatCurrency(kpis.avgDonation)}`,
    },
    {
      label: "Overall ROI",
      value: `${kpis.roi.toFixed(1)}x`,
      icon: TrendingUp,
      trend: { value: 0, isPositive: kpis.roi >= 1 },
      subtitle: `Spend: ${formatCurrency(kpis.totalSpend)}`,
    },
    {
      label: "Recurring Rate",
      value: `${kpis.recurringPercentage.toFixed(0)}%`,
      icon: Repeat,
      trend: { value: 0, isPositive: true },
      subtitle: "Monthly sustainers",
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
                { dataKey: "donations", stroke: "#10B981", name: "Donations" },
                { dataKey: "metaSpend", stroke: "#0D84FF", name: "Meta Spend" },
                { dataKey: "smsSpend", stroke: "#A78BFA", name: "SMS Spend" },
              ]}
              height={280}
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
            <PortalBarChart data={channelBreakdown} height={200} />
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