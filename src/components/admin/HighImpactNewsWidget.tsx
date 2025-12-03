import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
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
        return <span className="portal-badge portal-badge-error text-xs">Critical</span>;
      case "high":
        return <span className="portal-badge portal-badge-warning text-xs">High</span>;
      default:
        return null;
    }
  };

  return (
    <div className="portal-card h-full flex flex-col">
      <div className={`p-4 pb-2 flex-shrink-0 ${showDragHandle ? "cursor-move" : ""}`}>
        <div className="flex items-center gap-2">
          {showDragHandle && (
            <GripVertical className="h-4 w-4 portal-text-secondary" />
          )}
          <Newspaper className="h-4 w-4 text-[hsl(var(--portal-accent-red))]" />
          <h3 className="text-sm font-medium portal-text-primary">High-Impact News</h3>
        </div>
      </div>
      <div className="p-4 pt-0 flex-1 min-h-0">
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : news.length === 0 ? (
          <p className="text-sm portal-text-secondary text-center py-4">
            No high-impact news at this time
          </p>
        ) : (
          <ScrollArea className="h-full pr-2 portal-scrollbar">
            <div className="space-y-3">
              {news.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-md border border-[hsl(var(--portal-border))] hover:border-[hsl(var(--portal-border-strong))] transition-colors bg-[hsl(var(--portal-bg-elevated))]"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="text-sm font-medium portal-text-primary line-clamp-2 flex-1" title={item.title}>
                      {item.title}
                    </h4>
                    {getThreatBadge(item.threat_level)}
                  </div>
                  <div className="flex items-center justify-between text-xs portal-text-secondary">
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
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
