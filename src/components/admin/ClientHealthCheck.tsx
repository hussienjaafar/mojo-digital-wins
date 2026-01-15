/**
 * ClientHealthCheck - Admin component for validating client data during onboarding
 * 
 * Displays:
 * - Transaction statistics
 * - Channel detection breakdown
 * - Attribution quality metrics
 * - Automated recommendations
 */

import { useClientHealth } from "@/hooks/useActBlueMetrics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Database, 
  MessageSquare, 
  Target, 
  TrendingUp,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getChannelLabel, type AttributionChannel } from "@/utils/channelDetection";

interface ClientHealthCheckProps {
  organizationId: string;
  organizationName?: string;
}

export function ClientHealthCheck({ organizationId, organizationName }: ClientHealthCheckProps) {
  const { data, isLoading, error, refetch, isFetching } = useClientHealth(organizationId);

  if (isLoading) {
    return <ClientHealthSkeleton />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Failed to load health check: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  if (!data) {
    return null;
  }

  const { transactions, channelBreakdown, smsFormsDetected, metaCampaigns, attribution, healthChecks, recommendations } = data;

  // Calculate health score (0-100)
  const healthScore = Object.values(healthChecks).filter(Boolean).length / Object.keys(healthChecks).length * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Data Health Check</h2>
          {organizationName && (
            <p className="text-muted-foreground">{organizationName}</p>
          )}
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Overall Health Score */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Overall Health Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Progress value={healthScore} className="flex-1" />
            <span className={`text-2xl font-bold ${
              healthScore >= 80 ? 'text-green-500' : 
              healthScore >= 50 ? 'text-yellow-500' : 
              'text-red-500'
            }`}>
              {Math.round(healthScore)}%
            </span>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <HealthBadge label="Transactions" passed={healthChecks.hasTransactions} />
            <HealthBadge label="Recent Data" passed={healthChecks.hasRecentData} />
            <HealthBadge label="Refcodes" passed={healthChecks.hasRefcodes} />
            <HealthBadge label="SMS Detected" passed={healthChecks.hasSmsDetected} />
            <HealthBadge label="Meta Campaigns" passed={healthChecks.hasMetaCampaigns} />
            <HealthBadge label="Attribution" passed={healthChecks.hasAttribution} />
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <Alert variant="default" className="border-yellow-500/50 bg-yellow-500/10">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <AlertTitle>Recommendations</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside mt-2 space-y-1">
              {recommendations.map((rec, i) => (
                <li key={i}>{rec}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Transaction Stats */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{transactions.total_transactions.toLocaleString()}</div>
            <p className="text-sm text-muted-foreground">
              {transactions.last_30_days.toLocaleString()} in last 30 days
            </p>
            {transactions.latest_transaction && (
              <p className="text-xs text-muted-foreground mt-1">
                Latest: {new Date(transactions.latest_transaction).toLocaleDateString()}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Refcode Coverage */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Refcode Coverage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {transactions.total_transactions > 0 
                ? Math.round((transactions.transactions_with_refcode / transactions.total_transactions) * 100)
                : 0}%
            </div>
            <p className="text-sm text-muted-foreground">
              {transactions.unique_refcodes.toLocaleString()} unique refcodes
            </p>
          </CardContent>
        </Card>

        {/* Meta Campaigns */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Meta Campaigns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metaCampaigns.meta_campaigns}</div>
            <p className="text-sm text-muted-foreground">
              {metaCampaigns.active_campaigns} active
            </p>
          </CardContent>
        </Card>

        {/* SMS Forms */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              SMS Forms Detected
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{smsFormsDetected.length}</div>
            {smsFormsDetected.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {smsFormsDetected.slice(0, 3).join(', ')}
                {smsFormsDetected.length > 3 && ` +${smsFormsDetected.length - 3} more`}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Channel Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Channel Breakdown (Last 30 Days)</CardTitle>
          <CardDescription>
            Based on unified channel detection logic
          </CardDescription>
        </CardHeader>
        <CardContent>
          {channelBreakdown.length > 0 ? (
            <div className="space-y-3">
              {channelBreakdown.map((item) => {
                const total = channelBreakdown.reduce((sum, i) => sum + i.count, 0);
                const percentage = total > 0 ? (item.count / total) * 100 : 0;
                return (
                  <div key={item.channel} className="flex items-center gap-4">
                    <div className="w-24 text-sm font-medium">
                      {getChannelLabel(item.channel as AttributionChannel)}
                    </div>
                    <Progress value={percentage} className="flex-1" />
                    <div className="w-20 text-right text-sm text-muted-foreground">
                      {item.count.toLocaleString()} ({percentage.toFixed(1)}%)
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground">No channel data available</p>
          )}
        </CardContent>
      </Card>

      {/* Attribution Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Attribution Quality</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Total Attributed</div>
              <div className="text-xl font-semibold">{attribution.total_attributed.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Deterministic</div>
              <div className="text-xl font-semibold">{attribution.deterministic.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">SMS Attributed</div>
              <div className="text-xl font-semibold">{attribution.sms_attributed.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Meta Attributed</div>
              <div className="text-xl font-semibold">{attribution.meta_attributed.toLocaleString()}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function HealthBadge({ label, passed }: { label: string; passed: boolean }) {
  return (
    <Badge variant={passed ? "default" : "secondary"} className="gap-1">
      {passed ? (
        <CheckCircle2 className="h-3 w-3 text-green-500" />
      ) : (
        <XCircle className="h-3 w-3 text-red-500" />
      )}
      {label}
    </Badge>
  );
}

function ClientHealthSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

export default ClientHealthCheck;
