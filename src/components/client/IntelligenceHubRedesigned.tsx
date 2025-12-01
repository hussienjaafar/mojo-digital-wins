import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/fixed-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, TrendingUp, Eye, Clock, ExternalLink, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

type Props = {
  organizationId: string;
};

type Alert = {
  id: string;
  entity_name: string;
  alert_type: string;
  severity: string;
  triggered_at: string;
  current_mentions: number;
  velocity: number;
  suggested_action: string | null;
};

type Trend = {
  topic: string;
  mentions_last_hour: number;
  velocity: number;
  sentiment_avg: number;
  is_trending: boolean;
};

export function IntelligenceHubRedesigned({ organizationId }: Props) {
  const navigate = useNavigate();
  const [criticalAlerts, setCriticalAlerts] = useState<Alert[]>([]);
  const [trendingTopics, setTrendingTopics] = useState<Trend[]>([]);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadIntelligence();
  }, [organizationId]);

  const loadIntelligence = async () => {
    setIsLoading(true);
    try {
      // Load critical alerts
      const { data: alerts } = await (supabase as any)
        .from("client_entity_alerts")
        .select("*")
        .eq("organization_id", organizationId)
        .in("severity", ["critical", "high"])
        .eq("is_read", false)
        .order("triggered_at", { ascending: false })
        .limit(3);

      setCriticalAlerts(alerts || []);

      // Load trending topics
      const { data: trends } = await (supabase as any)
        .from("bluesky_trends")
        .select("*")
        .eq("is_trending", true)
        .order("velocity", { ascending: false })
        .limit(5);

      setTrendingTopics(trends || []);

      // Count watchlist items
      const { count } = await (supabase as any)
        .from("entity_watchlist")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("is_active", true);

      setWatchlistCount(count || 0);
    } catch (error) {
      console.error("Failed to load intelligence:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-6 sm:p-8">
          <div className="h-48 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  const hasCriticalSignals = criticalAlerts.length > 0;

  return (
    <div className="space-y-4">
      {/* BREAKING NOW - High Priority Signals */}
      <Card className={cn(
        "border-l-4 transition-all",
        hasCriticalSignals ? "border-l-destructive bg-destructive/5" : "border-l-muted"
      )}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                hasCriticalSignals ? "bg-destructive/10" : "bg-muted"
              )}>
                <AlertTriangle className={cn(
                  "h-5 w-5",
                  hasCriticalSignals ? "text-destructive" : "text-muted-foreground"
                )} />
              </div>
              <div>
                <CardTitle className="text-lg">Breaking Now</CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {hasCriticalSignals ? "Critical alerts require attention" : "All clear"}
                </p>
              </div>
            </div>
            {hasCriticalSignals && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/client-alerts")}
                className="gap-2"
              >
                View All
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {hasCriticalSignals ? (
            <div className="space-y-3">
              {criticalAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => navigate("/client-alerts")}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{alert.entity_name}</span>
                      <Badge variant={alert.severity === "critical" ? "destructive" : "default"} className="text-xs">
                        {alert.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {alert.suggested_action || alert.alert_type}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {alert.current_mentions} mentions
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(alert.triggered_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-muted-foreground text-sm">No critical alerts at this time</p>
              <Button
                variant="link"
                size="sm"
                onClick={() => navigate("/client-alerts")}
                className="mt-2"
              >
                View alert history
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* STRATEGIC WATCH - Trending Topics & Watchlist */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Trending Topics */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Trending Topics</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Rising conversations
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {trendingTopics.length > 0 ? (
              <div className="space-y-2">
                {trendingTopics.map((trend, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{trend.topic}</p>
                      <p className="text-xs text-muted-foreground">
                        {trend.mentions_last_hour} mentions/hr
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs shrink-0 ml-2">
                      +{Math.round(trend.velocity * 100)}%
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No trending topics detected
              </p>
            )}
          </CardContent>
        </Card>

        {/* Watchlist Summary */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary/10">
                <Eye className="h-5 w-5 text-secondary" />
              </div>
              <div>
                <CardTitle className="text-base">Active Watchlist</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Entities you're tracking
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              <div className="text-3xl font-bold portal-text-primary mb-2">
                {watchlistCount}
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                entities monitored
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/client-watchlist")}
                className="gap-2"
              >
                Manage Watchlist
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
