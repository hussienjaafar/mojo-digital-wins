import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Target
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Props = {
  organizationId: string;
};

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
    <div className="w-full bg-muted rounded-full h-2">
      <div 
        className={cn(
          "h-2 rounded-full transition-all",
          percent >= 70 ? "bg-green-500" : percent >= 40 ? "bg-yellow-500" : "bg-red-500"
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export function CreativeInsights({ organizationId }: Props) {
  const [learnings, setLearnings] = useState<Learning[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeChannel, setActiveChannel] = useState<string>("all");

  const loadLearnings = useCallback(async () => {
    try {
      let query = supabase
        .from("creative_performance_learnings")
        .select("*")
        .order("effectiveness_score", { ascending: false, nullsFirst: false })
        .limit(50);

      // Try org-specific first, fall back to global
      const { data: orgData, error: orgError } = await query
        .eq("organization_id", organizationId);

      if (orgError) {
        console.error("Error loading org learnings:", orgError);
      }

      // Also get global learnings
      const { data: globalData, error: globalError } = await supabase
        .from("creative_performance_learnings")
        .select("*")
        .is("organization_id", null)
        .order("effectiveness_score", { ascending: false, nullsFirst: false })
        .limit(20);

      if (globalError) {
        console.error("Error loading global learnings:", globalError);
      }

      // Combine and dedupe
      const combined = [...(orgData || []), ...(globalData || [])];
      setLearnings(combined);
    } catch (error) {
      console.error("Failed to load learnings:", error);
    }
  }, [organizationId]);

  useEffect(() => {
    setIsLoading(true);
    loadLearnings().finally(() => setIsLoading(false));
  }, [loadLearnings]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Trigger learning calculation
      const { error } = await supabase.functions.invoke("calculate-creative-learnings", {
        body: { organization_id: organizationId }
      });
      
      if (error) throw error;
      
      await loadLearnings();
      toast.success("Creative insights refreshed");
    } catch (err) {
      console.error("Refresh error:", err);
      toast.error("Failed to refresh insights");
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredLearnings = activeChannel === "all" 
    ? learnings 
    : learnings.filter(l => l.channel === activeChannel);

  // Group learnings by category
  const topTopics = filteredLearnings
    .filter(l => l.topic)
    .slice(0, 5);

  const topTones = filteredLearnings
    .filter(l => l.tone)
    .slice(0, 5);

  const optimalTiming = filteredLearnings
    .filter(l => l.optimal_hour !== null || l.optimal_day !== null)
    .slice(0, 3);

  const topCTAs = filteredLearnings
    .filter(l => l.call_to_action)
    .slice(0, 5);

  if (isLoading) {
    return (
      <Card className="portal-animate-fade-in">
        <CardContent className="p-6">
          <div className="space-y-3">
            <div className="h-6 w-48 portal-skeleton rounded" />
            <div className="h-4 w-full portal-skeleton rounded" />
            <div className="h-4 w-3/4 portal-skeleton rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Lightbulb className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Creative Intelligence</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                AI-powered insights from your campaigns
              </p>
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
      </CardHeader>
      <CardContent>
        <Tabs value={activeChannel} onValueChange={setActiveChannel} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="all" className="gap-2">
              <Sparkles className="h-4 w-4" />
              All
            </TabsTrigger>
            <TabsTrigger value="sms" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              SMS
            </TabsTrigger>
            <TabsTrigger value="meta" className="gap-2">
              <Image className="h-4 w-4" />
              Meta
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeChannel} className="space-y-6">
            {learnings.length === 0 ? (
              <div className="text-center py-8">
                <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  No creative insights yet. Sync your campaigns to generate learnings.
                </p>
              </div>
            ) : (
              <>
                {/* Top Performing Topics */}
                {topTopics.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      Top Performing Topics
                    </h4>
                    <div className="space-y-2">
                      {topTopics.map((learning) => (
                        <div key={learning.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm capitalize">{learning.topic}</span>
                              <Badge variant="outline" className="text-xs">
                                {learning.channel}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                              <span>Click: {formatPercent(learning.avg_click_rate)}</span>
                              <span>Conv: {formatPercent(learning.avg_conversion_rate)}</span>
                              <span>{learning.sample_size} samples</span>
                            </div>
                          </div>
                          <div className="w-24">
                            <EffectivenessBar score={learning.effectiveness_score} />
                            <p className="text-xs text-muted-foreground text-right mt-1">
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
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      Best Send Times
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {optimalTiming.map((learning) => (
                        <div key={learning.id} className="p-3 rounded-lg border bg-muted/30 text-center">
                          <Badge variant="secondary" className="mb-2">
                            {learning.channel}
                          </Badge>
                          <p className="text-lg font-bold">
                            {learning.optimal_day !== null && DAYS[learning.optimal_day]}
                            {learning.optimal_hour !== null && ` ${formatHour(learning.optimal_hour)}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatPercent(learning.avg_conversion_rate)} conv rate
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top Tones */}
                {topTones.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Effective Message Tones
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {topTones.map((learning) => (
                        <Badge 
                          key={learning.id} 
                          variant="secondary"
                          className="py-1.5 px-3 capitalize"
                        >
                          {learning.tone}
                          <span className="ml-2 opacity-70">
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
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      High-Converting CTAs
                    </h4>
                    <div className="space-y-2">
                      {topCTAs.map((learning) => (
                        <div key={learning.id} className="flex items-center gap-3 p-2 rounded border">
                          <Badge variant="outline" className="text-xs shrink-0">
                            {learning.channel}
                          </Badge>
                          <span className="text-sm font-medium capitalize flex-1">
                            {learning.call_to_action}
                          </span>
                          <span className="text-xs text-muted-foreground">
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
      </CardContent>
    </Card>
  );
}
