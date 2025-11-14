import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/fixed-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { logger } from "@/lib/logger";

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

      // Aggregate by campaign
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
  const totalConversions = campaigns.reduce((sum, m) => sum + m.conversions, 0);

  if (isLoading) {
    return <div className="text-center py-8">Loading SMS data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Messages Sent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSent.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Conversions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalConversions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Amount Raised</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRaised.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCost.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Campaign Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Delivered</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead className="text-right">Opt-outs</TableHead>
                <TableHead className="text-right">Clicks</TableHead>
                <TableHead className="text-right">Conversions</TableHead>
                <TableHead className="text-right">Raised</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    No SMS campaigns found
                  </TableCell>
                </TableRow>
              ) : (
                campaigns.map(metric => (
                  <TableRow key={metric.campaign_id}>
                    <TableCell className="font-medium">{metric.campaign_name}</TableCell>
                    <TableCell className="text-right">{metric.messages_sent.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{metric.messages_delivered.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{metric.messages_failed.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{metric.opt_outs}</TableCell>
                    <TableCell className="text-right">{metric.clicks}</TableCell>
                    <TableCell className="text-right">{metric.conversions}</TableCell>
                    <TableCell className="text-right">${metric.amount_raised.toFixed(2)}</TableCell>
                    <TableCell className="text-right">${metric.cost.toFixed(2)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default SMSMetrics;
