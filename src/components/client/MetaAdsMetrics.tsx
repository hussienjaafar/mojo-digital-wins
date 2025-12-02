import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/fixed-client";
import { PortalCard, PortalCardContent, PortalCardHeader, PortalCardTitle } from "@/components/portal/PortalCard";
import { PortalMetric } from "@/components/portal/PortalMetric";
import { PortalBadge } from "@/components/portal/PortalBadge";
import { logger } from "@/lib/logger";
import { PortalTable, PortalTableRenderers } from "@/components/portal/PortalTable";
import { Target, MousePointer, Eye, DollarSign } from "lucide-react";

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
      const { data: campaignData, error: campaignError } = await (supabase as any)
        .from('meta_campaigns')
        .select('*')
        .eq('organization_id', organizationId);

      if (campaignError) throw campaignError;
      setCampaigns(campaignData || []);

      const { data: metricsData, error: metricsError } = await (supabase as any)
        .from('meta_ad_metrics')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('date', startDate)
        .lte('date', endDate);

      if (metricsError) throw metricsError;

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

  // Calculate totals
  const totals = Object.values(metrics).reduce(
    (acc, m) => ({
      impressions: acc.impressions + m.impressions,
      clicks: acc.clicks + m.clicks,
      spend: acc.spend + m.spend,
      conversions: acc.conversions + m.conversions,
    }),
    { impressions: 0, clicks: 0, spend: 0, conversions: 0 }
  );

  const avgCTR = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const avgCPC = totals.clicks > 0 ? totals.spend / totals.clicks : 0;

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
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <PortalMetric
          label="Total Spend"
          value={`$${totals.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          icon={DollarSign}
          subtitle="Ad investment"
        />
        <PortalMetric
          label="Impressions"
          value={totals.impressions.toLocaleString()}
          icon={Eye}
          subtitle="Total reach"
        />
        <PortalMetric
          label="Clicks"
          value={totals.clicks.toLocaleString()}
          icon={MousePointer}
          subtitle={`${avgCTR.toFixed(2)}% CTR`}
        />
        <PortalMetric
          label="Conversions"
          value={totals.conversions.toLocaleString()}
          icon={Target}
          subtitle={`$${avgCPC.toFixed(2)} CPC`}
        />
      </div>

      {/* Campaign Table */}
      <PortalCard>
        <PortalCardHeader>
          <PortalCardTitle>Campaign Performance</PortalCardTitle>
        </PortalCardHeader>
        <PortalCardContent>
          <PortalTable
            data={tableData}
            columns={[
              {
                key: "campaign_name",
                label: "Campaign",
                sortable: true,
                render: (value) => <span className="font-medium portal-text-primary">{value}</span>,
              },
              {
                key: "status",
                label: "Status",
                mobileLabel: "Status",
                render: (value) => (
                  <PortalBadge variant={value === 'ACTIVE' ? 'success' : 'neutral'}>
                    {value}
                  </PortalBadge>
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
        </PortalCardContent>
      </PortalCard>
    </div>
  );
};

export default MetaAdsMetrics;