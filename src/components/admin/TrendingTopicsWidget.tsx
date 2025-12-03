import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
    if (velocity >= 50) return "text-destructive";
    if (velocity >= 20) return "text-warning";
    return "text-primary";
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className={`flex-shrink-0 pb-2 ${showDragHandle ? "cursor-move" : ""}`}>
        <div className="flex items-center gap-2">
          {showDragHandle && (
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          )}
          <TrendingUp className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-medium">Trending Topics</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pt-0">
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : topics.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No trending topics at this time
          </p>
        ) : (
          <ScrollArea className="h-full pr-2">
            <div className="space-y-2">
              {topics.map((topic) => (
                <div
                  key={topic.id}
                  className="flex items-center justify-between p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                >
                  <span className="text-sm font-medium truncate max-w-[60%]" title={topic.topic}>
                    {topic.topic}
                  </span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="outline" className="text-xs">
                      {topic.mentions_last_hour || 0}
                    </Badge>
                    <span className={`text-xs font-semibold ${getVelocityColor(topic.velocity)}`}>
                      +{topic.velocity?.toFixed(0) || 0}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
