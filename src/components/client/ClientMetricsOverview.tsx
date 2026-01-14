import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { V3Card, V3CardContent, V3CardHeader, V3CardTitle } from "@/components/v3/V3Card";
import { V3KPICard } from "@/components/v3/V3KPICard";
import { V3ChartWrapper } from "@/components/v3/V3ChartWrapper";
import { TrendingUp, DollarSign, Users, Target } from "lucide-react";
import { logger } from "@/lib/logger";
import { PortalSkeleton } from "@/components/portal/PortalSkeleton";
import { EChartsLineChart, V3DonutChart } from "@/components/charts/echarts";
import { NoDataEmptyState } from "@/components/portal/PortalEmptyState";
import { formatCurrency, formatPercent } from "@/lib/chart-formatters";
import type { DailyRollupRow, PeriodSummary } from "@/queries/useActBlueDailyRollupQuery";

type Props = {
  organizationId: string;
  startDate: string;
  endDate: string;
};

// Combined data from canonical rollup + Meta/SMS spend
type DailyMetrics = {
  date: string;
  net_revenue: number;
  donation_count: number;
  meta_spend: number;
  sms_cost: number;
  roi_percentage: number;
};

const ClientMetricsOverview = ({ organizationId, startDate, endDate }: Props) => {
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetrics[]>([]);
  const [summary, setSummary] = useState<PeriodSummary | null>(null);
  const [totalMetaSpend, setTotalMetaSpend] = useState(0);
  const [totalSmsSpend, setTotalSmsSpend] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, [organizationId, startDate, endDate]);

  const loadMetrics = async () => {
    setIsLoading(true);
    try {
      // Fetch data from CANONICAL ROLLUP (single source of truth for ActBlue metrics)
      // Plus Meta and SMS spend from their respective tables
      const [
        { data: rollupData, error: rollupError },
        { data: summaryData, error: summaryError },
        { data: metaData, error: metaError },
        { data: smsData, error: smsError },
      ] = await Promise.all([
        // Canonical daily rollup - timezone-aware, SINGLE SOURCE OF TRUTH
        (supabase as any).rpc('get_actblue_daily_rollup', {
          _organization_id: organizationId,
          _start_date: startDate,
          _end_date: endDate,
        }),
        // Canonical period summary
        (supabase as any).rpc('get_actblue_period_summary', {
          _organization_id: organizationId,
          _start_date: startDate,
          _end_date: endDate,
        }),
        // Meta ad spend by day
        (supabase as any)
          .from('meta_ad_metrics')
          .select('date, spend')
          .eq('organization_id', organizationId)
          .gte('date', startDate)
          .lte('date', endDate),
        // SMS cost by day
        (supabase as any)
          .from('sms_campaigns')
          .select('send_date, cost')
          .eq('organization_id', organizationId)
          .gte('send_date', startDate)
          .lte('send_date', endDate)
          .neq('status', 'draft'),
      ]);

      if (rollupError) throw rollupError;
      if (summaryError) throw summaryError;
      if (metaError) throw metaError;
      if (smsError) throw smsError;

      // Process canonical summary
      const summaryRow = summaryData?.[0] || {};
      const periodSummary: PeriodSummary = {
        gross_raised: Number(summaryRow.gross_raised) || 0,
        net_raised: Number(summaryRow.net_raised) || 0,
        refunds: Number(summaryRow.refunds) || 0,
        net_revenue: Number(summaryRow.net_revenue) || 0,
        total_fees: Number(summaryRow.total_fees) || 0,
        donation_count: Number(summaryRow.donation_count) || 0,
        unique_donors_approx: Number(summaryRow.unique_donors_approx) || 0,
        refund_count: Number(summaryRow.refund_count) || 0,
        recurring_count: Number(summaryRow.recurring_count) || 0,
        one_time_count: Number(summaryRow.one_time_count) || 0,
        recurring_revenue: Number(summaryRow.recurring_revenue) || 0,
        one_time_revenue: Number(summaryRow.one_time_revenue) || 0,
        avg_fee_percentage: Number(summaryRow.avg_fee_percentage) || 0,
        refund_rate: Number(summaryRow.refund_rate) || 0,
        avg_donation: Number(summaryRow.avg_donation) || 0,
        days_with_donations: Number(summaryRow.days_with_donations) || 0,
      };
      setSummary(periodSummary);

      // Index Meta spend by day
      const metaByDay = new Map<string, number>();
      (metaData || []).forEach((m: any) => {
        const current = metaByDay.get(m.date) || 0;
        metaByDay.set(m.date, current + Number(m.spend || 0));
      });

      // Index SMS cost by day
      const smsByDay = new Map<string, number>();
      (smsData || []).forEach((s: any) => {
        const current = smsByDay.get(s.send_date) || 0;
        smsByDay.set(s.send_date, current + Number(s.cost || 0));
      });

      // Calculate totals
      const metaSpendTotal = Array.from(metaByDay.values()).reduce((sum, v) => sum + v, 0);
      const smsSpendTotal = Array.from(smsByDay.values()).reduce((sum, v) => sum + v, 0);
      setTotalMetaSpend(metaSpendTotal);
      setTotalSmsSpend(smsSpendTotal);

      // Combine canonical rollup with spend data
      const combined: DailyMetrics[] = (rollupData || []).map((row: any) => {
        const netRevenue = Number(row.net_revenue) || 0;
        const metaSpend = metaByDay.get(row.day) || 0;
        const smsSpend = smsByDay.get(row.day) || 0;
        const totalSpend = metaSpend + smsSpend;
        const roi = totalSpend > 0 ? ((netRevenue - totalSpend) / totalSpend) * 100 : 0;

        return {
          date: row.day,
          net_revenue: netRevenue,
          donation_count: Number(row.donation_count) || 0,
          meta_spend: metaSpend,
          sms_cost: smsSpend,
          roi_percentage: roi,
        };
      });

      setDailyMetrics(combined);

      logger.debug('ClientMetricsOverview using canonical rollup', {
        netRevenue: periodSummary.net_revenue,
        donations: periodSummary.donation_count,
        metaSpend: metaSpendTotal,
        smsSpend: smsSpendTotal,
      });
    } catch (error) {
      logger.error('Failed to load metrics', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Use canonical rollup summary for KPIs
  const totalNetRevenue = summary?.net_revenue || 0;
  const totalSpent = totalMetaSpend + totalSmsSpend;
  const totalDonations = summary?.donation_count || 0;
  const avgROI = totalSpent > 0 ? ((totalNetRevenue - totalSpent) / totalSpent * 100) : 0;

  const spendByChannel = [
    { name: 'Meta Ads', value: totalMetaSpend },
    { name: 'SMS', value: totalSmsSpend },
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

  if (dailyMetrics.length === 0) {
    return <NoDataEmptyState onRefresh={loadMetrics} />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* KPI Cards - Enhanced with V3 Design */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <V3KPICard
          icon={DollarSign}
          label="Net Revenue"
          value={formatCurrency(totalNetRevenue, false)}
          subtitle={`${totalDonations} donations (after fees & refunds)`}
          accent="green"
        />
        <V3KPICard
          icon={Target}
          label="Total Spent"
          value={formatCurrency(totalSpent, false)}
          subtitle="Across all channels"
          accent="amber"
        />
        <V3KPICard
          icon={TrendingUp}
          label="ROI"
          value={formatPercent(avgROI / 100, 1)}
          subtitle="Return on investment"
          accent="blue"
        />
        <V3KPICard
          icon={Users}
          label="Avg Net Donation"
          value={formatCurrency(totalDonations > 0 ? totalNetRevenue / totalDonations : 0, false)}
          subtitle="Per donor (after fees)"
          accent="purple"
        />
      </div>

      {/* Charts - Enhanced with V3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <V3ChartWrapper
          title="Net Revenue Over Time"
          ariaLabel="Line chart showing net revenue over time"
          accent="green"
        >
          <EChartsLineChart
            data={dailyMetrics}
            xAxisKey="date"
            series={[
              {
                dataKey: "net_revenue",
                name: "Net Revenue",
                color: "hsl(var(--primary))",
                type: "area",
                areaStyle: { opacity: 0.1 },
              },
            ]}
            height={250}
            valueType="currency"
            showLegend={false}
          />
        </V3ChartWrapper>

        <V3ChartWrapper
          title="Spend by Channel"
          ariaLabel="Donut chart showing spend breakdown by channel"
          accent="blue"
        >
          <V3DonutChart
            data={spendByChannel}
            height={250}
            valueType="currency"
            centerLabel="Total Spend"
            legendPosition="right"
            topN={6}
          />
        </V3ChartWrapper>
      </div>

      {/* ROI Trend - Enhanced with V3 */}
      <V3ChartWrapper
        title="ROI Trend"
        ariaLabel="Line chart showing ROI trend over time"
        accent="purple"
      >
        <EChartsLineChart
          data={dailyMetrics}
          xAxisKey="date"
          series={[
            {
              dataKey: "roi_percentage",
              name: "ROI %",
              color: "hsl(var(--primary))",
            },
          ]}
          height={250}
          valueType="percent"
          showLegend={false}
        />
      </V3ChartWrapper>
    </div>
  );
};

export default ClientMetricsOverview;
