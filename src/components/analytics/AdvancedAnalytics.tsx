import { useMemo, useState } from 'react';
import { 
  V3Card, 
  V3CardContent, 
  V3CardDescription, 
  V3CardHeader, 
  V3CardTitle,
  V3KPICard,
  V3LoadingState,
} from '@/components/v3';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Download, TrendingUp, Users, DollarSign } from 'lucide-react';
import { useRealtimeMetrics } from '@/hooks/useRealtimeMetrics';
import { TrendChart } from './TrendChart';
import { FunnelChart } from './FunnelChart';
import { ComparisonChart } from './ComparisonChart';
import { AttributionChart } from './AttributionChart';
import {
  forecastTrend,
  calculateCAC,
  calculateLTV,
  groupByPeriod,
  calculateChannelContribution,
  exportToCSV,
  calculateTrend,
} from '@/lib/analytics';
import { format, subDays, parseISO } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';

type Props = {
  organizationId: string;
  startDate: string;
  endDate: string;
};

export default function AdvancedAnalytics({ organizationId, startDate, endDate }: Props) {
  const { metaMetrics, smsMetrics, transactions, roiAnalytics, isLoading } = useRealtimeMetrics(
    organizationId,
    startDate,
    endDate
  );
  const [activeTab, setActiveTab] = useState('attribution');
  const isMobile = useIsMobile();
  const { toast } = useToast();

  // Normalize data to have a common 'date' field for grouping
  const normalizedData = useMemo(() => {
    const metaNorm = metaMetrics.map(m => ({ ...m, _date: m.date, _type: 'meta' as const }));
    const smsNorm = smsMetrics.map(m => ({ ...m, _date: m.send_date || '', _type: 'sms' as const }));
    const txNorm = transactions.map(t => ({ ...t, _date: t.transaction_date?.split('T')[0] || '', _type: 'transaction' as const }));
    return [...metaNorm, ...smsNorm, ...txNorm].filter(item => item._date);
  }, [metaMetrics, smsMetrics, transactions]);

  // Calculate daily aggregated data
  const dailyData = useMemo(() => {
    return groupByPeriod(
      normalizedData,
      '_date',
      'day',
      (items) => {
        const metaSpend = items
          .filter((i: any) => i._type === 'meta')
          .reduce((sum, i: any) => sum + Number(i.spend || 0), 0);
        
        const smsSpend = items
          .filter((i: any) => i._type === 'sms')
          .reduce((sum, i: any) => sum + Number(i.cost || 0), 0);
        
        const revenue = items
          .filter((i: any) => i._type === 'transaction')
          .reduce((sum, i: any) => sum + Number(i.amount || 0), 0);
        
        const conversions = items.filter((i: any) => i._type === 'transaction').length;

        return {
          totalSpend: metaSpend + smsSpend,
          revenue,
          conversions,
          roi: metaSpend + smsSpend > 0 
            ? ((revenue - (metaSpend + smsSpend)) / (metaSpend + smsSpend)) * 100 
            : 0,
        };
      }
    ).sort((a, b) => a.period.localeCompare(b.period));
  }, [normalizedData]);

  // Revenue forecast
  const revenueForecast = useMemo(() => {
    const historicalData = dailyData.map(d => ({
      date: d.period,
      value: d.revenue,
    }));
    return forecastTrend(historicalData, 7);
  }, [dailyData]);

  // Conversion funnel
  const funnelData = useMemo(() => {
    const impressions = metaMetrics.reduce((sum, m) => sum + Number(m.impressions || 0), 0);
    const clicks = metaMetrics.reduce((sum, m) => sum + Number(m.clicks || 0), 0);
    const smsDelivered = smsMetrics.reduce((sum, m) => sum + Number(m.messages_delivered || 0), 0);
    const smsClicks = smsMetrics.reduce((sum, m) => sum + Number(m.clicks || 0), 0);
    const donations = transactions.length;

    return [
      { name: 'Impressions', value: impressions, color: 'hsl(var(--chart-1))' },
      { name: 'Ad Clicks', value: clicks, color: 'hsl(var(--chart-2))' },
      { name: 'SMS Delivered', value: smsDelivered, color: 'hsl(var(--chart-3))' },
      { name: 'SMS Clicks', value: smsClicks, color: 'hsl(var(--chart-4))' },
      { name: 'Donations', value: donations, color: 'hsl(var(--chart-5))' },
    ];
  }, [metaMetrics, smsMetrics, transactions]);

  // Attribution analysis
  const attributionData = useMemo(() => {
    // Group by campaign and platform
    const grouped = roiAnalytics.reduce((acc, roi) => {
      const key = `${roi.platform}-${roi.campaign_id}`;
      if (!acc[key]) {
        acc[key] = {
          touchpoint: roi.campaign_id,
          platform: roi.platform,
          firstTouch: 0,
          lastTouch: 0,
          linear: 0,
          positionBased: 0,
          timeDecay: 0,
        };
      }
      acc[key].firstTouch += Number(roi.first_touch_attribution || 0);
      acc[key].lastTouch += Number(roi.last_touch_attribution || 0);
      acc[key].linear += Number(roi.linear_attribution || 0);
      acc[key].positionBased += Number(roi.position_based_attribution || 0);
      acc[key].timeDecay += Number(roi.time_decay_attribution || 0);
      return acc;
    }, {} as Record<string, {
      touchpoint: string;
      platform: string;
      firstTouch: number;
      lastTouch: number;
      linear: number;
      positionBased: number;
      timeDecay: number;
    }>);

    return Object.values(grouped);
  }, [roiAnalytics]);

  // Channel contribution
  const channelContribution = useMemo(() => {
    const metaConversions = metaMetrics.reduce((sum, m) => sum + Number(m.conversions || 0), 0);
    const metaSpend = metaMetrics.reduce((sum, m) => sum + Number(m.spend || 0), 0);
    
    const smsConversions = smsMetrics.reduce((sum, m) => sum + Number(m.conversions || 0), 0);
    const smsSpend = smsMetrics.reduce((sum, m) => sum + Number(m.cost || 0), 0);

    return calculateChannelContribution([
      { name: 'Meta Ads', conversions: metaConversions, spend: metaSpend },
      { name: 'SMS', conversions: smsConversions, spend: smsSpend },
    ]);
  }, [metaMetrics, smsMetrics]);

  // Period comparison data
  const comparisonData = useMemo(() => {
    const daysDiff = Math.abs(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    const previousStart = format(subDays(new Date(startDate), daysDiff), 'yyyy-MM-dd');
    const previousEnd = format(subDays(new Date(endDate), daysDiff), 'yyyy-MM-dd');

    // Current period data is already in dailyData
    // Generate comparison structure
    return dailyData.map(current => {
      const currentDate = parseISO(current.period);
      const previousDate = format(subDays(currentDate, daysDiff), 'yyyy-MM-dd');
      
      // Find matching previous period data
      const previous = dailyData.find(d => d.period === previousDate);

      return {
        date: current.period,
        currentRevenue: current.revenue,
        previousRevenue: previous?.revenue || 0,
        currentSpend: current.totalSpend,
        previousSpend: previous?.totalSpend || 0,
      };
    });
  }, [dailyData, startDate, endDate]);

  // Key metrics with trends - calculate LTV/CAC from actual data
  const keyMetrics = useMemo(() => {
    const currentTotal = dailyData.reduce((sum, d) => sum + d.revenue, 0);
    const currentSpend = dailyData.reduce((sum, d) => sum + d.totalSpend, 0);
    const currentDonors = transactions.length;

    // Calculate previous period for trend
    const midpoint = Math.floor(dailyData.length / 2);
    const previousRevenue = dailyData.slice(0, midpoint).reduce((sum, d) => sum + d.revenue, 0);

    const revenueTrend = calculateTrend(currentTotal, previousRevenue);
    const cacValue = calculateCAC(currentSpend, currentDonors);

    // Calculate average donation and estimate annual frequency from data
    const avgDonation = currentDonors > 0 ? currentTotal / currentDonors : 0;
    
    // Calculate days in selected period to estimate annual donation frequency
    const periodDays = dailyData.length || 1;
    const donationsPerYear = periodDays > 0 ? (currentDonors / periodDays) * 365 : 0;
    
    // Use conservative retention estimate based on recurring donor ratio
    const recurringCount = transactions.filter(t => t.is_recurring).length;
    const recurringRate = currentDonors > 0 ? recurringCount / currentDonors : 0;
    // Higher recurring rate = longer retention (1.5 to 4 years based on recurring percentage)
    const estimatedRetentionYears = 1.5 + (recurringRate * 2.5);
    
    const ltvValue = calculateLTV(avgDonation, Math.min(donationsPerYear / currentDonors || 1, 12), estimatedRetentionYears);

    // Confidence indicator based on sample size
    const hasEnoughData = currentDonors >= 30 && periodDays >= 14;

    return {
      revenue: revenueTrend,
      cac: cacValue,
      ltv: ltvValue,
      ltvCacRatio: cacValue > 0 ? ltvValue / cacValue : 0,
      confidence: hasEnoughData ? 'high' : currentDonors >= 10 ? 'medium' : 'low',
      sampleSize: currentDonors,
      periodDays,
    };
  }, [dailyData, transactions]);

  const handleExport = () => {
    const exportData = dailyData.map(d => ({
      Date: d.period,
      'Total Spend': d.totalSpend,
      Revenue: d.revenue,
      Conversions: d.conversions,
      'ROI %': d.roi.toFixed(2),
    }));

    exportToCSV(exportData, `analytics-${startDate}-to-${endDate}.csv`);
    
    toast({
      title: 'Export successful',
      description: 'Analytics data has been downloaded.',
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <V3LoadingState variant="kpi-grid" count={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Confidence Indicator */}
      {keyMetrics.confidence !== 'high' && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
          keyMetrics.confidence === 'low' 
            ? 'bg-[hsl(var(--portal-warning)/0.1)] text-[hsl(var(--portal-warning))]' 
            : 'bg-[hsl(var(--portal-accent-blue)/0.1)] text-[hsl(var(--portal-accent-blue))]'
        }`}>
          <TrendingUp className="h-4 w-4" />
          <span>
            {keyMetrics.confidence === 'low' 
              ? `Limited data: ${keyMetrics.sampleSize} donors over ${keyMetrics.periodDays} days. LTV/CAC estimates may be less reliable.`
              : `Moderate confidence: ${keyMetrics.sampleSize} donors. Consider extending date range for more accurate LTV estimates.`
            }
          </span>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <V3KPICard
          icon={DollarSign}
          label="Total Revenue"
          value={`$${keyMetrics.revenue.current.toLocaleString()}`}
          trend={{ 
            value: keyMetrics.revenue.changePercent, 
            isPositive: keyMetrics.revenue.changePercent >= 0 
          }}
          accent="blue"
        />
        <V3KPICard
          icon={Users}
          label="CAC"
          value={`$${keyMetrics.cac.toFixed(2)}`}
          subtitle="Customer Acquisition Cost"
          accent="purple"
        />
        <V3KPICard
          icon={TrendingUp}
          label="LTV"
          value={`$${keyMetrics.ltv.toFixed(2)}`}
          subtitle={`Est. ${keyMetrics.confidence} confidence`}
          accent="green"
        />
        <V3KPICard
          icon={TrendingUp}
          label="LTV:CAC Ratio"
          value={`${keyMetrics.ltvCacRatio.toFixed(1)}:1`}
          subtitle={keyMetrics.ltvCacRatio >= 3 ? 'Excellent' : keyMetrics.ltvCacRatio >= 1 ? 'Good' : 'Needs improvement'}
          accent={keyMetrics.ltvCacRatio >= 3 ? 'green' : keyMetrics.ltvCacRatio >= 1 ? 'blue' : 'amber'}
        />
      </div>

      {/* Export Button */}
      <div className="flex justify-end">
        <Button onClick={handleExport} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export to CSV
        </Button>
      </div>

      {/* Advanced Analytics Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid w-full ${isMobile ? 'grid-cols-2' : 'grid-cols-4'}`}>
          <TabsTrigger value="attribution">Models</TabsTrigger>
          <TabsTrigger value="funnel">Funnel</TabsTrigger>
          <TabsTrigger value="forecast">Forecast</TabsTrigger>
          <TabsTrigger value="comparison">Compare</TabsTrigger>
        </TabsList>

        <TabsContent value="attribution" className="space-y-4 mt-4">
          {attributionData.length > 0 ? (
            <>
              <AttributionChart
                title="Refcode Attribution Analysis"
                description="Compare how different models weight refcode-based touchpoints (Meta ads are aggregated only)"
                data={attributionData as {
                  touchpoint: string;
                  platform: string;
                  firstTouch: number;
                  lastTouch: number;
                  linear: number;
                  positionBased: number;
                  timeDecay: number;
                }[]}
              />
              
              <V3Card>
                <V3CardHeader>
                  <V3CardTitle>Channel Contribution</V3CardTitle>
                  <V3CardDescription>Performance efficiency by marketing channel</V3CardDescription>
                </V3CardHeader>
                <V3CardContent>
                  <div className="space-y-4">
                    {channelContribution.map(channel => (
                      <div key={channel.name} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{channel.name}</span>
                          <span className="text-sm text-[hsl(var(--portal-text-muted))]">
                            {channel.contribution.toFixed(1)}% contribution
                          </span>
                        </div>
                        <div className="w-full h-2 bg-[hsl(var(--portal-bg-elevated))] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[hsl(var(--portal-accent-blue))] transition-all"
                            style={{ width: `${channel.contribution}%` }}
                          />
                        </div>
                        <p className="text-xs text-[hsl(var(--portal-text-muted))]">
                          Efficiency: {channel.efficiency.toFixed(2)} conversions per dollar
                        </p>
                      </div>
                    ))}
                  </div>
                </V3CardContent>
              </V3Card>
            </>
          ) : (
            <V3Card>
              <V3CardContent className="flex items-center justify-center min-h-[300px]">
                <p className="text-[hsl(var(--portal-text-muted))]">No attribution data available for this period</p>
              </V3CardContent>
            </V3Card>
          )}
        </TabsContent>

        <TabsContent value="funnel" className="mt-4">
          <FunnelChart
            title="Conversion Funnel"
            description="Track the customer journey from impression to donation"
            stages={funnelData}
          />
        </TabsContent>

        <TabsContent value="forecast" className="mt-4">
          <TrendChart
            title="Revenue Forecast"
            description="7-day revenue prediction with 95% confidence interval"
            data={revenueForecast}
            lines={[]}
            showForecast
            valueType="currency"
          />
        </TabsContent>

        <TabsContent value="comparison" className="mt-4">
          <div className="space-y-4">
            <ComparisonChart
              title="Revenue Comparison"
              description="Current period vs. previous period"
              data={comparisonData}
              currentKey="currentRevenue"
              previousKey="previousRevenue"
              currentLabel="Current Period"
              previousLabel="Previous Period"
              valueType="currency"
            />
            
            <ComparisonChart
              title="Spend Comparison"
              description="Current period vs. previous period"
              data={comparisonData}
              currentKey="currentSpend"
              previousKey="previousSpend"
              currentLabel="Current Period"
              previousLabel="Previous Period"
              valueType="currency"
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
