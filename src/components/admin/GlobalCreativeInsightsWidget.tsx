import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Lightbulb, 
  Clock, 
  TrendingUp, 
  MessageSquare, 
  Image, 
  RefreshCw,
  Sparkles,
  Target,
  GripVertical
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Learning = {
  id: string;
  channel: string;
  topic: string | null;
  tone: string | null;
  urgency_level: string | null;
  call_to_action: string | null;
  emotional_appeal: string | null;
  optimal_hour: number | null;
  optimal_day: number | null;
  avg_click_rate: number | null;
  avg_conversion_rate: number | null;
  avg_roas: number | null;
  effectiveness_score: number | null;
  confidence_level: number | null;
  sample_size: number | null;
};

type Props = {
  showDragHandle?: boolean;
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatHour(hour: number | null): string {
  if (hour === null) return '-';
  const period = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  return `${h}${period}`;
}

function formatPercent(value: number | null): string {
  if (value === null) return '-';
  return `${(value * 100).toFixed(1)}%`;
}

function EffectivenessBar({ score }: { score: number | null }) {
  const percent = score ? Math.min(score * 100, 100) : 0;
  return (
    <div className="w-full bg-[hsl(var(--portal-border))] rounded-full h-2">
      <div 
        className={cn(
          "h-2 rounded-full transition-all",
          percent >= 70 ? "bg-[hsl(var(--portal-accent-green))]" : 
          percent >= 40 ? "bg-[hsl(var(--portal-accent-orange))]" : 
          "bg-[hsl(var(--portal-accent-red))]"
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export function GlobalCreativeInsightsWidget({ showDragHandle }: Props) {
  const [learnings, setLearnings] = useState<Learning[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeChannel, setActiveChannel] = useState<string>("all");

  const loadLearnings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("creative_performance_learnings")
        .select("*")
        .is("organization_id", null)
        .order("effectiveness_score", { ascending: false, nullsFirst: false })
        .limit(50);

      if (error) {
        console.error("Error loading global learnings:", error);
        return;
      }

      setLearnings(data || []);
    } catch (error) {
      console.error("Failed to load learnings:", error);
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    loadLearnings().finally(() => setIsLoading(false));
  }, [loadLearnings]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const { error } = await supabase.functions.invoke("calculate-creative-learnings", {
        body: {} // Empty body triggers global calculation
      });
      
      if (error) throw error;
      
      await loadLearnings();
      toast.success("Global creative insights recalculated");
    } catch (err) {
      console.error("Refresh error:", err);
      toast.error("Failed to recalculate insights");
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredLearnings = activeChannel === "all" 
    ? learnings 
    : learnings.filter(l => l.channel === activeChannel);

  const topTopics = filteredLearnings.filter(l => l.topic).slice(0, 5);
  const topTones = filteredLearnings.filter(l => l.tone).slice(0, 5);
  const optimalTiming = filteredLearnings.filter(l => l.optimal_hour !== null || l.optimal_day !== null).slice(0, 3);
  const topCTAs = filteredLearnings.filter(l => l.call_to_action).slice(0, 5);

  if (isLoading) {
    return (
      <div className="portal-card h-full">
        <div className="p-4 space-y-3">
          <div className="h-6 w-48 portal-skeleton rounded" />
          <div className="h-4 w-full portal-skeleton rounded" />
          <div className="h-4 w-3/4 portal-skeleton rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="portal-card portal-widget-purple h-full flex flex-col">
      <div className={`p-4 border-b border-[hsl(var(--portal-border))] portal-widget-header-purple ${showDragHandle ? 'cursor-move' : ''}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showDragHandle && (
              <GripVertical className="h-5 w-5 portal-text-secondary" />
            )}
            <div className="portal-widget-icon portal-widget-icon-purple">
              <Lightbulb className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold portal-text-primary">Global Creative Insights</h3>
              <p className="text-xs portal-text-secondary">Aggregate learnings across all clients</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-8 w-8"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <Tabs value={activeChannel} onValueChange={setActiveChannel} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4 h-9">
            <TabsTrigger value="all" className="gap-1.5 text-xs">
              <Sparkles className="h-3.5 w-3.5" />
              All
            </TabsTrigger>
            <TabsTrigger value="sms" className="gap-1.5 text-xs">
              <MessageSquare className="h-3.5 w-3.5" />
              SMS
            </TabsTrigger>
            <TabsTrigger value="meta" className="gap-1.5 text-xs">
              <Image className="h-3.5 w-3.5" />
              Meta
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeChannel} className="space-y-4 mt-0">
            {learnings.length === 0 ? (
              <div className="text-center py-8">
                <Lightbulb className="h-10 w-10 portal-text-secondary mx-auto mb-3" />
                <p className="portal-text-secondary text-sm">
                  No global insights yet. Click refresh to calculate learnings.
                </p>
              </div>
            ) : (
              <>
                {/* Top Performing Topics */}
                {topTopics.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold mb-2 flex items-center gap-2 portal-text-primary">
                      <Target className="h-3.5 w-3.5 text-[hsl(var(--portal-accent-blue))]" />
                      Top Performing Topics
                    </h4>
                    <div className="space-y-1.5">
                      {topTopics.slice(0, 3).map((learning) => (
                        <div key={learning.id} className="flex items-center justify-between p-2 rounded-lg border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-card-bg))]">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-xs capitalize truncate portal-text-primary">{learning.topic}</span>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                                {learning.channel}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-[10px] portal-text-secondary">
                              <span>CTR: {formatPercent(learning.avg_click_rate)}</span>
                              <span>{learning.sample_size} samples</span>
                            </div>
                          </div>
                          <div className="w-16 ml-2">
                            <EffectivenessBar score={learning.effectiveness_score} />
                            <p className="text-[10px] portal-text-secondary text-right mt-0.5">
                              {Math.round((learning.effectiveness_score || 0) * 100)}%
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Optimal Timing */}
                {optimalTiming.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold mb-2 flex items-center gap-2 portal-text-primary">
                      <Clock className="h-3.5 w-3.5 text-[hsl(var(--portal-accent-green))]" />
                      Best Send Times
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                      {optimalTiming.map((learning) => (
                        <div key={learning.id} className="p-2 rounded-lg border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-muted))] text-center">
                          <Badge variant="secondary" className="mb-1 text-[10px] px-1.5 py-0">
                            {learning.channel}
                          </Badge>
                          <p className="text-sm font-bold portal-text-primary">
                            {learning.optimal_day !== null && DAYS[learning.optimal_day]}
                            {learning.optimal_hour !== null && ` ${formatHour(learning.optimal_hour)}`}
                          </p>
                          <p className="text-[10px] portal-text-secondary">
                            {formatPercent(learning.avg_conversion_rate)} conv
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top Tones */}
                {topTones.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold mb-2 flex items-center gap-2 portal-text-primary">
                      <TrendingUp className="h-3.5 w-3.5 text-[hsl(var(--portal-accent-orange))]" />
                      Effective Tones
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {topTones.slice(0, 4).map((learning) => (
                        <Badge 
                          key={learning.id} 
                          variant="secondary"
                          className="py-1 px-2 capitalize text-xs"
                        >
                          {learning.tone}
                          <span className="ml-1.5 opacity-70">
                            {Math.round((learning.effectiveness_score || 0) * 100)}%
                          </span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top CTAs */}
                {topCTAs.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold mb-2 flex items-center gap-2 portal-text-primary">
                      <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--portal-accent-purple))]" />
                      High-Converting CTAs
                    </h4>
                    <div className="space-y-1">
                      {topCTAs.slice(0, 3).map((learning) => (
                        <div key={learning.id} className="flex items-center gap-2 p-1.5 rounded border border-[hsl(var(--portal-border))]">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                            {learning.channel}
                          </Badge>
                          <span className="text-xs font-medium capitalize flex-1 truncate portal-text-primary">
                            {learning.call_to_action}
                          </span>
                          <span className="text-[10px] portal-text-secondary shrink-0">
                            {formatPercent(learning.avg_click_rate)} CTR
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
