import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

  // Calculate daily aggregated data
  const dailyData = useMemo(() => {
    return groupByPeriod(
      [...metaMetrics, ...smsMetrics, ...transactions],
      'date',
      'day',
      (items) => {
        const metaSpend = items
          .filter((i: any) => 'spend' in i)
          .reduce((sum, i: any) => sum + Number(i.spend || 0), 0);
        
        const smsSpend = items
          .filter((i: any) => 'cost' in i)
          .reduce((sum, i: any) => sum + Number(i.cost || 0), 0);
        
        const revenue = items
          .filter((i: any) => 'amount' in i)
          .reduce((sum, i: any) => sum + Number(i.amount || 0), 0);
        
        const conversions = items.filter((i: any) => 'amount' in i).length;

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
  }, [metaMetrics, smsMetrics, transactions]);

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

  // Key metrics with trends
  const keyMetrics = useMemo(() => {
    const currentTotal = dailyData.reduce((sum, d) => sum + d.revenue, 0);
    const currentSpend = dailyData.reduce((sum, d) => sum + d.totalSpend, 0);
    const currentDonors = transactions.length;

    // Calculate previous period
    const midpoint = Math.floor(dailyData.length / 2);
    const previousRevenue = dailyData.slice(0, midpoint).reduce((sum, d) => sum + d.revenue, 0);
    const previousSpend = dailyData.slice(0, midpoint).reduce((sum, d) => sum + d.totalSpend, 0);

    const revenueTrend = calculateTrend(currentTotal, previousRevenue);
    const cacValue = calculateCAC(currentSpend, currentDonors);
    const ltvValue = calculateLTV(
      currentDonors > 0 ? currentTotal / currentDonors : 0,
      2.5, // avg donations per year
      3    // retention years
    );

    return {
      revenue: revenueTrend,
      cac: cacValue,
      ltv: ltvValue,
      ltvCacRatio: cacValue > 0 ? ltvValue / cacValue : 0,
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
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-0 pb-2">
                <div className="h-4 w-24 bg-muted rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-32 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Key Metrics */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="hover-scale transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium portal-text-primary">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 portal-text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${keyMetrics.revenue.current.toLocaleString()}
            </div>
            <p className={`text-xs ${keyMetrics.revenue.changePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {keyMetrics.revenue.changePercent >= 0 ? '+' : ''}
              {keyMetrics.revenue.changePercent.toFixed(1)}% from previous period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CAC</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${keyMetrics.cac.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Customer Acquisition Cost
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">LTV</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${keyMetrics.ltv.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Lifetime Value
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">LTV:CAC Ratio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {keyMetrics.ltvCacRatio.toFixed(1)}:1
            </div>
            <p className="text-xs text-muted-foreground">
              {keyMetrics.ltvCacRatio >= 3 ? 'Excellent' : keyMetrics.ltvCacRatio >= 1 ? 'Good' : 'Needs improvement'}
            </p>
          </CardContent>
        </Card>
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
          <TabsTrigger value="attribution">Attribution</TabsTrigger>
          <TabsTrigger value="funnel">Funnel</TabsTrigger>
          <TabsTrigger value="forecast">Forecast</TabsTrigger>
          <TabsTrigger value="comparison">Compare</TabsTrigger>
        </TabsList>

        <TabsContent value="attribution" className="space-y-4 mt-4">
          {attributionData.length > 0 ? (
            <>
              <AttributionChart
                title="Multi-Touch Attribution Analysis"
                description="Compare how different attribution models credit your marketing touchpoints"
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
              
              <Card>
                <CardHeader>
                  <CardTitle>Channel Contribution</CardTitle>
                  <CardDescription>Performance efficiency by marketing channel</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {channelContribution.map(channel => (
                      <div key={channel.name} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{channel.name}</span>
                          <span className="text-sm text-muted-foreground">
                            {channel.contribution.toFixed(1)}% contribution
                          </span>
                        </div>
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${channel.contribution}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Efficiency: {channel.efficiency.toFixed(2)} conversions per dollar
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center min-h-[300px]">
                <p className="text-muted-foreground">No attribution data available for this period</p>
              </CardContent>
            </Card>
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
