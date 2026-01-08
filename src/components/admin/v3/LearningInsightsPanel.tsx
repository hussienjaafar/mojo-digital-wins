import React from 'react';
import { motion } from 'framer-motion';
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  BarChart3,
  Lightbulb,
  Target,
  Zap
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useActionEffectiveness, useLearningSignals } from '@/hooks/useLearningSignals';

interface ActionInsight {
  action_type: string;
  success_rate: number;
  total_actions: number;
  avg_outcome_value: number;
}

function ActionInsightCard({ insight }: { insight: ActionInsight }) {
  const getActionIcon = (type: string) => {
    switch (type) {
      case 'sms': return '📱';
      case 'email': return '✉️';
      case 'alert': return '🔔';
      case 'watchlist': return '👁️';
      default: return '⚡';
    }
  };

  const getSuccessColor = (rate: number) => {
    if (rate >= 60) return 'text-green-500';
    if (rate >= 40) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2">
        <span className="text-lg">{getActionIcon(insight.action_type)}</span>
        <div>
          <span className="font-medium capitalize text-sm">{insight.action_type}</span>
          <p className="text-xs text-muted-foreground">
            {insight.total_actions} actions
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-16">
          <Progress value={insight.success_rate} className="h-1.5" />
        </div>
        <span className={`text-sm font-medium ${getSuccessColor(insight.success_rate)}`}>
          {insight.success_rate}%
        </span>
      </div>
    </div>
  );
}

function LearningSignalBadge({ 
  signalType, 
  weight 
}: { 
  signalType: string; 
  weight: number;
}) {
  const isPositive = weight > 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  
  return (
    <Badge 
      variant="outline" 
      className={`text-xs ${isPositive ? 'border-green-500/50 text-green-600' : 'border-red-500/50 text-red-600'}`}
    >
      <Icon className="w-3 h-3 mr-1" />
      {signalType}: {isPositive ? '+' : ''}{weight.toFixed(1)}
    </Badge>
  );
}

export function LearningInsightsPanel() {
  const { data: effectiveness, isLoading: loadingEffectiveness } = useActionEffectiveness();
  const { data: signals, isLoading: loadingSignals } = useLearningSignals();

  // Aggregate effectiveness by action type
  const actionInsights: ActionInsight[] = React.useMemo(() => {
    if (!effectiveness) return [];
    
    const byType = new Map<string, { total: number; successful: number; value: number; count: number }>();
    
    effectiveness.forEach(e => {
      const existing = byType.get(e.action_type) || { total: 0, successful: 0, value: 0, count: 0 };
      byType.set(e.action_type, {
        total: existing.total + e.total_actions,
        successful: existing.successful + e.successful_actions,
        value: existing.value + e.total_outcome_value,
        count: existing.count + 1,
      });
    });

    return Array.from(byType.entries()).map(([action_type, stats]) => ({
      action_type,
      success_rate: stats.total > 0 ? Math.round((stats.successful / stats.total) * 100) : 0,
      total_actions: stats.total,
      avg_outcome_value: stats.count > 0 ? stats.value / stats.count : 0,
    })).sort((a, b) => b.success_rate - a.success_rate);
  }, [effectiveness]);

  // Top learning signals
  const topSignals = React.useMemo(() => {
    if (!signals) return [];
    return signals.slice(0, 5);
  }, [signals]);

  const isLoading = loadingEffectiveness || loadingSignals;

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasData = actionInsights.length > 0 || topSignals.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            Learning Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasData ? (
            <div className="text-center py-6 text-muted-foreground">
              <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No learning data yet</p>
              <p className="text-xs mt-1">Take actions on trends to build insights</p>
            </div>
          ) : (
            <>
              {/* Action Effectiveness */}
              {actionInsights.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Action Success Rates
                    </span>
                  </div>
                  <div className="space-y-1">
                    {actionInsights.slice(0, 4).map((insight) => (
                      <ActionInsightCard key={insight.action_type} insight={insight} />
                    ))}
                  </div>
                </div>
              )}

              {/* Top Learning Signals */}
              {topSignals.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Pattern Weights
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {topSignals.map((signal) => (
                      <LearningSignalBadge 
                        key={signal.id}
                        signalType={signal.pattern_key}
                        weight={signal.weight_adjustment}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50">
                <div className="text-center py-2 bg-muted/30 rounded-md">
                  <BarChart3 className="w-4 h-4 mx-auto mb-1 text-primary" />
                  <p className="text-lg font-semibold">
                    {actionInsights.reduce((sum, a) => sum + a.total_actions, 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Actions</p>
                </div>
                <div className="text-center py-2 bg-muted/30 rounded-md">
                  <TrendingUp className="w-4 h-4 mx-auto mb-1 text-green-500" />
                  <p className="text-lg font-semibold">
                    {actionInsights.length > 0 
                      ? Math.round(actionInsights.reduce((sum, a) => sum + a.success_rate, 0) / actionInsights.length)
                      : 0}%
                  </p>
                  <p className="text-xs text-muted-foreground">Avg Success</p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
