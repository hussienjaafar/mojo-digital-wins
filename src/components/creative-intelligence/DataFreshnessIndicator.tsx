import { useState, useEffect } from "react";
import { formatDistanceToNow, differenceInHours } from "date-fns";
import { Clock, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { V3Card, V3CardContent } from "@/components/v3/V3Card";
import { V3InsightBadge } from "@/components/v3/V3InsightBadge";

interface DataFreshnessIndicatorProps {
  organizationId: string;
  totalCreatives?: number;
  analyzedCreatives?: number;
  lastSyncedAt?: string | null;
}

export function DataFreshnessIndicator({
  organizationId,
  totalCreatives = 0,
  analyzedCreatives = 0,
  lastSyncedAt,
}: DataFreshnessIndicatorProps) {
  const [lastMetricDate, setLastMetricDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchLastMetricDate() {
      try {
        const { data, error } = await supabase
          .from("meta_ad_metrics_daily")
          .select("date")
          .eq("organization_id", organizationId)
          .order("date", { ascending: false })
          .limit(1)
          .single();

        if (!error && data) {
          setLastMetricDate(data.date);
        }
      } catch (e) {
        console.error("Error fetching last metric date:", e);
      } finally {
        setIsLoading(false);
      }
    }

    if (organizationId) {
      fetchLastMetricDate();
    }
  }, [organizationId]);

  const hoursStale = lastSyncedAt
    ? differenceInHours(new Date(), new Date(lastSyncedAt))
    : null;

  const isStale = hoursStale !== null && hoursStale > 24;
  const isVeryStale = hoursStale !== null && hoursStale > 72;

  const analysisPercent = totalCreatives > 0
    ? Math.round((analyzedCreatives / totalCreatives) * 100)
    : 0;

  return (
    <V3Card className={isVeryStale ? "border-[hsl(var(--portal-error)/0.5)]" : isStale ? "border-[hsl(var(--portal-warning)/0.5)]" : ""}>
      <V3CardContent className="py-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Stale data warning */}
          {isVeryStale && (
            <div className="flex items-center gap-2 text-[hsl(var(--portal-error))]">
              <AlertTriangle className="h-5 w-5" />
              <div>
                <div className="font-medium text-sm">Data is very stale</div>
                <div className="text-xs opacity-80">Last synced {hoursStale}+ hours ago</div>
              </div>
            </div>
          )}

          {isStale && !isVeryStale && (
            <div className="flex items-center gap-2 text-[hsl(var(--portal-warning))]">
              <AlertTriangle className="h-5 w-5" />
              <div>
                <div className="font-medium text-sm">Data may be outdated</div>
                <div className="text-xs opacity-80">Last synced {hoursStale}+ hours ago</div>
              </div>
            </div>
          )}

          {!isStale && lastSyncedAt && (
            <div className="flex items-center gap-2 text-[hsl(var(--portal-success))]">
              <CheckCircle className="h-5 w-5" />
              <div>
                <div className="font-medium text-sm">Data is fresh</div>
                <div className="text-xs opacity-80">
                  Synced {formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true })}
                </div>
              </div>
            </div>
          )}

          {/* Metrics summary */}
          <div className="flex flex-wrap items-center gap-4 sm:ml-auto text-sm">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
              <span className="text-[hsl(var(--portal-text-muted))]">
                {analyzedCreatives} of {totalCreatives} analyzed
              </span>
              <V3InsightBadge
                type={analysisPercent >= 80 ? "info" : analysisPercent >= 50 ? "anomaly-low" : "anomaly-high"}
              >
                {analysisPercent}%
              </V3InsightBadge>
            </div>

            {lastMetricDate && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
                <span className="text-[hsl(var(--portal-text-muted))]">
                  Latest metrics: {lastMetricDate}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Recommendations based on data state */}
        {(isStale || analysisPercent < 50) && (
          <div className="mt-3 pt-3 border-t border-[hsl(var(--portal-border))] text-xs text-[hsl(var(--portal-text-muted))]">
            {isStale && (
              <span>Click "Sync Data" to refresh metrics from Meta Ads. </span>
            )}
            {analysisPercent < 50 && (
              <span>Click "Analyze" to run AI analysis on unprocessed creatives.</span>
            )}
          </div>
        )}
      </V3CardContent>
    </V3Card>
  );
}
