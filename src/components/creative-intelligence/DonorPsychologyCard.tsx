import { useMemo } from "react";
import { Heart, Lightbulb, TrendingUp } from "lucide-react";
import { V3Card, V3CardHeader, V3CardTitle, V3CardDescription, V3CardContent } from "@/components/v3/V3Card";
import { V3LoadingState } from "@/components/v3";
import type { PainPointPerformance, ValuesPerformance } from "@/hooks/useCreativeIntelligence";

interface DonorPsychologyCardProps {
  painPointPerformance: PainPointPerformance[];
  valuesPerformance: ValuesPerformance[];
  isLoading?: boolean;
}

/**
 * Displays donor psychology insights - which pain points and values drive higher ROAS
 */
export function DonorPsychologyCard({
  painPointPerformance,
  valuesPerformance,
  isLoading = false,
}: DonorPsychologyCardProps) {
  // Get top 5 pain points by ROAS
  const topPainPoints = useMemo(() => {
    return [...painPointPerformance]
      .sort((a, b) => b.mean_roas - a.mean_roas)
      .slice(0, 5);
  }, [painPointPerformance]);

  // Get top 5 values by ROAS
  const topValues = useMemo(() => {
    return [...valuesPerformance]
      .sort((a, b) => b.mean_roas - a.mean_roas)
      .slice(0, 5);
  }, [valuesPerformance]);

  // Calculate insight text
  const insightText = useMemo(() => {
    if (topPainPoints.length === 0 && topValues.length === 0) {
      return null;
    }

    const insights: string[] = [];

    if (topPainPoints.length > 0) {
      const best = topPainPoints[0];
      insights.push(
        `Creatives addressing "${best.pain_point}" achieve ${best.mean_roas.toFixed(2)}x ROAS`
      );
    }

    if (topValues.length > 0) {
      const best = topValues[0];
      insights.push(
        `Appeals to "${best.value}" drive ${best.mean_roas.toFixed(2)}x ROAS`
      );
    }

    return insights.join(" • ");
  }, [topPainPoints, topValues]);

  // Loading state
  if (isLoading) {
    return (
      <V3Card>
        <V3CardHeader>
          <V3CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-pink-500" />
            Donor Psychology
          </V3CardTitle>
          <V3CardDescription>
            Understanding what motivates donations
          </V3CardDescription>
        </V3CardHeader>
        <V3CardContent>
          <V3LoadingState variant="list" count={5} />
        </V3CardContent>
      </V3Card>
    );
  }

  // Empty state
  if (topPainPoints.length === 0 && topValues.length === 0) {
    return (
      <V3Card>
        <V3CardHeader>
          <V3CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-pink-500" />
            Donor Psychology
          </V3CardTitle>
          <V3CardDescription>
            Understanding what motivates donations
          </V3CardDescription>
        </V3CardHeader>
        <V3CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Heart className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No donor psychology data available</p>
            <p className="text-sm mt-1">
              Run analysis on creatives to extract pain points and values
            </p>
          </div>
        </V3CardContent>
      </V3Card>
    );
  }

  return (
    <V3Card>
      <V3CardHeader>
        <V3CardTitle className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-pink-500" />
          Donor Psychology
        </V3CardTitle>
        <V3CardDescription>
          Understanding what motivates donations
        </V3CardDescription>
      </V3CardHeader>
      <V3CardContent className="space-y-6">
        {/* Insight banner */}
        {insightText && (
          <div className="bg-pink-500/10 border border-pink-500/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Lightbulb className="h-4 w-4 text-pink-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-pink-200">{insightText}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pain Points Column */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <span className="inline-block w-2 h-2 bg-red-500 rounded-full" />
              Top Donor Pain Points
            </h4>
            {topPainPoints.length > 0 ? (
              <div className="space-y-2">
                {topPainPoints.map((pp, index) => (
                  <div
                    key={pp.pain_point}
                    className="flex items-center justify-between p-2 rounded-lg bg-card/50 hover:bg-card/80 transition-colors"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xs text-muted-foreground w-4">
                        {index + 1}.
                      </span>
                      <span className="text-sm truncate" title={pp.pain_point}>
                        {pp.pain_point}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {pp.creative_count} ads
                      </span>
                      <span className="text-sm font-medium text-green-400 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {pp.mean_roas.toFixed(2)}x
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No pain points extracted yet</p>
            )}
          </div>

          {/* Values Column */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <span className="inline-block w-2 h-2 bg-purple-500 rounded-full" />
              Top Values Appealed
            </h4>
            {topValues.length > 0 ? (
              <div className="space-y-2">
                {topValues.map((v, index) => (
                  <div
                    key={v.value}
                    className="flex items-center justify-between p-2 rounded-lg bg-card/50 hover:bg-card/80 transition-colors"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xs text-muted-foreground w-4">
                        {index + 1}.
                      </span>
                      <span className="text-sm truncate" title={v.value}>
                        {v.value}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {v.creative_count} ads
                      </span>
                      <span className="text-sm font-medium text-purple-400 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {v.mean_roas.toFixed(2)}x
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No values extracted yet</p>
            )}
          </div>
        </div>
      </V3CardContent>
    </V3Card>
  );
}
