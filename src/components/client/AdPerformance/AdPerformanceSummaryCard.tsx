/**
 * AdPerformanceSummaryCard Component
 *
 * Dashboard widget showing top-level ad performance summary.
 * Links to the full Ad Performance page for detailed drill-down.
 */

import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, TrendingUp, Target, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AdPerformanceSummary } from '@/types/adPerformance';
import { formatCurrency, formatRoas, getTierColor, getTierLabel, getRoasColor } from '@/utils/adPerformance';

interface AdPerformanceSummaryCardProps {
  summary: AdPerformanceSummary | null;
  isLoading: boolean;
  attributionFallbackMode?: boolean;
}

export function AdPerformanceSummaryCard({
  summary,
  isLoading,
  attributionFallbackMode = false,
}: AdPerformanceSummaryCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Top Ad Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
    );
  }

  if (!summary?.has_data) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Top Ad Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No ad performance data available for this period.
          </p>
          <Button asChild variant="ghost" size="sm" className="mt-2 p-0">
            <Link to="/client/ad-performance">
              View Details <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { top_performer, totals } = summary;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Top Ad Performance
          </CardTitle>
          {attributionFallbackMode && (
            <Badge variant="secondary" className="text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Modeled Attribution
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Totals Summary */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-lg font-bold">{formatCurrency(totals.total_spend)}</div>
            <div className="text-xs text-muted-foreground">Total Spend</div>
          </div>
          <div>
            <div className="text-lg font-bold text-green-600 dark:text-green-400">
              {formatCurrency(totals.total_raised)}
            </div>
            <div className="text-xs text-muted-foreground">Net Raised</div>
          </div>
          <div>
            <div className={cn('text-lg font-bold', getRoasColor(totals.total_roas))}>
              {formatRoas(totals.total_roas)}
            </div>
            <div className="text-xs text-muted-foreground">Overall ROAS</div>
          </div>
        </div>

        {/* Top Performer */}
        {top_performer && (
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Top Performer
              </span>
              {top_performer.performance_tier && (
                <Badge className={cn('text-xs', getTierColor(top_performer.performance_tier))}>
                  {getTierLabel(top_performer.performance_tier)}
                </Badge>
              )}
            </div>
            <p className="text-sm font-medium line-clamp-1">
              {top_performer.ad_copy_headline ||
                top_performer.refcode ||
                `Ad ${top_performer.ad_id.slice(0, 8)}`}
            </p>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span>
                ROAS: <strong className={getRoasColor(top_performer.roas)}>{formatRoas(top_performer.roas)}</strong>
              </span>
              <span>
                Raised: <strong className="text-green-600 dark:text-green-400">{formatCurrency(top_performer.raised)}</strong>
              </span>
            </div>
          </div>
        )}

        {/* Link to full page */}
        <Button asChild variant="ghost" size="sm" className="w-full justify-between">
          <Link to="/client/ad-performance">
            View All {summary.total_ads} Ads
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
