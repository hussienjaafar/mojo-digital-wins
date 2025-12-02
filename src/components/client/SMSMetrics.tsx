import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/fixed-client";
import { PortalCard, PortalCardContent, PortalCardHeader, PortalCardTitle } from "@/components/portal/PortalCard";
import { PortalMetric } from "@/components/portal/PortalMetric";
import { logger } from "@/lib/logger";
import { PortalTable, PortalTableRenderers } from "@/components/portal/PortalTable";
import { MessageSquare, CheckCircle, DollarSign, Target } from "lucide-react";

type Props = {
  organizationId: string;
  startDate: string;
  endDate: string;
};

type SMSMetric = {
  campaign_id: string;
  campaign_name: string;
  messages_sent: number;
  messages_delivered: number;
  messages_failed: number;
  opt_outs: number;
  clicks: number;
  conversions: number;
  amount_raised: number;
  cost: number;
};

const SMSMetrics = ({ organizationId, startDate, endDate }: Props) => {
  const [metrics, setMetrics] = useState<Record<string, SMSMetric>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [organizationId, startDate, endDate]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('sms_campaign_metrics')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('date', startDate)
        .lte('date', endDate);

      if (error) throw error;

      const aggregated: Record<string, SMSMetric> = {};
      data?.forEach(metric => {
        if (!aggregated[metric.campaign_id]) {
          aggregated[metric.campaign_id] = {
            campaign_id: metric.campaign_id,
            campaign_name: metric.campaign_name || metric.campaign_id,
            messages_sent: 0,
            messages_delivered: 0,
            messages_failed: 0,
            opt_outs: 0,
            clicks: 0,
            conversions: 0,
            amount_raised: 0,
            cost: 0,
          };
        }
        aggregated[metric.campaign_id].messages_sent += metric.messages_sent || 0;
        aggregated[metric.campaign_id].messages_delivered += metric.messages_delivered || 0;
        aggregated[metric.campaign_id].messages_failed += metric.messages_failed || 0;
        aggregated[metric.campaign_id].opt_outs += metric.opt_outs || 0;
        aggregated[metric.campaign_id].clicks += metric.clicks || 0;
        aggregated[metric.campaign_id].conversions += metric.conversions || 0;
        aggregated[metric.campaign_id].amount_raised += Number(metric.amount_raised || 0);
        aggregated[metric.campaign_id].cost += Number(metric.cost || 0);
      });

      setMetrics(aggregated);
    } catch (error) {
      logger.error('Failed to load SMS data', error);
    } finally {
      setIsLoading(false);
    }
  };

  const campaigns = Object.values(metrics);
  const totalRaised = campaigns.reduce((sum, m) => sum + m.amount_raised, 0);
  const totalCost = campaigns.reduce((sum, m) => sum + m.cost, 0);
  const totalSent = campaigns.reduce((sum, m) => sum + m.messages_sent, 0);
  const totalDelivered = campaigns.reduce((sum, m) => sum + m.messages_delivered, 0);
  const totalConversions = campaigns.reduce((sum, m) => sum + m.conversions, 0);
  const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
  const conversionRate = totalDelivered > 0 ? (totalConversions / totalDelivered) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <PortalMetric
          label="Messages Sent"
          value={totalSent.toLocaleString()}
          icon={MessageSquare}
          subtitle={`${deliveryRate.toFixed(1)}% delivered`}
        />
        <PortalMetric
          label="Conversions"
          value={totalConversions.toLocaleString()}
          icon={Target}
          subtitle={`${conversionRate.toFixed(2)}% rate`}
        />
        <PortalMetric
          label="Amount Raised"
          value={`$${totalRaised.toLocaleString()}`}
          icon={DollarSign}
          subtitle="From SMS campaigns"
        />
        <PortalMetric
          label="Total Cost"
          value={`$${totalCost.toLocaleString()}`}
          icon={CheckCircle}
          subtitle={totalConversions > 0 ? `$${(totalCost / totalConversions).toFixed(2)} per conv.` : 'N/A'}
        />
      </div>

      {/* Campaign Details Table */}
      <PortalCard>
        <PortalCardHeader>
          <PortalCardTitle>Campaign Details</PortalCardTitle>
        </PortalCardHeader>
        <PortalCardContent>
          <PortalTable
            data={campaigns}
            columns={[
              {
                key: "campaign_name",
                label: "Campaign",
                sortable: true,
                render: (value) => <span className="font-medium portal-text-primary">{value}</span>,
              },
              {
                key: "messages_sent",
                label: "Sent",
                sortable: true,
                className: "text-right",
                render: PortalTableRenderers.number,
              },
              {
                key: "messages_delivered",
                label: "Delivered",
                sortable: true,
                className: "text-right",
                render: PortalTableRenderers.number,
                hiddenOnMobile: true,
              },
              {
                key: "messages_failed",
                label: "Failed",
                sortable: true,
                className: "text-right",
                render: PortalTableRenderers.number,
                hiddenOnMobile: true,
              },
              {
                key: "opt_outs",
                label: "Opt-outs",
                sortable: true,
                className: "text-right",
                render: PortalTableRenderers.number,
                hiddenOnMobile: true,
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
                key: "conversions",
                label: "Conversions",
                sortable: true,
                className: "text-right",
                render: PortalTableRenderers.number,
              },
              {
                key: "amount_raised",
                label: "Raised",
                sortable: true,
                className: "text-right",
                render: PortalTableRenderers.currency,
              },
              {
                key: "cost",
                label: "Cost",
                sortable: true,
                className: "text-right",
                render: PortalTableRenderers.currency,
                hiddenOnMobile: true,
              },
            ]}
            keyExtractor={(row) => row.campaign_id}
            isLoading={isLoading}
            emptyMessage="No SMS campaigns found"
            emptyAction={
              <p className="text-sm portal-text-muted">
                Connect your SMS platform to see campaign data
              </p>
            }
          />
        </PortalCardContent>
      </PortalCard>
    </div>
  );
};

export default SMSMetrics;