import { useEffect, useState, memo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  Eye,
  TrendingUp,
  BarChart3,
  Bell,
  Target,
  DollarSign,
  ArrowRight,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface IntelligenceHubProps {
  organizationId: string;
}

interface HubStats {
  watchlistCount: number;
  trendingTopics: number;
  criticalAlerts: number;
  suggestedActions: number;
  opportunities: number;
  latestTrend?: string;
}

export const IntelligenceHub = memo(({ organizationId }: IntelligenceHubProps) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<HubStats>({
    watchlistCount: 0,
    trendingTopics: 0,
    criticalAlerts: 0,
    suggestedActions: 0,
    opportunities: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [organizationId]);

  const loadStats = async () => {
    try {
      // Use any to bypass TypeScript checks for tables not in types
      const sb = supabase as any;

      // Load watchlist count
      const { count: watchlistCount } = await sb
        .from('entity_watchlist')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('is_active', true);

      // Load trending topics
      const { data: trends } = await sb
        .from('bluesky_trends')
        .select('topic')
        .eq('is_trending', true)
        .order('velocity', { ascending: false })
        .limit(1);

      // Load critical alerts  
      const { count: alertCount } = await sb
        .from('client_entity_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('is_read', false)
        .in('severity', ['critical', 'high']);

      // Load suggested actions
      const { count: actionCount } = await sb
        .from('suggested_actions')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('status', 'pending');

      // Load opportunities
      const { count: opportunityCount } = await sb
        .from('fundraising_opportunities')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('is_active', true);

      setStats({
        watchlistCount: watchlistCount || 0,
        trendingTopics: trends?.length || 0,
        criticalAlerts: alertCount || 0,
        suggestedActions: actionCount || 0,
        opportunities: opportunityCount || 0,
        latestTrend: trends?.[0]?.topic,
      });
    } catch (error) {
      console.error('Error loading intelligence hub stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    {
      title: "Entity Watchlist",
      description: "Track mentions of key people, organizations, and topics",
      icon: Eye,
      path: "/client-watchlist",
      stat: stats.watchlistCount,
      statLabel: "tracked entities",
      color: "text-info",
      bgColor: "bg-info/10",
    },
    {
      title: "Bluesky Trends",
      description: "Real-time social media trend analysis",
      icon: TrendingUp,
      path: "/",
      stat: stats.trendingTopics,
      statLabel: "active trends",
      color: "text-secondary",
      bgColor: "bg-secondary/10",
      subtitle: stats.latestTrend,
    },
    {
      title: "Polling Intelligence",
      description: "Track public opinion and sentiment shifts",
      icon: BarChart3,
      path: "/polling-intelligence",
      stat: null,
      statLabel: "latest insights",
      color: "text-success",
      bgColor: "bg-success/10",
    },
  ];

  const actions = [
    {
      title: "Critical Alerts",
      description: "Urgent items requiring immediate attention",
      icon: Bell,
      path: "/client-alerts",
      count: stats.criticalAlerts,
      variant: "destructive" as const,
      color: "text-severity-critical",
      bgColor: "bg-severity-critical/10",
    },
    {
      title: "Suggested Actions",
      description: "AI-generated recommendations for your campaigns",
      icon: Target,
      path: "/client-actions",
      count: stats.suggestedActions,
      variant: "secondary" as const,
      color: "text-info",
      bgColor: "bg-info/10",
    },
    {
      title: "Opportunities",
      description: "Fundraising and engagement opportunities",
      icon: DollarSign,
      path: "/client-opportunities",
      count: stats.opportunities,
      variant: "default" as const,
      color: "text-success",
      bgColor: "bg-success/10",
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48 mb-2" variant="shimmer" />
            <Skeleton className="h-4 w-64" variant="shimmer" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <Skeleton className="h-12 w-12 rounded-xl" variant="shimmer" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-32" variant="shimmer" />
                        <Skeleton className="h-4 w-full" variant="shimmer" />
                        <Skeleton className="h-6 w-16" variant="shimmer" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48 mb-2" variant="shimmer" />
            <Skeleton className="h-4 w-64" variant="shimmer" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <Skeleton className="h-12 w-12 rounded-xl" variant="shimmer" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-32" variant="shimmer" />
                        <Skeleton className="h-4 w-full" variant="shimmer" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Intelligence Hub */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Intelligence Hub</CardTitle>
              <CardDescription>
                AI-powered insights to guide your campaigns
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={feature.path}
                  className="cursor-pointer hover:shadow-lg transition-all hover:border-primary/50"
                  onClick={() => navigate(feature.path)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={cn("p-3 rounded-xl", feature.bgColor)}>
                        <Icon className={cn("h-6 w-6", feature.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground mb-1">
                          {feature.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-3">
                          {feature.description}
                        </p>
                        {feature.stat !== null && (
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="font-semibold">
                              {feature.stat}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {feature.statLabel}
                            </span>
                          </div>
                        )}
                        {feature.subtitle && (
                          <p className="text-xs text-muted-foreground mt-2 truncate">
                            Latest: {feature.subtitle}
                          </p>
                        )}
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-secondary/10 rounded-lg">
              <Target className="h-5 w-5 text-secondary" />
            </div>
            <div>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Respond to critical items and opportunities
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {actions.map((action) => {
              const Icon = action.icon;
              const hasItems = action.count > 0;

              return (
                <Card
                  key={action.path}
                  className={cn(
                    "cursor-pointer transition-all",
                    hasItems
                      ? "hover:shadow-lg hover:border-primary/50"
                      : "opacity-60"
                  )}
                  onClick={() => navigate(action.path)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={cn("p-3 rounded-xl", action.bgColor)}>
                        <Icon className={cn("h-6 w-6", action.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground">
                            {action.title}
                          </h3>
                          {action.count > 0 && (
                            <Badge variant={action.variant}>
                              {action.count}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {action.description}
                        </p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

IntelligenceHub.displayName = 'IntelligenceHub';
