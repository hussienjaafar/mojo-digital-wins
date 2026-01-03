import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  Shield,
  FileText,
  Landmark,
  Building2,
  ExternalLink,
  RefreshCw,
  Bell,
  Download
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { ExportDialog } from "@/components/reports/ExportDialog";
import { AdminPageHeader, AdminLoadingState } from "@/components/admin/v3";
import { V3Button } from "@/components/v3/V3Button";

interface CriticalAlert {
  source_type: string;
  id: string;
  title: string;
  summary: string;
  date: string;
  threat_level: string;
  affected_organizations: string[];
  url: string;
}

const sourceTypeIcons: Record<string, any> = {
  article: FileText,
  bill: Landmark,
  executive_order: Shield,
  state_action: Building2,
  government_announcement: Bell,
};

const sourceTypeLabels: Record<string, string> = {
  article: "News",
  bill: "Bill",
  executive_order: "Executive Order",
  state_action: "State Action",
  government_announcement: "Gov. Announcement",
};

export function CriticalAlerts() {
  const [alerts, setAlerts] = useState<CriticalAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      setLoading(true);

      // Fetch from alert_queue for critical/high severity items
      const { data, error } = await supabase
        .from('alert_queue')
        .select('*')
        .in('severity', ['critical', 'high'])
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      
      // Map to CriticalAlert format
      const mappedAlerts: CriticalAlert[] = (data || []).map(alert => ({
        source_type: alert.alert_type,
        id: alert.id,
        title: alert.title,
        summary: alert.message,
        date: alert.created_at || '',
        threat_level: alert.severity,
        affected_organizations: [],
        url: '',
      }));
      
      setAlerts(mappedAlerts);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching critical alerts:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const syncAllSources = async () => {
    try {
      setSyncing(true);
      toast({
        title: "Syncing all sources...",
        description: "Fetching latest data from RSS feeds, Executive Orders, and State Actions",
      });

      // Sync RSS feeds
      await supabase.functions.invoke('fetch-rss-feeds');

      // Sync Executive Orders
      await supabase.functions.invoke('fetch-executive-orders', {
        body: { daysBack: 7 }
      });

      // Sync State Actions
      await supabase.functions.invoke('track-state-actions', {
        body: { action: 'fetch' }
      });

      toast({
        title: "Sync complete",
        description: "All sources have been updated",
      });

      await fetchAlerts();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error syncing sources:', error);
      }
      toast({
        title: "Sync failed",
        description: "Some sources may not have updated",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const criticalCount = alerts.filter(a => a.threat_level === 'critical').length;
  const highCount = alerts.filter(a => a.threat_level === 'high').length;

  if (loading) {
    return (
      <div className="space-y-6 portal-animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-red-100 dark:bg-red-950">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold portal-text-primary">Critical Alerts</h2>
            <p className="text-sm portal-text-secondary">Loading high-priority items...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="portal-card p-6 space-y-3" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex gap-3">
                <div className="portal-skeleton h-10 w-10 rounded" />
                <div className="flex-1 space-y-2">
                  <div className="portal-skeleton h-5 w-3/4" />
                  <div className="portal-skeleton h-4 w-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Alert Banner for Critical Items */}
      {criticalCount > 0 && (
        <Alert variant="destructive" className="border-red-600 bg-red-50 dark:bg-red-950">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle className="text-lg font-bold">
            {criticalCount} Critical Alert{criticalCount !== 1 ? 's' : ''} Require Immediate Attention
          </AlertTitle>
          <AlertDescription>
            Items marked as critical may directly impact Muslim and Arab American organizations.
          </AlertDescription>
        </Alert>
      )}

      <Card variant="smooth" className="animate-fade-in">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Critical & High Priority Alerts
              </CardTitle>
              <CardDescription>
                {criticalCount} critical, {highCount} high priority items from all sources
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <ExportDialog
                reportType="critical_alerts"
                title="Critical Alerts"
                trigger={
                  <V3Button variant="outline" size="sm" leftIcon={<Download className="h-4 w-4" />}>
                    Export
                  </V3Button>
                }
              />
              <V3Button 
                variant="primary" 
                size="sm" 
                onClick={syncAllSources} 
                isLoading={syncing}
                loadingText="Syncing..."
                leftIcon={<RefreshCw className="h-4 w-4" />}
              >
                Sync All
              </V3Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="text-center py-8 portal-text-muted">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No critical or high priority alerts at this time</p>
              <V3Button onClick={syncAllSources} className="mt-4" variant="primary" size="sm">
                Sync Sources
              </V3Button>
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {alerts.map((alert) => {
                  const Icon = sourceTypeIcons[alert.source_type] || FileText;
                  const isCritical = alert.threat_level === 'critical';

                  return (
                    <Card
                      key={`${alert.source_type}-${alert.id}`}
                      className={`transition-all ${
                        isCritical
                          ? 'border-red-500 bg-red-50/50 dark:bg-red-950/30'
                          : 'border-orange-300 bg-orange-50/50 dark:bg-orange-950/30'
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${
                            isCritical ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                          }`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={isCritical ? "destructive" : "secondary"} className="text-xs">
                                {alert.threat_level.toUpperCase()}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {sourceTypeLabels[alert.source_type]}
                              </Badge>
                              {alert.affected_organizations?.length > 0 && (
                                <Badge variant="outline" className="text-xs bg-purple-50">
                                  {alert.affected_organizations.join(', ')}
                                </Badge>
                              )}
                            </div>
                            <h4 className="font-semibold text-sm line-clamp-2 mb-1">
                              {alert.title}
                            </h4>
                            {alert.summary && (
                              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                                {alert.summary}
                              </p>
                            )}
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                {alert.date && formatDistanceToNow(new Date(alert.date), { addSuffix: true })}
                              </span>
                              {alert.url && (
                                <a
                                  href={alert.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline flex items-center gap-1"
                                >
                                  View <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
