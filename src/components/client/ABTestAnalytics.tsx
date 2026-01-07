import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { V3Card, V3CardContent, V3CardDescription, V3CardHeader, V3CardTitle } from "@/components/v3/V3Card";
import { V3ChartWrapper } from "@/components/v3/V3ChartWrapper";
import { V3Badge } from "@/components/v3/V3Badge";
import { V3LoadingState } from "@/components/v3/V3LoadingState";
import { V3ErrorState } from "@/components/v3/V3ErrorState";
import { V3SectionHeader } from "@/components/v3/V3SectionHeader";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/chart-formatters";
import { EChartsBarChart } from "@/components/charts/echarts/EChartsBarChart";
import { V3EmptyState } from "@/components/v3/V3EmptyState";
import { FlaskConical, TrendingUp, Users, DollarSign } from "lucide-react";

interface ABTestPerformance {
  ab_test_name: string;
  ab_test_variation: string;
  donations: number;
  total_raised: number;
  avg_donation: number;
  recurring_donations: number;
  net_raised: number;
  first_donation: string;
  last_donation: string;
  unique_donors: number;
}

interface ABTestAnalyticsProps {
  organizationId: string;
}

export function ABTestAnalytics({ organizationId }: ABTestAnalyticsProps) {
  const { data: abTests, isLoading, error, refetch } = useQuery({
    queryKey: ['ab-test-performance', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ab_test_performance')
        .select('*')
        .eq('organization_id', organizationId);
      
      if (error) throw error;
      return data as ABTestPerformance[];
    },
    enabled: !!organizationId,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <V3LoadingState variant="kpi-grid" count={3} />
      </div>
    );
  }

  if (error) {
    return (
      <V3ErrorState
        title="Failed to load A/B test data"
        message={error.message}
        onRetry={() => refetch()}
      />
    );
  }

  if (!abTests || abTests.length === 0) {
    return (
      <V3EmptyState
        title="No A/B Tests Found"
        description="A/B test data will appear here when ActBlue transactions include ab_test_name fields."
        icon={FlaskConical}
      />
    );
  }

  // Group by test name
  const testGroups = abTests.reduce((acc, test) => {
    if (!acc[test.ab_test_name]) {
      acc[test.ab_test_name] = [];
    }
    acc[test.ab_test_name].push(test);
    return acc;
  }, {} as Record<string, ABTestPerformance[]>);

  return (
    <div className="space-y-8">
      <V3SectionHeader
        title="A/B Test Performance"
        subtitle={`Compare performance across ${Object.keys(testGroups).length} active tests`}
        icon={FlaskConical}
        variant="premium"
        badges={[
          <V3Badge key="count" variant="muted">{Object.keys(testGroups).length} tests</V3Badge>
        ]}
      />

      {Object.entries(testGroups).map(([testName, variations]) => {
        const chartData = variations.map(v => ({
          name: v.ab_test_variation || 'Control',
          value: v.total_raised,
          donations: v.donations,
          avgDonation: v.avg_donation,
        }));

        const totalDonations = variations.reduce((sum, v) => sum + v.donations, 0);
        const totalRaised = variations.reduce((sum, v) => sum + v.total_raised, 0);
        const bestVariation = variations.reduce((best, v) => 
          v.avg_donation > best.avg_donation ? v : best
        , variations[0]);

        return (
          <V3Card key={testName} className="overflow-hidden">
            <V3CardHeader className="bg-[hsl(var(--portal-bg-elevated))]">
              <div className="flex items-center justify-between">
                <div>
                  <V3CardTitle className="text-lg text-[hsl(var(--portal-text-primary))]">{testName}</V3CardTitle>
                  <V3CardDescription>
                    {variations.length} variations • {formatNumber(totalDonations)} total donations
                  </V3CardDescription>
                </div>
                <V3Badge variant="success">
                  Winner: {bestVariation.ab_test_variation || 'Control'}
                </V3Badge>
              </div>
            </V3CardHeader>
            <V3CardContent className="pt-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Summary Stats */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-[hsl(var(--portal-bg-elevated))]">
                    <DollarSign className="h-8 w-8 text-[hsl(var(--portal-success))]" />
                    <div>
                      <p className="text-sm text-[hsl(var(--portal-text-muted))]">Total Raised</p>
                      <p className="text-xl font-bold text-[hsl(var(--portal-text-primary))]">{formatCurrency(totalRaised)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-[hsl(var(--portal-bg-elevated))]">
                    <Users className="h-8 w-8 text-[hsl(var(--portal-accent-blue))]" />
                    <div>
                      <p className="text-sm text-[hsl(var(--portal-text-muted))]">Total Donations</p>
                      <p className="text-xl font-bold text-[hsl(var(--portal-text-primary))]">{formatNumber(totalDonations)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-[hsl(var(--portal-bg-elevated))]">
                    <TrendingUp className="h-8 w-8 text-[hsl(var(--portal-accent-purple))]" />
                    <div>
                      <p className="text-sm text-[hsl(var(--portal-text-muted))]">Best Avg Donation</p>
                      <p className="text-xl font-bold text-[hsl(var(--portal-text-primary))]">{formatCurrency(bestVariation.avg_donation)}</p>
                    </div>
                  </div>
                </div>

                {/* Chart */}
                <div className="lg:col-span-2 h-[250px]">
                  <EChartsBarChart
                    data={chartData}
                    xAxisKey="name"
                    series={[{ dataKey: 'value', name: 'Revenue', color: 'hsl(var(--portal-accent-blue))' }]}
                    height={250}
                    valueType="currency"
                  />
                </div>
              </div>

              {/* Variation Details */}
              <div className="mt-6 border-t border-[hsl(var(--portal-border))] pt-4">
                <h4 className="text-sm font-medium mb-3 text-[hsl(var(--portal-text-primary))]">Variation Breakdown</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {variations.map(v => (
                    <div 
                      key={v.ab_test_variation} 
                      className={`p-3 rounded-lg border ${v === bestVariation ? 'border-[hsl(var(--portal-accent-blue))] bg-[hsl(var(--portal-accent-blue)/0.05)]' : 'border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-elevated))]'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-[hsl(var(--portal-text-primary))]">{v.ab_test_variation || 'Control'}</span>
                        {v === bestVariation && (
                          <V3Badge variant="success">Best</V3Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-[hsl(var(--portal-text-muted))]">Donations:</span>
                          <span className="ml-1 font-medium text-[hsl(var(--portal-text-primary))]">{formatNumber(v.donations)}</span>
                        </div>
                        <div>
                          <span className="text-[hsl(var(--portal-text-muted))]">Avg:</span>
                          <span className="ml-1 font-medium text-[hsl(var(--portal-text-primary))]">{formatCurrency(v.avg_donation)}</span>
                        </div>
                        <div>
                          <span className="text-[hsl(var(--portal-text-muted))]">Total:</span>
                          <span className="ml-1 font-medium text-[hsl(var(--portal-text-primary))]">{formatCurrency(v.total_raised)}</span>
                        </div>
                        <div>
                          <span className="text-[hsl(var(--portal-text-muted))]">Recurring:</span>
                          <span className="ml-1 font-medium text-[hsl(var(--portal-text-primary))]">{formatPercent(v.recurring_donations / v.donations)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </V3CardContent>
          </V3Card>
        );
      })}
    </div>
  );
}
