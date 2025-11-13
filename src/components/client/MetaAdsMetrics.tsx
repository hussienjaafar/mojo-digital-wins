import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/fixed-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type Props = {
  organizationId: string;
  startDate: string;
  endDate: string;
};

type MetaCampaign = {
  campaign_id: string;
  campaign_name: string;
  status: string;
  objective: string;
  daily_budget: number;
  lifetime_budget: number;
};

type MetaMetric = {
  campaign_id: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  cpc: number;
  ctr: number;
  roas: number;
};

const MetaAdsMetrics = ({ organizationId, startDate, endDate }: Props) => {
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [metrics, setMetrics] = useState<Record<string, MetaMetric>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [organizationId, startDate, endDate]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load campaigns
      const { data: campaignData, error: campaignError } = await (supabase as any)
        .from('meta_campaigns')
        .select('*')
        .eq('organization_id', organizationId);

      if (campaignError) throw campaignError;
      setCampaigns(campaignData || []);

      // Load aggregated metrics per campaign
      const { data: metricsData, error: metricsError } = await (supabase as any)
        .from('meta_ad_metrics')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('date', startDate)
        .lte('date', endDate);

      if (metricsError) throw metricsError;

      // Aggregate metrics by campaign
      const aggregated: Record<string, MetaMetric> = {};
      metricsData?.forEach(metric => {
        if (!aggregated[metric.campaign_id]) {
          aggregated[metric.campaign_id] = {
            campaign_id: metric.campaign_id,
            impressions: 0,
            clicks: 0,
            spend: 0,
            conversions: 0,
            cpc: 0,
            ctr: 0,
            roas: 0,
          };
        }
        aggregated[metric.campaign_id].impressions += metric.impressions || 0;
        aggregated[metric.campaign_id].clicks += metric.clicks || 0;
        aggregated[metric.campaign_id].spend += Number(metric.spend || 0);
        aggregated[metric.campaign_id].conversions += metric.conversions || 0;
      });

      // Calculate averages
      Object.values(aggregated).forEach(metric => {
        if (metric.clicks > 0) {
          metric.cpc = metric.spend / metric.clicks;
        }
        if (metric.impressions > 0) {
          metric.ctr = (metric.clicks / metric.impressions) * 100;
        }
      });

      setMetrics(aggregated);
    } catch (error) {
      console.error('Error loading Meta Ads data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading Meta Ads data...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Campaign Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Impressions</TableHead>
                <TableHead className="text-right">Clicks</TableHead>
                <TableHead className="text-right">Spend</TableHead>
                <TableHead className="text-right">CTR</TableHead>
                <TableHead className="text-right">CPC</TableHead>
                <TableHead className="text-right">Conversions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No campaigns found
                  </TableCell>
                </TableRow>
              ) : (
                campaigns.map(campaign => {
                  const metric = metrics[campaign.campaign_id] || {
                    impressions: 0,
                    clicks: 0,
                    spend: 0,
                    conversions: 0,
                    cpc: 0,
                    ctr: 0,
                  };
                  return (
                    <TableRow key={campaign.campaign_id}>
                      <TableCell className="font-medium">
                        {campaign.campaign_name || campaign.campaign_id}
                      </TableCell>
                      <TableCell>
                        <Badge variant={campaign.status === 'ACTIVE' ? 'default' : 'secondary'}>
                          {campaign.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {metric.impressions.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {metric.clicks.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        ${metric.spend.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        {metric.ctr.toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right">
                        ${metric.cpc.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        {metric.conversions}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default MetaAdsMetrics;
