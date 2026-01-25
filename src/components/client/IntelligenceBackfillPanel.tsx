import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Database, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Brain, 
  Activity,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { V3Card, V3CardContent, V3Button, V3Badge } from "@/components/v3";
import { Progress } from "@/components/ui/progress";

interface BackfillStatus {
  phase: string;
  progress: number;
  message: string;
}

interface IntelligenceBackfillPanelProps {
  organizationId: string;
  correlationsCount: number;
  fatigueAlertsCount: number;
  analyzedCreativesCount: number;
  totalCreativesCount: number;
  onComplete?: () => void;
}

export function IntelligenceBackfillPanel({
  organizationId,
  correlationsCount,
  fatigueAlertsCount,
  analyzedCreativesCount,
  totalCreativesCount,
  onComplete
}: IntelligenceBackfillPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState<BackfillStatus | null>(null);

  const needsBackfill = correlationsCount === 0 || 
    (analyzedCreativesCount / totalCreativesCount) < 0.5;

  const runFullBackfill = async () => {
    if (!organizationId) return;
    setIsRunning(true);
    
    try {
      // Phase 1: Aggregate metrics
      setStatus({ phase: "Aggregating Metrics", progress: 15, message: "Updating creative-level metrics..." });
      await supabase.functions.invoke('aggregate-creative-metrics', {
        body: { organization_id: organizationId }
      });

      // Phase 2: AI Analysis backfill
      setStatus({ phase: "AI Analysis", progress: 35, message: "Analyzing unprocessed creatives..." });
      const { data: analysisResult } = await supabase.functions.invoke('backfill-creative-analysis', {
        body: { organization_id: organizationId, batch_size: 20 }
      });
      
      // Phase 3: Calculate correlations
      setStatus({ phase: "Correlation Engine", progress: 60, message: "Detecting performance patterns..." });
      await supabase.functions.invoke('calculate-creative-learnings', {
        body: { organization_id: organizationId, period_days: 180 }
      });

      // Phase 4: Detect fatigue
      setStatus({ phase: "Fatigue Detection", progress: 85, message: "Analyzing ad health trends..." });
      await supabase.functions.invoke('detect-ad-fatigue', {
        body: { organization_id: organizationId, min_spend: 50, decline_threshold: 15 }
      });

      setStatus({ phase: "Complete", progress: 100, message: "Intelligence engine activated!" });
      toast.success("Creative Intelligence backfill complete!");
      
      // Call onComplete after a short delay to allow UI to show success state
      setTimeout(() => {
        onComplete?.();
        setStatus(null);
        setIsRunning(false);
      }, 2000);

    } catch (error) {
      console.error('Backfill error:', error);
      toast.error('Backfill failed. Please try again.');
      setStatus(null);
      setIsRunning(false);
    }
  };

  const runQuickRefresh = async () => {
    if (!organizationId) return;
    setIsRunning(true);
    
    try {
      setStatus({ phase: "Refreshing", progress: 50, message: "Running correlation engine..." });
      
      await Promise.all([
        supabase.functions.invoke('calculate-creative-learnings', {
          body: { organization_id: organizationId, period_days: 90 }
        }),
        supabase.functions.invoke('detect-ad-fatigue', {
          body: { organization_id: organizationId }
        })
      ]);

      setStatus({ phase: "Complete", progress: 100, message: "Insights refreshed!" });
      toast.success("Intelligence refreshed!");
      
      setTimeout(() => {
        onComplete?.();
        setStatus(null);
        setIsRunning(false);
      }, 1500);

    } catch (error) {
      console.error('Refresh error:', error);
      toast.error('Refresh failed');
      setStatus(null);
      setIsRunning(false);
    }
  };

  // Compact status display when not expanded
  if (!isExpanded) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <V3Card 
          className={cn(
            "cursor-pointer transition-all duration-200",
            needsBackfill 
              ? "border-[hsl(var(--portal-accent-purple)/0.4)] bg-[hsl(var(--portal-accent-purple)/0.05)]"
              : "border-[hsl(var(--portal-border))]"
          )}
          onClick={() => setIsExpanded(true)}
        >
          <V3CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg",
                  needsBackfill 
                    ? "bg-[hsl(var(--portal-accent-purple)/0.15)]" 
                    : "bg-[hsl(var(--portal-success)/0.15)]"
                )}>
                  <Brain className={cn(
                    "h-4 w-4",
                    needsBackfill 
                      ? "text-[hsl(var(--portal-accent-purple))]" 
                      : "text-[hsl(var(--portal-success))]"
                  )} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                      Intelligence Engine
                    </span>
                    <V3Badge variant={needsBackfill ? "warning" : "success"}>
                      {needsBackfill ? "Needs Activation" : "Active"}
                    </V3Badge>
                  </div>
                  <p className="text-xs text-[hsl(var(--portal-text-muted))]">
                    {correlationsCount} patterns • {fatigueAlertsCount} alerts • {analyzedCreativesCount}/{totalCreativesCount} analyzed
                  </p>
                </div>
              </div>
              <ChevronDown className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
            </div>
          </V3CardContent>
        </V3Card>
      </motion.div>
    );
  }

  // Expanded panel
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <V3Card className="border-[hsl(var(--portal-accent-purple)/0.3)]">
        <V3CardContent className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-gradient-to-br from-[hsl(var(--portal-accent-purple))] to-[hsl(var(--portal-accent-blue))]">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-[hsl(var(--portal-text-primary))]">
                  Intelligence Engine
                </h3>
                <p className="text-xs text-[hsl(var(--portal-text-muted))]">
                  Autonomous pattern detection & optimization
                </p>
              </div>
            </div>
            <button 
              onClick={() => setIsExpanded(false)}
              className="p-1 hover:bg-[hsl(var(--portal-bg-secondary))] rounded transition-colors"
            >
              <ChevronUp className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
            </button>
          </div>

          {/* Status Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-[hsl(var(--portal-bg-secondary))]">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--portal-accent-purple))]" />
                <span className="text-xs text-[hsl(var(--portal-text-muted))]">Patterns</span>
              </div>
              <p className="text-lg font-semibold text-[hsl(var(--portal-text-primary))]">
                {correlationsCount}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[hsl(var(--portal-bg-secondary))]">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="h-3.5 w-3.5 text-[hsl(var(--portal-warning))]" />
                <span className="text-xs text-[hsl(var(--portal-text-muted))]">Fatigue Alerts</span>
              </div>
              <p className="text-lg font-semibold text-[hsl(var(--portal-text-primary))]">
                {fatigueAlertsCount}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[hsl(var(--portal-bg-secondary))]">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="h-3.5 w-3.5 text-[hsl(var(--portal-success))]" />
                <span className="text-xs text-[hsl(var(--portal-text-muted))]">Analyzed</span>
              </div>
              <p className="text-lg font-semibold text-[hsl(var(--portal-text-primary))]">
                {Math.round((analyzedCreativesCount / totalCreativesCount) * 100)}%
              </p>
            </div>
          </div>

          {/* Progress indicator when running */}
          <AnimatePresence>
            {status && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[hsl(var(--portal-text-primary))] font-medium">
                    {status.phase}
                  </span>
                  <span className="text-[hsl(var(--portal-text-muted))]">
                    {status.progress}%
                  </span>
                </div>
                <Progress value={status.progress} className="h-2" />
                <p className="text-xs text-[hsl(var(--portal-text-muted))]">
                  {status.message}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Buttons */}
          {!isRunning && (
            <div className="flex gap-2">
              {needsBackfill ? (
                <V3Button
                  onClick={runFullBackfill}
                  className="flex-1"
                >
                  <Database className="h-4 w-4 mr-2" />
                  Activate Intelligence Engine
                </V3Button>
              ) : (
                <>
                  <V3Button
                    variant="secondary"
                    onClick={runQuickRefresh}
                    className="flex-1"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Insights
                  </V3Button>
                  <V3Button
                    variant="ghost"
                    onClick={runFullBackfill}
                    size="sm"
                  >
                    Full Backfill
                  </V3Button>
                </>
              )}
            </div>
          )}

          {/* Info text */}
          {needsBackfill && !isRunning && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-[hsl(var(--portal-bg-secondary))]">
              <AlertCircle className="h-4 w-4 text-[hsl(var(--portal-accent-purple))] shrink-0 mt-0.5" />
              <p className="text-xs text-[hsl(var(--portal-text-muted))]">
                The intelligence engine needs to analyze your creatives to detect patterns. 
                This will take 1-3 minutes depending on data volume.
              </p>
            </div>
          )}
        </V3CardContent>
      </V3Card>
    </motion.div>
  );
}
