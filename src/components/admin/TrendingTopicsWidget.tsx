import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TrendingUp, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TrendingTopic {
  id: string;
  topic: string;
  velocity: number;
  mentions_last_hour: number;
}

interface TrendingTopicsWidgetProps {
  showDragHandle?: boolean;
}

export function TrendingTopicsWidget({ showDragHandle = false }: TrendingTopicsWidgetProps) {
  const [topics, setTopics] = useState<TrendingTopic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTopics();
  }, []);

  const fetchTopics = async () => {
    try {
      const { data, error } = await supabase
        .from("bluesky_trends")
        .select("id, topic, velocity, mentions_last_hour")
        .eq("is_trending", true)
        .order("velocity", { ascending: false })
        .limit(8);

      if (error) throw error;
      setTopics(data || []);
    } catch (error) {
      console.error("Error fetching trending topics:", error);
    } finally {
      setLoading(false);
    }
  };

  const getVelocityColor = (velocity: number) => {
    if (velocity >= 50) return "text-[hsl(var(--portal-accent-red))]";
    if (velocity >= 20) return "text-[hsl(var(--portal-accent-orange))]";
    return "text-[hsl(var(--portal-accent-blue))]";
  };

  return (
    <div className="portal-card portal-widget-teal h-full flex flex-col">
      <div className={`p-4 pb-3 flex-shrink-0 portal-widget-header-teal ${showDragHandle ? "cursor-move" : ""}`}>
        <div className="flex items-center gap-3">
          {showDragHandle && (
            <GripVertical className="h-4 w-4 portal-text-secondary" />
          )}
          <div className="portal-widget-icon portal-widget-icon-teal">
            <TrendingUp className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold portal-text-primary">Trending Topics</h3>
        </div>
      </div>
      <div className="p-4 pt-0 flex-1 min-h-0">
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : topics.length === 0 ? (
          <p className="text-sm portal-text-secondary text-center py-4">
            No trending topics at this time
          </p>
        ) : (
          <ScrollArea className="h-full pr-2 portal-scrollbar">
            <div className="space-y-2">
              {topics.map((topic) => (
                <div
                  key={topic.id}
                  className="flex items-center justify-between p-2 rounded-md bg-[hsl(var(--portal-bg-elevated))] hover:bg-[hsl(var(--portal-bg-hover))] transition-colors"
                >
                  <span className="text-sm font-medium portal-text-primary truncate max-w-[60%]" title={topic.topic}>
                    {topic.topic}
                  </span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="portal-badge-info portal-badge text-xs">
                      {topic.mentions_last_hour || 0}
                    </span>
                    <span className={`text-xs font-semibold ${getVelocityColor(topic.velocity)}`}>
                      +{topic.velocity?.toFixed(0) || 0}%
                    </span>
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
