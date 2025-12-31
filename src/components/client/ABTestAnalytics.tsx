import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { V3Card, V3CardContent, V3CardDescription, V3CardHeader, V3CardTitle } from "@/components/v3/V3Card";
import { V3KPICard } from "@/components/v3/V3KPICard";
import { V3ChartWrapper } from "@/components/v3/V3ChartWrapper";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  const { data: abTests, isLoading, error } = useQuery({
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
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <V3Card className="border-destructive">
        <V3CardContent className="pt-6">
          <p className="text-destructive">Error loading A/B test data: {error.message}</p>
        </V3CardContent>
      </V3Card>
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
      <div className="flex items-center gap-2">
        <FlaskConical className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">A/B Test Performance</h2>
        <Badge variant="secondary">{Object.keys(testGroups).length} tests</Badge>
      </div>

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
            <V3CardHeader className="bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <V3CardTitle className="text-lg">{testName}</V3CardTitle>
                  <V3CardDescription>
                    {variations.length} variations • {formatNumber(totalDonations)} total donations
                  </V3CardDescription>
                </div>
                <Badge variant="default" className="text-sm">
                  Winner: {bestVariation.ab_test_variation || 'Control'}
                </Badge>
              </div>
            </V3CardHeader>
            <V3CardContent className="pt-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Summary Stats */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <DollarSign className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="text-sm text-muted-foreground">Total Raised</p>
                      <p className="text-xl font-bold">{formatCurrency(totalRaised)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <Users className="h-8 w-8 text-blue-600" />
                    <div>
                      <p className="text-sm text-muted-foreground">Total Donations</p>
                      <p className="text-xl font-bold">{formatNumber(totalDonations)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <TrendingUp className="h-8 w-8 text-purple-600" />
                    <div>
                      <p className="text-sm text-muted-foreground">Best Avg Donation</p>
                      <p className="text-xl font-bold">{formatCurrency(bestVariation.avg_donation)}</p>
                    </div>
                  </div>
                </div>

                {/* Chart */}
                <div className="lg:col-span-2 h-[250px]">
                  <EChartsBarChart
                    data={chartData}
                    xAxisKey="name"
                    series={[{ dataKey: 'value', name: 'Revenue', color: 'hsl(var(--primary))' }]}
                    height={250}
                    valueType="currency"
                  />
                </div>
              </div>

              {/* Variation Details */}
              <div className="mt-6 border-t pt-4">
                <h4 className="text-sm font-medium mb-3">Variation Breakdown</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {variations.map(v => (
                    <div 
                      key={v.ab_test_variation} 
                      className={`p-3 rounded-lg border ${v === bestVariation ? 'border-primary bg-primary/5' : 'bg-muted/30'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{v.ab_test_variation || 'Control'}</span>
                        {v === bestVariation && (
                          <Badge variant="default" className="text-xs">Best</Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Donations:</span>
                          <span className="ml-1 font-medium">{formatNumber(v.donations)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Avg:</span>
                          <span className="ml-1 font-medium">{formatCurrency(v.avg_donation)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total:</span>
                          <span className="ml-1 font-medium">{formatCurrency(v.total_raised)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Recurring:</span>
                          <span className="ml-1 font-medium">{formatPercent(v.recurring_donations / v.donations)}</span>
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
