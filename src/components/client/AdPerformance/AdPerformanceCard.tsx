/**
 * AdPerformanceCard Component
 *
 * Displays individual ad performance metrics in a card format.
 * Shows creative preview, key metrics, and expandable message details.
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ChevronDown,
  DollarSign,
  Eye,
  MousePointer,
  Users,
  TrendingUp,
  AlertTriangle,
  Video,
  Image as ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AdPerformanceData } from '@/types/adPerformance';
import {
  formatCurrency,
  formatPercentage,
  formatRoas,
  formatNumber,
  getTierColor,
  getTierLabel,
  getCardAccentColor,
  getStatusBadgeVariant,
  getRoasColor,
  isLowSpend,
} from '@/utils/adPerformance';

interface AdPerformanceCardProps {
  ad: AdPerformanceData;
  onSelect?: (ad: AdPerformanceData) => void;
}

export function AdPerformanceCard({ ad, onSelect }: AdPerformanceCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const lowSpend = isLowSpend(ad);
  const isVideo = ad.creative_type === 'video';

  return (
    <Card
      className={cn(
        'overflow-hidden hover:shadow-lg transition-all duration-200',
        getCardAccentColor(ad.performance_tier),
        onSelect && 'cursor-pointer'
      )}
      onClick={() => onSelect?.(ad)}
    >
      <CardContent className="p-0">
        <div className="flex flex-col md:flex-row">
          {/* Thumbnail */}
          <div className="relative w-full md:w-40 h-32 md:h-auto bg-muted flex-shrink-0">
            {ad.creative_thumbnail_url ? (
              <img
                src={ad.creative_thumbnail_url}
                alt={ad.ad_copy_headline || 'Ad creative'}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                {isVideo ? (
                  <Video className="h-10 w-10 text-muted-foreground" />
                ) : (
                  <ImageIcon className="h-10 w-10 text-muted-foreground" />
                )}
              </div>
            )}

            {/* Performance tier badge */}
            {ad.performance_tier && (
              <Badge
                className={cn('absolute top-2 right-2 text-xs', getTierColor(ad.performance_tier))}
              >
                {getTierLabel(ad.performance_tier)}
              </Badge>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 p-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm line-clamp-1">
                  {ad.ad_copy_headline || ad.refcode || `Ad ${ad.ad_id.slice(0, 8)}`}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={getStatusBadgeVariant(ad.status)} className="text-xs">
                    {ad.status}
                  </Badge>
                  {ad.creative_type && (
                    <Badge variant="outline" className="text-xs capitalize">
                      {ad.creative_type}
                    </Badge>
                  )}
                  {lowSpend && (
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge variant="secondary" className="text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Low Spend
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs max-w-[200px]">
                          Statistical caution: Results may not be significant due to low spend
                          (&lt;$50).
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>

              {/* ROAS highlight */}
              <div className="text-right">
                <div className={cn('text-xl font-bold', getRoasColor(ad.roas))}>
                  {formatRoas(ad.roas)}
                </div>
                <span className="text-xs text-muted-foreground">ROAS</span>
              </div>
            </div>

            {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <div className="text-sm font-semibold">{formatCurrency(ad.spend)}</div>
                <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  Spend
                </div>
              </div>
              <div>
                <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                  {formatCurrency(ad.raised)}
                </div>
                <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Raised
                </div>
              </div>
              <div>
                <div className="text-sm font-semibold">{formatCurrency(ad.cpa)}</div>
                <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <Users className="h-3 w-3" />
                  CPA
                </div>
              </div>
              <div>
                <div className="text-sm font-semibold">{formatNumber(ad.impressions)}</div>
                <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <Eye className="h-3 w-3" />
                  Impr.
                </div>
              </div>
              <div>
                <div className="text-sm font-semibold">{formatPercentage(ad.ctr)}</div>
                <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <MousePointer className="h-3 w-3" />
                  Link CTR
                </div>
              </div>
              <div>
                <div className="text-sm font-semibold">{ad.unique_donors}</div>
                <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <Users className="h-3 w-3" />
                  Donors
                </div>
              </div>
            </div>

            {/* Expandable Message Details */}
            <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className="mt-3">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between p-0 h-8 text-muted-foreground hover:text-foreground"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-xs">Message Details</span>
                  <ChevronDown
                    className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-180')}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-2">
                {ad.ad_copy_headline && (
                  <div>
                    <span className="text-xs text-muted-foreground">Headline:</span>
                    <p className="text-sm">{ad.ad_copy_headline}</p>
                  </div>
                )}
                {ad.ad_copy_primary_text && (
                  <div>
                    <span className="text-xs text-muted-foreground">Primary Text:</span>
                    <p className="text-sm line-clamp-3">{ad.ad_copy_primary_text}</p>
                  </div>
                )}
                {ad.ad_copy_description && (
                  <div>
                    <span className="text-xs text-muted-foreground">Description:</span>
                    <p className="text-sm">{ad.ad_copy_description}</p>
                  </div>
                )}
                {/* AI Analysis Tags */}
                <div className="flex flex-wrap gap-1 pt-1">
                  {ad.topic && (
                    <Badge variant="outline" className="text-xs">
                      {ad.topic}
                    </Badge>
                  )}
                  {ad.tone && (
                    <Badge variant="outline" className="text-xs capitalize">
                      {ad.tone}
                    </Badge>
                  )}
                  {ad.urgency_level && (
                    <Badge variant="outline" className="text-xs capitalize">
                      {ad.urgency_level} urgency
                    </Badge>
                  )}
                </div>
                {ad.key_themes && ad.key_themes.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {ad.key_themes.map((theme, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {theme}
                      </Badge>
                    ))}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
