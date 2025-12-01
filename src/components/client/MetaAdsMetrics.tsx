import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/fixed-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { logger } from "@/lib/logger";
import { PortalTable, PortalTableRenderers } from "@/components/portal/PortalTable";
import { NoDataEmptyState } from "@/components/portal/PortalEmptyState";

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
      logger.error('Failed to load Meta Ads data', error);
    } finally {
      setIsLoading(false);
    }
  };

  const tableData = campaigns.map(campaign => {
    const metric = metrics[campaign.campaign_id] || {
      impressions: 0,
      clicks: 0,
      spend: 0,
      conversions: 0,
      cpc: 0,
      ctr: 0,
    };
    
    return {
      campaign_id: campaign.campaign_id,
      campaign_name: campaign.campaign_name || campaign.campaign_id,
      status: campaign.status,
      impressions: metric.impressions,
      clicks: metric.clicks,
      spend: metric.spend,
      ctr: metric.ctr,
      cpc: metric.cpc,
      conversions: metric.conversions,
    };
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Campaign Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <PortalTable
            data={tableData}
            columns={[
              {
                key: "campaign_name",
                label: "Campaign",
                sortable: true,
                render: (value) => <span className="font-medium">{value}</span>,
              },
              {
                key: "status",
                label: "Status",
                mobileLabel: "Status",
                render: (value) => (
                  <Badge variant={value === 'ACTIVE' ? 'default' : 'secondary'}>
                    {value}
                  </Badge>
                ),
              },
              {
                key: "impressions",
                label: "Impressions",
                sortable: true,
                className: "text-right",
                render: PortalTableRenderers.number,
              },
              {
                key: "clicks",
                label: "Clicks",
                sortable: true,
                className: "text-right",
                render: PortalTableRenderers.number,
                hiddenOnMobile: true,
              },
              {
                key: "spend",
                label: "Spend",
                sortable: true,
                className: "text-right",
                render: PortalTableRenderers.currency,
              },
              {
                key: "ctr",
                label: "CTR",
                sortable: true,
                className: "text-right",
                render: PortalTableRenderers.percentage,
                hiddenOnMobile: true,
              },
              {
                key: "cpc",
                label: "CPC",
                sortable: true,
                className: "text-right",
                render: PortalTableRenderers.currency,
                hiddenOnMobile: true,
              },
              {
                key: "conversions",
                label: "Conversions",
                sortable: true,
                className: "text-right",
                render: PortalTableRenderers.number,
              },
            ]}
            keyExtractor={(row) => row.campaign_id}
            isLoading={isLoading}
            emptyMessage="No Meta campaigns found"
            emptyAction={
              <p className="text-sm portal-text-muted">
                Connect your Meta Ads account to see campaign data
              </p>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default MetaAdsMetrics;
