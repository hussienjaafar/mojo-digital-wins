import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Newspaper, ExternalLink, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface BreakingNewsItem {
  id: string;
  title: string;
  source_name: string;
  published_date: string;
  source_url: string;
  threat_level: string | null;
}

interface HighImpactNewsWidgetProps {
  showDragHandle?: boolean;
}

export function HighImpactNewsWidget({ showDragHandle = false }: HighImpactNewsWidgetProps) {
  const [news, setNews] = useState<BreakingNewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      const { data, error } = await supabase
        .from("articles")
        .select("id, title, source_name, published_date, source_url, threat_level")
        .in("threat_level", ["high", "critical"])
        .order("published_date", { ascending: false })
        .limit(6);

      if (error) throw error;
      setNews(data || []);
    } catch (error) {
      console.error("Error fetching high-impact news:", error);
    } finally {
      setLoading(false);
    }
  };

  const getThreatBadge = (level: string | null) => {
    switch (level) {
      case "critical":
        return <Badge variant="destructive" className="text-xs">Critical</Badge>;
      case "high":
        return <Badge className="bg-warning text-warning-foreground text-xs">High</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className={`flex-shrink-0 pb-2 ${showDragHandle ? "cursor-move" : ""}`}>
        <div className="flex items-center gap-2">
          {showDragHandle && (
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          )}
          <Newspaper className="h-4 w-4 text-destructive" />
          <CardTitle className="text-sm font-medium">High-Impact News</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto min-h-0 pt-0">
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : news.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No high-impact news at this time
          </p>
        ) : (
          <div className="space-y-3">
            {news.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-md border border-border/50 hover:border-border transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="text-sm font-medium line-clamp-2 flex-1" title={item.title}>
                    {item.title}
                  </h4>
                  {getThreatBadge(item.threat_level)}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate max-w-[50%]">{item.source_name}</span>
                  <div className="flex items-center gap-2">
                    <span>
                      {formatDistanceToNow(new Date(item.published_date), { addSuffix: true })}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      asChild
                    >
                      <a href={item.source_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
