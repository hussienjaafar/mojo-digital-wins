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

  // Determine data status for screen readers
  const getDataStatusDescription = () => {
    if (isVeryStale) return `Critical: Data is very stale, last synced ${hoursStale}+ hours ago`;
    if (isStale) return `Warning: Data may be outdated, last synced ${hoursStale}+ hours ago`;
    if (lastSyncedAt) return `Data is fresh, synced ${formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true })}`;
    return "Data sync status unknown";
  };

  return (
    <V3Card
      className={isVeryStale ? "border-[hsl(var(--portal-error)/0.5)]" : isStale ? "border-[hsl(var(--portal-warning)/0.5)]" : ""}
      role="region"
      aria-label="Data freshness status"
    >
      <V3CardContent className="py-4">
        <div
          className="flex flex-col sm:flex-row sm:items-center gap-4"
          aria-live="polite"
          aria-atomic="true"
        >
          {/* Stale data warning */}
          {isVeryStale && (
            <div
              className="flex items-center gap-2 text-[hsl(var(--portal-error))]"
              role="alert"
              aria-label="Critical data freshness warning"
            >
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              <div>
                <div className="font-medium text-sm">Data is very stale</div>
                <div className="text-xs opacity-80">Last synced {hoursStale}+ hours ago</div>
              </div>
            </div>
          )}

          {isStale && !isVeryStale && (
            <div
              className="flex items-center gap-2 text-[hsl(var(--portal-warning))]"
              role="alert"
              aria-label="Data freshness warning"
            >
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              <div>
                <div className="font-medium text-sm">Data may be outdated</div>
                <div className="text-xs opacity-80">Last synced {hoursStale}+ hours ago</div>
              </div>
            </div>
          )}

          {!isStale && lastSyncedAt && (
            <div
              className="flex items-center gap-2 text-[hsl(var(--portal-success))]"
              role="status"
              aria-label="Data is current"
            >
              <CheckCircle className="h-5 w-5" aria-hidden="true" />
              <div>
                <div className="font-medium text-sm">Data is fresh</div>
                <div className="text-xs opacity-80">
                  Synced {formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true })}
                </div>
              </div>
            </div>
          )}

          {/* Metrics summary */}
          <div className="flex flex-wrap items-center gap-4 sm:ml-auto text-sm" aria-label="Analysis progress summary">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" aria-hidden="true" />
              <span className="text-[hsl(var(--portal-text-muted))]">
                {analyzedCreatives} of {totalCreatives} analyzed
              </span>
              <V3InsightBadge
                type={analysisPercent >= 80 ? "info" : analysisPercent >= 50 ? "anomaly-low" : "anomaly-high"}
              >
                {analysisPercent}%
                <span className="sr-only">
                  {analysisPercent >= 80 ? " - good coverage" : analysisPercent >= 50 ? " - moderate coverage" : " - low coverage, action needed"}
                </span>
              </V3InsightBadge>
            </div>

            {lastMetricDate && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" aria-hidden="true" />
                <span className="text-[hsl(var(--portal-text-muted))]">
                  Latest metrics: {lastMetricDate}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Recommendations based on data state */}
        {(isStale || analysisPercent < 50) && (
          <div
            className="mt-3 pt-3 border-t border-[hsl(var(--portal-border))] text-xs text-[hsl(var(--portal-text-muted))]"
            role="status"
            aria-label="Recommended actions"
          >
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
