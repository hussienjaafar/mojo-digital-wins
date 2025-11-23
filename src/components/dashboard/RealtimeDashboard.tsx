import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRealtimeTrends } from '@/hooks/useRealtimeTrends';
import { useRealtimeAlerts } from '@/hooks/useRealtimeAlerts';
import { TrendingUp, AlertTriangle, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';

export const RealtimeDashboard = () => {
  const { trends, isLoading: trendsLoading } = useRealtimeTrends();
  const { alerts, criticalCount } = useRealtimeAlerts();
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const timeSinceUpdate = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);

  return (
    <div className="space-y-6">
      {/* Live Indicator */}
      <div className="flex items-center gap-2">
        <Radio className="h-4 w-4 text-destructive animate-pulse" />
        <span className="text-sm text-muted-foreground">
          Live • Updated {timeSinceUpdate}s ago
        </span>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Trending Topics Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Trending Now
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trendsLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : trends.length === 0 ? (
              <p className="text-sm text-muted-foreground">No trending topics</p>
            ) : (
              <div className="space-y-3">
                {trends.slice(0, 5).map((trend) => (
                  <div
                    key={trend.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{trend.topic}</p>
                      <p className="text-xs text-muted-foreground">
                        {trend.mentions_last_hour || 0} mentions in last hour
                      </p>
                    </div>
                    <Badge
                      variant={
                        (trend.velocity || 0) > 50 ? 'destructive' : 'secondary'
                      }
                    >
                      {trend.velocity ? `+${Math.round(trend.velocity)}%` : '0%'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Critical Alerts Card */}
        <Card className={cn(criticalCount > 0 && 'border-destructive')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Critical Alerts
              {criticalCount > 0 && (
                <Badge variant="destructive" className="ml-auto">
                  {criticalCount}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {alerts.filter(a => a.severity === 'critical').length === 0 ? (
              <p className="text-sm text-muted-foreground">No critical alerts</p>
            ) : (
              <div className="space-y-3">
                {alerts
                  .filter((a) => a.severity === 'critical')
                  .slice(0, 5)
                  .map((alert) => (
                    <div
                      key={alert.id}
                      className="p-3 rounded-lg border border-destructive/50 bg-destructive/5"
                    >
                      <p className="font-medium text-sm">{alert.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {alert.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(alert.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
