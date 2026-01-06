import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Bell, Target, TrendingUp, ExternalLink, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface PriorityAlert {
  id: string;
  type: 'watchlist_spike' | 'critical_news' | 'trending_match';
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium';
  timestamp: string;
  sourceUrl?: string;
  entity?: string;
  mentions?: number;
}

interface PriorityAlertsPanelProps {
  onAlertClick?: (alert: PriorityAlert) => void;
}

export function PriorityAlertsPanel({ onAlertClick }: PriorityAlertsPanelProps) {
  const [alerts, setAlerts] = useState<PriorityAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchPriorityAlerts();
  }, []);

  const fetchPriorityAlerts = async () => {
    setIsLoading(true);
    try {
      // Fetch watchlist entities
      const { data: watchlist } = await supabase
        .from('entity_watchlist')
        .select('entity_name, alert_threshold');

      const watchlistEntities = (watchlist || []).map(w => ({
        name: w.entity_name?.toLowerCase() || '',
        threshold: w.alert_threshold
      }));

      if (watchlistEntities.length === 0) {
        setAlerts([]);
        setIsLoading(false);
        return;
      }

      // Fetch recent critical articles that match watchlist
      const { data: criticalArticles } = await supabase
        .from('articles')
        .select('id, title, description, source_url, published_date, threat_level, affected_organizations')
        .in('threat_level', ['critical', 'high'])
        .gte('published_date', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('published_date', { ascending: false })
        .limit(50);

      // Fetch trending topics that match watchlist - migrated to trend_events
      const { data: trendingData } = await supabase
        .from('trend_events')
        .select('id, event_key, event_title, velocity, current_24h, is_trending, confidence_score')
        .eq('is_trending', true)
        .gte('last_seen_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('velocity', { ascending: false })
        .limit(20);

      const priorityAlerts: PriorityAlert[] = [];

      // Match critical articles to watchlist
      (criticalArticles || []).forEach(article => {
        const matchedEntity = watchlistEntities.find(entity => 
          article.title?.toLowerCase().includes(entity.name) ||
          article.description?.toLowerCase().includes(entity.name) ||
          article.affected_organizations?.some((org: string) => org.toLowerCase().includes(entity.name))
        );

        if (matchedEntity) {
          priorityAlerts.push({
            id: `article-${article.id}`,
            type: 'critical_news',
            title: article.title || 'Breaking News',
            description: `Critical coverage affecting "${matchedEntity.name}"`,
            severity: article.threat_level === 'critical' ? 'critical' : 'high',
            timestamp: article.published_date,
            sourceUrl: article.source_url,
            entity: matchedEntity.name,
          });
        }
      });

      // Match trending topics to watchlist (using trend_events schema)
      (trendingData || []).forEach(trend => {
        const trendNameLower = trend.event_title?.toLowerCase() || '';
        const matchedEntity = watchlistEntities.find(entity => 
          trendNameLower.includes(entity.name) || entity.name.includes(trendNameLower)
        );

        // Use velocity as spike indicator (>200 = 2x normal)
        const spikeRatio = (trend.velocity || 0) / 100;
        if (matchedEntity && spikeRatio >= 2) {
          priorityAlerts.push({
            id: `trend-${trend.event_key}`,
            type: 'watchlist_spike',
            title: `"${trend.event_title}" is trending`,
            description: `${spikeRatio.toFixed(1)}x above normal • ${trend.current_24h || 0} mentions in 24h`,
            severity: spikeRatio >= 4 ? 'critical' : spikeRatio >= 3 ? 'high' : 'medium',
            timestamp: new Date().toISOString(),
            entity: matchedEntity.name,
            mentions: trend.current_24h || 0,
          });
        }
      });

      // Sort by severity and timestamp
      priorityAlerts.sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2 };
        if (severityOrder[a.severity] !== severityOrder[b.severity]) {
          return severityOrder[a.severity] - severityOrder[b.severity];
        }
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      setAlerts(priorityAlerts.slice(0, 5));
    } catch (error) {
      console.error('Error fetching priority alerts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = (alertId: string) => {
    setDismissed(prev => new Set([...prev, alertId]));
  };

  const visibleAlerts = alerts.filter(a => !dismissed.has(a.id));

  if (isLoading) {
    return (
      <Card className="border-l-4 border-l-amber-500">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="space-y-3">
            {[1, 2].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (visibleAlerts.length === 0) {
    return (
      <Card className="border-l-4 border-l-green-500 bg-green-50/50 dark:bg-green-950/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <Bell className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-green-800 dark:text-green-200">All Clear</h3>
              <p className="text-sm text-green-700 dark:text-green-300">
                No priority alerts for your watchlist items right now.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      "border-l-4",
      visibleAlerts[0]?.severity === 'critical' ? "border-l-red-500 bg-red-50/50 dark:bg-red-950/20" :
      visibleAlerts[0]?.severity === 'high' ? "border-l-orange-500 bg-orange-50/50 dark:bg-orange-950/20" :
      "border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20"
    )}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              visibleAlerts[0]?.severity === 'critical' ? "bg-red-100 dark:bg-red-900/30" :
              visibleAlerts[0]?.severity === 'high' ? "bg-orange-100 dark:bg-orange-900/30" :
              "bg-amber-100 dark:bg-amber-900/30"
            )}>
              <AlertTriangle className={cn(
                "h-5 w-5",
                visibleAlerts[0]?.severity === 'critical' ? "text-red-600 dark:text-red-400" :
                visibleAlerts[0]?.severity === 'high' ? "text-orange-600 dark:text-orange-400" :
                "text-amber-600 dark:text-amber-400"
              )} />
            </div>
            <div>
              <h3 className="font-semibold">Priority Alerts</h3>
              <p className="text-xs text-muted-foreground">
                {visibleAlerts.length} item{visibleAlerts.length !== 1 ? 's' : ''} need your attention
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            {visibleAlerts.filter(a => a.severity === 'critical').length} critical
          </Badge>
        </div>

        <div className="space-y-2">
          {visibleAlerts.map((alert) => (
            <div 
              key={alert.id}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors group",
                "hover:bg-background/80 dark:hover:bg-background/40",
                alert.severity === 'critical' && "bg-red-100/50 dark:bg-red-900/20",
                alert.severity === 'high' && "bg-orange-100/50 dark:bg-orange-900/20",
                alert.severity === 'medium' && "bg-amber-100/50 dark:bg-amber-900/20"
              )}
              onClick={() => onAlertClick?.(alert)}
            >
              <div className="flex-shrink-0 mt-0.5">
                {alert.type === 'watchlist_spike' ? (
                  <TrendingUp className={cn(
                    "h-4 w-4",
                    alert.severity === 'critical' ? "text-red-500" :
                    alert.severity === 'high' ? "text-orange-500" : "text-amber-500"
                  )} />
                ) : (
                  <Target className={cn(
                    "h-4 w-4",
                    alert.severity === 'critical' ? "text-red-500" :
                    alert.severity === 'high' ? "text-orange-500" : "text-amber-500"
                  )} />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm line-clamp-1">{alert.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{alert.description}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                  </span>
                  {alert.entity && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">
                      <Target className="h-2.5 w-2.5 mr-1" />
                      {alert.entity}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {alert.sourceUrl && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 w-7 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(alert.sourceUrl, '_blank');
                    }}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 w-7 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDismiss(alert.id);
                  }}
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
