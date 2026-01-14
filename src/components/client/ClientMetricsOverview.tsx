import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, DollarSign, Users, Target } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { logger } from "@/lib/logger";
import { CurrencyChartTooltip, PercentageChartTooltip } from "@/components/charts/CustomChartTooltip";
import { PortalSkeleton } from "@/components/portal/PortalSkeleton";
import { NoDataEmptyState } from "@/components/portal/PortalEmptyState";

type Props = {
  organizationId: string;
  startDate: string;
  endDate: string;
};

type AggregatedMetrics = {
  date: string;
  total_ad_spend: number;
  total_sms_cost: number;
  total_funds_raised: number;
  total_donations: number;
  roi_percentage: number;
};

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))'];

const ClientMetricsOverview = ({ organizationId, startDate, endDate }: Props) => {
  const [metrics, setMetrics] = useState<AggregatedMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, [organizationId, startDate, endDate]);

  const loadMetrics = async () => {
    setIsLoading(true);
    try {
      // Query canonical sources instead of legacy daily_aggregated_metrics
      const [actblueResult, metaResult, smsResult] = await Promise.all([
        // ActBlue transactions
        (supabase as any)
          .from('actblue_transactions_secure')
          .select('amount, transaction_date')
          .eq('organization_id', organizationId)
          .gte('transaction_date', startDate)
          .lte('transaction_date', `${endDate}T23:59:59`),
        // Meta ad metrics
        (supabase as any)
          .from('meta_ad_metrics')
          .select('date, spend')
          .eq('organization_id', organizationId)
          .gte('date', startDate)
          .lte('date', endDate),
        // SMS campaigns
        (supabase as any)
          .from('sms_campaigns')
          .select('send_date, cost')
          .eq('organization_id', organizationId)
          .neq('status', 'draft')
          .gte('send_date', startDate)
          .lte('send_date', `${endDate}T23:59:59`),
      ]);

      const actblueData = actblueResult.data || [];
      const metaData = metaResult.data || [];
      const smsData = smsResult.data || [];

      // Group ActBlue by date
      const actblueByDate: Record<string, { raised: number; count: number }> = {};
      actblueData.forEach((t: any) => {
        const dateKey = t.transaction_date?.split('T')[0];
        if (!dateKey) return;
        if (!actblueByDate[dateKey]) {
          actblueByDate[dateKey] = { raised: 0, count: 0 };
        }
        actblueByDate[dateKey].raised += Number(t.amount) || 0;
        actblueByDate[dateKey].count += 1;
      });

      // Group Meta by date
      const metaByDate: Record<string, number> = {};
      metaData.forEach((m: any) => {
        const dateKey = m.date;
        if (!dateKey) return;
        metaByDate[dateKey] = (metaByDate[dateKey] || 0) + (Number(m.spend) || 0);
      });

      // Group SMS by date
      const smsByDate: Record<string, number> = {};
      smsData.forEach((s: any) => {
        const dateKey = s.send_date?.split('T')[0];
        if (!dateKey) return;
        smsByDate[dateKey] = (smsByDate[dateKey] || 0) + (Number(s.cost) || 0);
      });

      // Build combined metrics by date
      const allDates = new Set([
        ...Object.keys(actblueByDate),
        ...Object.keys(metaByDate),
        ...Object.keys(smsByDate),
      ]);

      const combinedMetrics: AggregatedMetrics[] = Array.from(allDates)
        .sort()
        .map((dateKey) => {
          const actblue = actblueByDate[dateKey] || { raised: 0, count: 0 };
          const adSpend = metaByDate[dateKey] || 0;
          const smsCost = smsByDate[dateKey] || 0;
          const totalSpend = adSpend + smsCost;
          const roi = totalSpend > 0 ? ((actblue.raised - totalSpend) / totalSpend) * 100 : 0;

          return {
            date: dateKey,
            total_ad_spend: adSpend,
            total_sms_cost: smsCost,
            total_funds_raised: actblue.raised,
            total_donations: actblue.count,
            roi_percentage: roi,
          };
        });

      setMetrics(combinedMetrics);
    } catch (error) {
      logger.error('Failed to load metrics', error);
    } finally {
      setIsLoading(false);
    }
  };

  const totalRaised = metrics.reduce((sum, m) => sum + Number(m.total_funds_raised || 0), 0);
  const totalSpent = metrics.reduce((sum, m) => sum + Number(m.total_ad_spend || 0) + Number(m.total_sms_cost || 0), 0);
  const totalDonations = metrics.reduce((sum, m) => sum + Number(m.total_donations || 0), 0);
  const avgROI = totalSpent > 0 ? ((totalRaised - totalSpent) / totalSpent * 100) : 0;

  const spendByChannel = [
    { name: 'Meta Ads', value: metrics.reduce((sum, m) => sum + Number(m.total_ad_spend || 0), 0) },
    { name: 'SMS', value: metrics.reduce((sum, m) => sum + Number(m.total_sms_cost || 0), 0) },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <PortalSkeleton key={i} variant="metric" className={`portal-delay-${i * 100}`} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PortalSkeleton variant="chart" />
          <PortalSkeleton variant="chart" />
        </div>
        <PortalSkeleton variant="chart" />
      </div>
    );
  }

  if (metrics.length === 0) {
    return <NoDataEmptyState onRefresh={loadMetrics} />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* KPI Cards - Enhanced with Claude Console Design */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card variant="elevated" className="animate-fade-in-up" style={{ animationDelay: '0ms' }}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Raised</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRaised.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalDonations} donations
            </p>
          </CardContent>
        </Card>

        <Card variant="elevated" className="animate-fade-in-up" style={{ animationDelay: '50ms' }}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Spent</CardTitle>
            <Target className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalSpent.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all channels
            </p>
          </CardContent>
        </Card>

        <Card variant="elevated" className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">ROI</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgROI.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Return on investment
            </p>
          </CardContent>
        </Card>

        <Card variant="elevated" className="animate-fade-in-up" style={{ animationDelay: '150ms' }}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Donation</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalDonations > 0 ? (totalRaised / totalDonations).toFixed(2) : '0.00'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Per donor
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts - Enhanced with Smooth Variant */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card variant="smooth" className="animate-slide-in-left">
          <CardHeader className="pb-3 sm:pb-4">
            <CardTitle className="text-base sm:text-lg">Funds Raised Over Time</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip content={<CurrencyChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="total_funds_raised"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  name="Funds Raised"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card variant="smooth" className="animate-slide-in-right">
          <CardHeader className="pb-3 sm:pb-4">
            <CardTitle className="text-base sm:text-lg">Spend by Channel</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={spendByChannel}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: $${value.toLocaleString()}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {spendByChannel.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CurrencyChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ROI Trend - Enhanced with Smooth Variant */}
      <Card variant="smooth" className="animate-fade-in">
        <CardHeader className="pb-3 sm:pb-4">
          <CardTitle className="text-base sm:text-lg">ROI Trend</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={metrics}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip content={<PercentageChartTooltip />} />
              <Line
                type="monotone"
                dataKey="roi_percentage"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                name="ROI %"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientMetricsOverview;
