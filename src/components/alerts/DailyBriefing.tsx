import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertTriangle,
  Newspaper,
  ScrollText,
  Shield,
  Building2,
  TrendingUp,
  Bell,
  RefreshCw,
  Calendar,
  ExternalLink,
  Users,
  ChevronRight,
  Activity,
  FileText,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

import type { Database } from "@/integrations/supabase/types";

type DailyBriefingRow = Database['public']['Tables']['daily_briefings']['Row'];
type BreakingNewsRow = Database['public']['Tables']['breaking_news_clusters']['Row'];

type DailyBriefingData = DailyBriefingRow;

interface BreakingNewsCluster extends BreakingNewsRow {
  cluster_topic?: string;
  article_count?: number;
  source_names?: string[];
  affected_organizations?: string[];
}

export function DailyBriefing() {
  const isMobile = useIsMobile();
  const [briefing, setBriefing] = useState<DailyBriefingData | null>(null);
  const [breakingNews, setBreakingNews] = useState<BreakingNewsCluster[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<BreakingNewsCluster | null>(null);
  const [selectedCriticalItem, setSelectedCriticalItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchBriefing();
  }, []);

  const fetchBriefing = async () => {
    try {
      setLoading(true);
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const { data: briefingData, error } = await supabase
        .from('daily_briefings')
        .select('*')
        .eq('briefing_date', today)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      console.log('Fetched briefing data:', briefingData);
      setBriefing(briefingData);

      const { data: newsData } = await supabase
        .from('breaking_news_clusters')
        .select('*')
        .eq('is_resolved', false)
        .gte('first_detected_at', today)
        .order('first_detected_at', { ascending: false });

      console.log('Fetched breaking news:', newsData);
      setBreakingNews(newsData || []);
    } catch (error) {
      console.error('Error fetching briefing:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateBriefing = async () => {
    try {
      setGenerating(true);
      toast({
        title: "Generating daily briefing...",
        description: "Analyzing all sources and detecting patterns",
      });

      const now = new Date();
      const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const { data, error } = await supabase.functions.invoke('smart-alerting', {
        body: { action: 'full', localDate }
      });

      if (error) throw error;

      console.log('Smart alerting response:', data);

      const criticalCount = data?.results?.daily_briefing?.critical || 0;
      const highCount = data?.results?.daily_briefing?.high || 0;

      toast({
        title: "Briefing generated",
        description: `Found ${criticalCount} critical, ${highCount} high priority items`,
      });

      await fetchBriefing();
    } catch (error) {
      console.error('Error generating briefing:', error);
      toast({
        title: "Failed to generate briefing",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const totalItems = briefing
    ? (briefing.total_articles || 0) + (briefing.total_bills || 0) + (briefing.total_executive_orders || 0) + (briefing.total_state_actions || 0)
    : 0;

  const threatScore = briefing
    ? Math.min(100, (briefing.critical_count * 25) + (briefing.high_count * 10))
    : 0;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-muted rounded w-1/3"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Hero Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Calendar className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
                  Daily Intelligence
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                  {format(new Date(), 'EEEE, MMMM d, yyyy')}
                </p>
              </div>
            </div>
          </div>
          <Button
            onClick={generateBriefing}
            disabled={generating}
            variant="smooth"
            size={isMobile ? "sm" : "default"}
            className="shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${isMobile ? '' : 'mr-2'} ${generating ? 'animate-spin' : ''}`} />
            {!isMobile && (generating ? 'Generating...' : 'Refresh')}
          </Button>
        </div>
      </div>

      {/* Critical Alert Banner */}
      {briefing && briefing.critical_count > 0 && (
        <Alert variant="destructive" className="border-2 border-red-600">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle className="text-lg font-bold">
            {briefing.critical_count} Critical Alert{briefing.critical_count !== 1 ? 's' : ''} Today
          </AlertTitle>
          <AlertDescription>
            Immediate attention required. These items may directly impact civil liberties organizations.
          </AlertDescription>
        </Alert>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="elevated" className="animate-fade-in-up" style={{ animationDelay: '0ms' }}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-950">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <Badge variant="destructive" className="text-xs">
                Critical
              </Badge>
            </div>
            <div className="text-3xl font-bold text-red-600 dark:text-red-400 mb-1">
              {briefing?.critical_count || 0}
            </div>
            <p className="text-sm text-muted-foreground">Immediate attention</p>
          </CardContent>
        </Card>

        <Card variant="elevated" className="animate-fade-in-up" style={{ animationDelay: '50ms' }}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-950">
                <TrendingUp className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-400">
                High
              </Badge>
            </div>
            <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-1">
              {briefing?.high_count || 0}
            </div>
            <p className="text-sm text-muted-foreground">Review soon</p>
          </CardContent>
        </Card>

        <Card variant="elevated" className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <Badge variant="outline" className="text-xs">
                Items
              </Badge>
            </div>
            <div className="text-3xl font-bold mb-1">
              {totalItems}
            </div>
            <p className="text-sm text-muted-foreground">
              {briefing?.total_articles || 0} articles, {briefing?.total_bills || 0} bills
            </p>
          </CardContent>
        </Card>

        <Card variant="elevated" className="animate-fade-in-up" style={{ animationDelay: '150ms' }}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950">
                <Activity className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <Badge
                variant="outline"
                className={`text-xs ${
                  threatScore >= 75 ? 'border-red-600 text-red-600' :
                  threatScore >= 50 ? 'border-orange-600 text-orange-600' :
                  threatScore >= 25 ? 'border-yellow-600 text-yellow-600' :
                  'border-green-600 text-green-600'
                }`}
              >
                {threatScore >= 75 ? 'Severe' : threatScore >= 50 ? 'High' : threatScore >= 25 ? 'Moderate' : 'Low'}
              </Badge>
            </div>
            <div className={`text-3xl font-bold mb-1 ${
              threatScore >= 75 ? 'text-red-600' :
              threatScore >= 50 ? 'text-orange-600' :
              threatScore >= 25 ? 'text-yellow-600' : 'text-green-600'
            }`}>
              {threatScore}/100
            </div>
            <p className="text-sm text-muted-foreground">Threat level</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trending Topics */}
        <Card variant="smooth" className="flex flex-col animate-slide-in-left">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950">
                <Bell className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-xl">Trending Topics</CardTitle>
                <CardDescription className="text-sm">
                  {breakingNews.length} active cluster{breakingNews.length !== 1 ? 's' : ''}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            {breakingNews.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <Bell className="h-16 w-16 mb-4 opacity-30" />
                <p className="text-sm">No trending topics detected today</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {breakingNews.map((cluster) => (
                    <Button
                      key={cluster.id}
                      variant="outline"
                      className="w-full h-auto p-4 text-left hover:bg-accent transition-colors"
                      onClick={() => setSelectedCluster(cluster)}
                    >
                      <div className="w-full space-y-2">
                        <div className="flex items-start justify-between gap-2">
                      <Badge
                        variant={
                          (typeof cluster.threat_level === 'number' && cluster.threat_level >= 75) ||
                          cluster.severity === 'critical'
                            ? 'destructive'
                            : 'secondary'
                        }
                        className="text-xs"
                      >
                            {cluster.article_count || cluster.article_ids?.length || 0} sources
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(cluster.first_detected_at), 'h:mm a')}
                          </span>
                        </div>
                        <h4 className="font-semibold text-sm line-clamp-2 text-left">
                          {cluster.cluster_topic}
                        </h4>
                        <div className="flex items-center gap-2">
                          <div className="flex flex-wrap gap-1 flex-1">
                            {cluster.source_names?.slice(0, 3).map((source) => (
                              <Badge key={source} variant="outline" className="text-xs">
                                {source}
                              </Badge>
                            ))}
                            {cluster.source_names && cluster.source_names.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{cluster.source_names.length - 3}
                              </Badge>
                            )}
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Critical Items */}
        <Card variant="smooth" className="flex flex-col animate-slide-in-right">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-950">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <CardTitle className="text-xl">Critical Items</CardTitle>
                <CardDescription className="text-sm">
                  {Array.isArray(briefing?.top_critical_items) ? briefing.top_critical_items.length : 0} items requiring attention
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            {!Array.isArray(briefing?.top_critical_items) || briefing.top_critical_items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <Shield className="h-16 w-16 mb-4 opacity-30" />
                <p className="text-sm">No critical items today</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {(briefing.top_critical_items as any[]).map((item: any) => {
                    const Icon = item.type === 'article' ? Newspaper :
                                item.type === 'bill' ? ScrollText :
                                item.type === 'state_action' ? Building2 : Shield;

                    return (
                      <Button
                        key={`${item.type}-${item.id}`}
                        variant="outline"
                        className="w-full h-auto p-4 text-left hover:bg-accent transition-colors border-red-200 dark:border-red-900"
                        onClick={() => setSelectedCriticalItem(item)}
                      >
                        <div className="w-full space-y-2">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-950 shrink-0">
                              <Icon className="h-4 w-4 text-red-600 dark:text-red-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <Badge variant="destructive" className="text-xs">
                                  {item.threat_level?.toUpperCase()}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {item.type.replace('_', ' ')}
                                </Badge>
                              </div>
                              <h4 className="font-semibold text-sm line-clamp-2 text-left">
                                {item.title}
                              </h4>
                              {item.source_name && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {item.source_name}
                                </p>
                              )}
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          </div>
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Organization Mentions */}
      {briefing?.organization_mentions && Object.keys(briefing.organization_mentions).length > 0 && (
        <Card variant="smooth" className="animate-fade-in">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950">
                <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-xl">Organization Mentions</CardTitle>
                <CardDescription>
                  Tracked organizations mentioned today
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(briefing.organization_mentions).map(([org, data]) => (
                <Card
                  key={org}
                  variant="elevated"
                  className={`${
                    data.critical > 0 ? 'border-red-300 dark:border-red-900' :
                    data.high > 0 ? 'border-orange-300 dark:border-orange-900' : ''
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm truncate">{org}</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          {data.total} mention{data.total !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1">
                        {data.critical > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {data.critical}
                          </Badge>
                        )}
                        {data.high > 0 && (
                          <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800 dark:bg-orange-950">
                            {data.high}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trending Topic Drawer */}
      <Sheet open={!!selectedCluster} onOpenChange={() => setSelectedCluster(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          {selectedCluster && (
            <>
              <SheetHeader className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 pr-8">
                    <SheetTitle className="text-2xl leading-tight">
                      {selectedCluster.cluster_topic}
                    </SheetTitle>
                    <SheetDescription className="mt-2">
                      Detected at {format(new Date(selectedCluster.first_detected_at), 'h:mm a')}
                    </SheetDescription>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Badge
                    variant={
                      (typeof selectedCluster.threat_level === 'number' && selectedCluster.threat_level >= 75) ||
                      selectedCluster.severity === 'critical'
                        ? 'destructive'
                        : 'secondary'
                    }
                  >
                    {selectedCluster.article_count || selectedCluster.article_ids?.length || 0} sources
                  </Badge>
                  {selectedCluster.affected_organizations && selectedCluster.affected_organizations.length > 0 && (
                    <Badge variant="outline">
                      {selectedCluster.affected_organizations.length} orgs affected
                    </Badge>
                  )}
                </div>
              </SheetHeader>

              <Separator className="my-6" />

              <div className="space-y-6">
                {/* Sources */}
                <div>
                  <h3 className="font-semibold text-lg mb-3">Sources</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedCluster.source_names?.map((source) => (
                      <Badge key={source} variant="outline">
                        {source}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Affected Organizations */}
                {selectedCluster.affected_organizations && selectedCluster.affected_organizations.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg mb-3">Affected Organizations</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedCluster.affected_organizations.map((org) => (
                        <Badge key={org} variant="destructive">
                          {org}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Additional Details */}
                <div>
                  <h3 className="font-semibold text-lg mb-3">Details</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Article Count</span>
                      <span className="font-medium">
                        {selectedCluster.article_count || selectedCluster.article_ids?.length || 0}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">First Detected</span>
                      <span className="font-medium">
                        {format(new Date(selectedCluster.first_detected_at), 'MMM d, yyyy h:mm a')}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant={selectedCluster.is_resolved ? 'secondary' : 'default'}>
                        {selectedCluster.is_resolved ? 'Resolved' : 'Active'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Critical Item Drawer */}
      <Sheet open={!!selectedCriticalItem} onOpenChange={() => setSelectedCriticalItem(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          {selectedCriticalItem && (
            <>
              <SheetHeader className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 pr-8">
                    <SheetTitle className="text-2xl leading-tight">
                      {selectedCriticalItem.title}
                    </SheetTitle>
                    {selectedCriticalItem.source_name && (
                      <SheetDescription className="mt-2">
                        {selectedCriticalItem.source_name}
                      </SheetDescription>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="destructive">
                    {selectedCriticalItem.threat_level?.toUpperCase()}
                  </Badge>
                  <Badge variant="outline">
                    {selectedCriticalItem.type.replace('_', ' ')}
                  </Badge>
                </div>
              </SheetHeader>

              <Separator className="my-6" />

              <div className="space-y-6">
                {/* Summary */}
                {selectedCriticalItem.summary && (
                  <div>
                    <h3 className="font-semibold text-lg mb-3">Summary</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {selectedCriticalItem.summary}
                    </p>
                  </div>
                )}

                {/* Details */}
                <div>
                  <h3 className="font-semibold text-lg mb-3">Details</h3>
                  <div className="space-y-2 text-sm">
                    {selectedCriticalItem.state_code && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">State</span>
                        <span className="font-medium">{selectedCriticalItem.state_code}</span>
                      </div>
                    )}
                    {selectedCriticalItem.type === 'bill' && selectedCriticalItem.bill_number && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Bill Number</span>
                        <span className="font-medium">{selectedCriticalItem.bill_number}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {selectedCriticalItem.url && (
                  <div>
                    <Button
                      className="w-full"
                      onClick={() => window.open(selectedCriticalItem.url, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Full Article
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
