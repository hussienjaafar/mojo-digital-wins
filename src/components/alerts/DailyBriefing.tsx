import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
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
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface DailyBriefingData {
  id: string;
  briefing_date: string;
  total_articles: number;
  total_bills: number;
  total_executive_orders: number;
  total_state_actions: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  top_critical_items: any[];
  breaking_news_clusters: string[];
  organization_mentions: Record<string, { total: number; critical: number; high: number }>;
  executive_summary: string;
  key_takeaways: string[];
}

interface BreakingNewsCluster {
  id: string;
  cluster_topic: string;
  article_count: number;
  source_names: string[];
  threat_level: string;
  affected_organizations: string[];
  first_detected_at: string;
}

export function DailyBriefing() {
  const [briefing, setBriefing] = useState<DailyBriefingData | null>(null);
  const [breakingNews, setBreakingNews] = useState<BreakingNewsCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchBriefing();
  }, []);

  const fetchBriefing = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];

      // Fetch today's briefing
      const { data: briefingData, error } = await supabase
        .from('daily_briefings')
        .select('*')
        .eq('briefing_date', today)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setBriefing(briefingData);

      // Fetch breaking news
      const { data: newsData } = await supabase
        .from('breaking_news_clusters')
        .select('*')
        .eq('is_active', true)
        .gte('first_detected_at', today)
        .order('first_detected_at', { ascending: false });

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

      const { data, error } = await supabase.functions.invoke('smart-alerting', {
        body: { action: 'full' }
      });

      if (error) throw error;

      toast({
        title: "Briefing generated",
        description: `Found ${data.results?.daily_briefing?.critical || 0} critical items`,
      });

      await fetchBriefing();
    } catch (error) {
      console.error('Error generating briefing:', error);
      toast({
        title: "Failed to generate briefing",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const totalItems = briefing
    ? briefing.total_articles + briefing.total_bills + briefing.total_executive_orders + briefing.total_state_actions
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2">
            <Calendar className="h-7 w-7" />
            Daily Intelligence Briefing
          </h2>
          <p className="text-muted-foreground mt-1">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <Button onClick={generateBriefing} disabled={generating}>
          <RefreshCw className={`w-4 h-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
          {generating ? 'Generating...' : 'Refresh Briefing'}
        </Button>
      </div>

      {/* Critical Alert Banner */}
      {briefing && briefing.critical_count > 0 && (
        <Alert variant="destructive" className="border-red-600">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle className="text-lg font-bold">
            {briefing.critical_count} Critical Alert{briefing.critical_count !== 1 ? 's' : ''} Today
          </AlertTitle>
          <AlertDescription>
            Immediate attention required. These items may directly impact civil liberties organizations.
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-red-600">{briefing?.critical_count || 0}</div>
            <div className="text-xs text-muted-foreground">Critical</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-orange-600">{briefing?.high_count || 0}</div>
            <div className="text-xs text-muted-foreground">High Priority</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold">{briefing?.total_articles || 0}</div>
            <div className="text-xs text-muted-foreground">Articles</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold">{briefing?.total_bills || 0}</div>
            <div className="text-xs text-muted-foreground">Bills</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold">{briefing?.total_executive_orders || 0}</div>
            <div className="text-xs text-muted-foreground">Exec Orders</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold">{briefing?.total_state_actions || 0}</div>
            <div className="text-xs text-muted-foreground">State Actions</div>
          </CardContent>
        </Card>
      </div>

      {/* Threat Level Indicator */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Today's Threat Level
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Threat Score</span>
              <span className={`font-bold ${
                threatScore >= 75 ? 'text-red-600' :
                threatScore >= 50 ? 'text-orange-600' :
                threatScore >= 25 ? 'text-yellow-600' : 'text-green-600'
              }`}>
                {threatScore}/100
              </span>
            </div>
            <Progress
              value={threatScore}
              className={`h-3 ${
                threatScore >= 75 ? '[&>div]:bg-red-600' :
                threatScore >= 50 ? '[&>div]:bg-orange-600' :
                threatScore >= 25 ? '[&>div]:bg-yellow-600' : '[&>div]:bg-green-600'
              }`}
            />
            <p className="text-xs text-muted-foreground">
              Based on {briefing?.critical_count || 0} critical and {briefing?.high_count || 0} high priority items
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="breaking" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="breaking" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Breaking News
          </TabsTrigger>
          <TabsTrigger value="critical" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Critical Items
          </TabsTrigger>
          <TabsTrigger value="organizations" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Org Mentions
          </TabsTrigger>
        </TabsList>

        {/* Breaking News Tab */}
        <TabsContent value="breaking">
          <Card>
            <CardHeader>
              <CardTitle>Breaking News Clusters</CardTitle>
              <CardDescription>
                Stories being reported by multiple sources
              </CardDescription>
            </CardHeader>
            <CardContent>
              {breakingNews.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No breaking news clusters detected today</p>
                </div>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {breakingNews.map((cluster) => (
                      <Card key={cluster.id} className={`${
                        cluster.threat_level === 'critical' ? 'border-red-300' :
                        cluster.threat_level === 'high' ? 'border-orange-300' : ''
                      }`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <Badge variant={cluster.threat_level === 'critical' ? 'destructive' : 'secondary'}>
                              {cluster.article_count} sources
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(cluster.first_detected_at), 'h:mm a')}
                            </span>
                          </div>
                          <h4 className="font-semibold text-sm mb-2 line-clamp-2">
                            {cluster.cluster_topic}
                          </h4>
                          <div className="flex flex-wrap gap-1">
                            {cluster.source_names.slice(0, 5).map((source) => (
                              <Badge key={source} variant="outline" className="text-xs">
                                {source}
                              </Badge>
                            ))}
                            {cluster.source_names.length > 5 && (
                              <Badge variant="outline" className="text-xs">
                                +{cluster.source_names.length - 5}
                              </Badge>
                            )}
                          </div>
                          {cluster.affected_organizations.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {cluster.affected_organizations.map((org) => (
                                <Badge key={org} variant="destructive" className="text-xs">
                                  {org}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Critical Items Tab */}
        <TabsContent value="critical">
          <Card>
            <CardHeader>
              <CardTitle>Critical & High Priority Items</CardTitle>
              <CardDescription>
                Items requiring immediate attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!briefing?.top_critical_items?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No critical items today</p>
                </div>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {briefing.top_critical_items.map((item: any, index: number) => {
                      const Icon = item.type === 'article' ? Newspaper :
                                  item.type === 'bill' ? ScrollText :
                                  item.type === 'state_action' ? Building2 : Shield;

                      return (
                        <Card key={`${item.type}-${item.id}`} className="border-red-300">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-red-100 text-red-600">
                                <Icon className="h-4 w-4" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="destructive" className="text-xs">
                                    {item.threat_level?.toUpperCase()}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {item.type.replace('_', ' ')}
                                  </Badge>
                                </div>
                                <h4 className="font-semibold text-sm line-clamp-2">
                                  {item.title}
                                </h4>
                                {item.source_name && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {item.source_name}
                                  </p>
                                )}
                                {item.state_code && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {item.state_code}
                                  </p>
                                )}
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
        </TabsContent>

        {/* Organization Mentions Tab */}
        <TabsContent value="organizations">
          <Card>
            <CardHeader>
              <CardTitle>Organization Mentions</CardTitle>
              <CardDescription>
                Tracked organizations mentioned today
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!briefing?.organization_mentions || Object.keys(briefing.organization_mentions).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No organization mentions tracked today</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(briefing.organization_mentions).map(([org, data]) => (
                    <Card key={org} className={`${
                      data.critical > 0 ? 'border-red-300' :
                      data.high > 0 ? 'border-orange-300' : ''
                    }`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-bold">{org}</h4>
                            <p className="text-sm text-muted-foreground">
                              {data.total} mention{data.total !== 1 ? 's' : ''} today
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {data.critical > 0 && (
                              <Badge variant="destructive">{data.critical} critical</Badge>
                            )}
                            {data.high > 0 && (
                              <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                                {data.high} high
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
