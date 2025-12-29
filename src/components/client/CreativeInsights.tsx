import { useState } from "react";
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
import { useCreativeInsightsQuery, useRefreshCreativeInsights } from "@/queries/useCreativeInsightsQuery";
import { 
  V3Card, 
  V3CardHeader, 
  V3CardTitle, 
  V3CardContent, 
  V3Badge, 
  V3Button 
} from "@/components/v3";
import { iconSizes } from "@/lib/design-tokens";

type Props = {
  organizationId: string;
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
    <div className="w-full bg-[hsl(var(--portal-bg-secondary))] rounded-full h-2">
      <div 
        className={cn(
          "h-2 rounded-full transition-all",
          percent >= 70 
            ? "bg-[hsl(var(--portal-success))]" 
            : percent >= 40 
              ? "bg-[hsl(var(--portal-warning))]" 
              : "bg-[hsl(var(--portal-error))]"
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export function CreativeInsights({ organizationId }: Props) {
  const [activeChannel, setActiveChannel] = useState<string>("all");
  
  const { data: learnings = [], isLoading } = useCreativeInsightsQuery(organizationId);
  const refreshMutation = useRefreshCreativeInsights(organizationId);

  const handleRefresh = async () => {
    try {
      await refreshMutation.mutateAsync();
      toast.success("Creative insights refreshed");
    } catch (err) {
      console.error("Refresh error:", err);
      toast.error("Failed to refresh insights");
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
      <V3Card className="animate-fade-in">
        <V3CardContent className="p-6">
          <div className="space-y-3">
            <div className="h-6 w-48 bg-[hsl(var(--portal-bg-secondary))] rounded animate-pulse" />
            <div className="h-4 w-full bg-[hsl(var(--portal-bg-secondary))] rounded animate-pulse" />
            <div className="h-4 w-3/4 bg-[hsl(var(--portal-bg-secondary))] rounded animate-pulse" />
          </div>
        </V3CardContent>
      </V3Card>
    );
  }

  return (
    <V3Card>
      <V3CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[hsl(var(--portal-accent-blue)/0.1)]">
              <Lightbulb className={cn(iconSizes.md, "text-[hsl(var(--portal-accent-blue))]")} />
            </div>
            <div>
              <V3CardTitle>Creative Intelligence</V3CardTitle>
              <p className="text-sm text-[hsl(var(--portal-text-muted))] mt-0.5">
                AI-powered insights from your campaigns
              </p>
            </div>
          </div>
          <V3Button
            variant="ghost"
            size="icon-sm"
            onClick={handleRefresh}
            isLoading={refreshMutation.isPending}
          >
            <RefreshCw className={cn(iconSizes.sm, refreshMutation.isPending && "animate-spin")} />
          </V3Button>
        </div>
      </V3CardHeader>
      <V3CardContent>
        <Tabs value={activeChannel} onValueChange={setActiveChannel} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4 bg-[hsl(var(--portal-bg-secondary))]">
            <TabsTrigger value="all" className="gap-2 data-[state=active]:bg-[hsl(var(--portal-bg-primary))]">
              <Sparkles className={iconSizes.sm} />
              All
            </TabsTrigger>
            <TabsTrigger value="sms" className="gap-2 data-[state=active]:bg-[hsl(var(--portal-bg-primary))]">
              <MessageSquare className={iconSizes.sm} />
              SMS
            </TabsTrigger>
            <TabsTrigger value="meta" className="gap-2 data-[state=active]:bg-[hsl(var(--portal-bg-primary))]">
              <Image className={iconSizes.sm} />
              Meta
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeChannel} className="space-y-6">
            {learnings.length === 0 ? (
              <div className="text-center py-8">
                <Lightbulb className={cn(iconSizes['2xl'], "text-[hsl(var(--portal-text-muted))] mx-auto mb-3")} />
                <p className="text-[hsl(var(--portal-text-muted))]">
                  No creative insights yet. Sync your campaigns to generate learnings.
                </p>
              </div>
            ) : (
              <>
                {/* Top Performing Topics */}
                {topTopics.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-[hsl(var(--portal-text-primary))]">
                      <Target className={cn(iconSizes.sm, "text-[hsl(var(--portal-accent-blue))]")} />
                      Top Performing Topics
                    </h4>
                    <div className="space-y-2">
                      {topTopics.map((learning) => (
                        <div 
                          key={learning.id} 
                          className="flex items-center justify-between p-3 rounded-lg border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-card))]"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm capitalize text-[hsl(var(--portal-text-primary))]">
                                {learning.topic}
                              </span>
                              <V3Badge variant="outline" size="sm">
                                {learning.channel}
                              </V3Badge>
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-xs text-[hsl(var(--portal-text-muted))]">
                              <span>Click: {formatPercent(learning.avg_click_rate)}</span>
                              <span>Conv: {formatPercent(learning.avg_conversion_rate)}</span>
                              <span>{learning.sample_size} samples</span>
                            </div>
                          </div>
                          <div className="w-24">
                            <EffectivenessBar score={learning.effectiveness_score} />
                            <p className="text-xs text-[hsl(var(--portal-text-muted))] text-right mt-1">
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
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-[hsl(var(--portal-text-primary))]">
                      <Clock className={cn(iconSizes.sm, "text-[hsl(var(--portal-accent-blue))]")} />
                      Best Send Times
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {optimalTiming.map((learning) => (
                        <div 
                          key={learning.id} 
                          className="p-3 rounded-lg border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-secondary)/0.3)] text-center"
                        >
                          <V3Badge variant="secondary" className="mb-2">
                            {learning.channel}
                          </V3Badge>
                          <p className="text-lg font-bold text-[hsl(var(--portal-text-primary))]">
                            {learning.optimal_day !== null && DAYS[learning.optimal_day]}
                            {learning.optimal_hour !== null && ` ${formatHour(learning.optimal_hour)}`}
                          </p>
                          <p className="text-xs text-[hsl(var(--portal-text-muted))]">
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
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-[hsl(var(--portal-text-primary))]">
                      <TrendingUp className={cn(iconSizes.sm, "text-[hsl(var(--portal-accent-blue))]")} />
                      Effective Message Tones
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {topTones.map((learning) => (
                        <V3Badge 
                          key={learning.id} 
                          variant="secondary"
                          size="lg"
                          className="capitalize"
                        >
                          {learning.tone}
                          <span className="ml-2 opacity-70">
                            {Math.round((learning.effectiveness_score || 0) * 100)}%
                          </span>
                        </V3Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top CTAs */}
                {topCTAs.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-[hsl(var(--portal-text-primary))]">
                      <Sparkles className={cn(iconSizes.sm, "text-[hsl(var(--portal-accent-blue))]")} />
                      High-Converting CTAs
                    </h4>
                    <div className="space-y-2">
                      {topCTAs.map((learning) => (
                        <div 
                          key={learning.id} 
                          className="flex items-center gap-3 p-2 rounded border border-[hsl(var(--portal-border))]"
                        >
                          <V3Badge variant="outline" size="sm" className="shrink-0">
                            {learning.channel}
                          </V3Badge>
                          <span className="text-sm font-medium capitalize flex-1 text-[hsl(var(--portal-text-primary))]">
                            {learning.call_to_action}
                          </span>
                          <span className="text-xs text-[hsl(var(--portal-text-muted))]">
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
      </V3CardContent>
    </V3Card>
  );
}
