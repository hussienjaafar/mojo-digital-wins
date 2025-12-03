import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Newspaper, ChevronDown, ChevronUp, ExternalLink, Flame, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface TrendingTopic {
  id: string;
  topic: string;
  velocity: number;
  mentions_last_24_hours: number;
  sentiment_avg: number;
  is_trending: boolean;
}

interface BreakingNewsItem {
  id: string;
  title: string;
  source_name: string;
  published_date: string;
  threat_level: string;
  source_url: string;
}

export function NewsIntelligencePanel() {
  const [isOpen, setIsOpen] = useState(true);
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([]);
  const [breakingNews, setBreakingNews] = useState<BreakingNewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch trending topics
    const { data: topics } = await supabase
      .from('bluesky_trends')
      .select('id, topic, velocity, mentions_last_24_hours, sentiment_avg, is_trending')
      .eq('is_trending', true)
      .order('velocity', { ascending: false })
      .limit(6);

    // Fetch high-impact news (last 24 hours)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const { data: news } = await supabase
      .from('articles')
      .select('id, title, source_name, published_date, threat_level, source_url')
      .in('threat_level', ['critical', 'high'])
      .gte('published_date', yesterday.toISOString())
      .order('published_date', { ascending: false })
      .limit(5);

    setTrendingTopics(topics || []);
    setBreakingNews(news || []);
    setLoading(false);
  };

  const getVelocityColor = (velocity: number) => {
    if (velocity > 300) return "text-destructive";
    if (velocity > 150) return "text-warning";
    return "text-success";
  };

  const getThreatBadge = (level: string) => {
    switch (level) {
      case 'critical':
        return <Badge variant="destructive" className="text-xs">Critical</Badge>;
      case 'high':
        return <Badge className="bg-warning/20 text-warning border-warning/30 text-xs">High</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">{level}</Badge>;
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-border/50">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Newspaper className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">News Intelligence</CardTitle>
                <Badge variant="outline" className="ml-2">
                  {trendingTopics.length + breakingNews.length} items
                </Badge>
              </div>
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0">
            {loading ? (
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                  ))}
                </div>
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {/* Trending Topics */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <h4 className="font-semibold text-sm">Trending Now</h4>
                  </div>
                  <div className="space-y-2">
                    {trendingTopics.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No trending topics detected</p>
                    ) : (
                      trendingTopics.map((topic) => (
                        <div
                          key={topic.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Flame className={`h-4 w-4 ${getVelocityColor(topic.velocity || 0)}`} />
                            <span className="text-sm font-medium truncate max-w-[180px]">
                              {topic.topic}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-mono ${getVelocityColor(topic.velocity || 0)}`}>
                              {Math.round(topic.velocity || 0)}↑
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {topic.mentions_last_24_hours || 0} mentions
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* High-Impact News */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <h4 className="font-semibold text-sm">High-Impact News</h4>
                  </div>
                  <div className="space-y-2">
                    {breakingNews.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No high-impact news in the last 24 hours</p>
                    ) : (
                      breakingNews.map((item) => (
                        <div
                          key={item.id}
                          className="p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium line-clamp-2">{item.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-muted-foreground">
                                  {item.source_name}
                                </span>
                                <span className="text-xs text-muted-foreground">•</span>
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(item.published_date), { addSuffix: true })}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {getThreatBadge(item.threat_level)}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => window.open(item.source_url, '_blank')}
                              >
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
