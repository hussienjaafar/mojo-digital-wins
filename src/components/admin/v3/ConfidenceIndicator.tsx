import { cn } from '@/lib/utils';
import { 
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Shield, ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react';

interface ConfidenceFactors {
  sourceCount: number;        // Number of distinct sources (0-4)
  dataRecency: 'fresh' | 'recent' | 'stale' | 'old'; // How recent the data is
  crossSourceAgreement: boolean; // Do multiple sources agree?
  entityMatchQuality: 'exact' | 'partial' | 'fuzzy' | 'none'; // Watchlist match quality
  velocityConfidence: boolean; // Is velocity calculation reliable?
}

interface ConfidenceIndicatorProps {
  score?: number; // 0-100, if provided directly
  factors?: Partial<ConfidenceFactors>;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

function calculateConfidenceScore(factors: Partial<ConfidenceFactors>): number {
  let score = 50; // Base score

  // Source count bonus (max +25)
  const sourceCount = factors.sourceCount || 0;
  if (sourceCount >= 3) score += 25;
  else if (sourceCount >= 2) score += 15;
  else if (sourceCount >= 1) score += 5;

  // Data recency bonus (max +20)
  switch (factors.dataRecency) {
    case 'fresh': score += 20; break;
    case 'recent': score += 12; break;
    case 'stale': score += 5; break;
    case 'old': score -= 10; break;
  }

  // Cross-source agreement bonus (+15)
  if (factors.crossSourceAgreement) {
    score += 15;
  }

  // Entity match quality (max +15)
  switch (factors.entityMatchQuality) {
    case 'exact': score += 15; break;
    case 'partial': score += 8; break;
    case 'fuzzy': score += 3; break;
  }

  // Velocity confidence (+5)
  if (factors.velocityConfidence) {
    score += 5;
  }

  return Math.min(100, Math.max(0, score));
}

function getConfidenceLevel(score: number): {
  label: string;
  color: string;
  bgColor: string;
  icon: typeof Shield;
} {
  if (score >= 80) {
    return {
      label: 'High',
      color: 'text-status-success',
      bgColor: 'bg-status-success',
      icon: ShieldCheck,
    };
  }
  if (score >= 50) {
    return {
      label: 'Medium',
      color: 'text-status-warning',
      bgColor: 'bg-status-warning',
      icon: Shield,
    };
  }
  if (score >= 25) {
    return {
      label: 'Low',
      color: 'text-orange-500',
      bgColor: 'bg-orange-500',
      icon: ShieldAlert,
    };
  }
  return {
    label: 'Very Low',
    color: 'text-status-error',
    bgColor: 'bg-status-error',
    icon: ShieldQuestion,
  };
}

export function ConfidenceIndicator({
  score: providedScore,
  factors,
  size = 'sm',
  showLabel = false,
  className,
}: ConfidenceIndicatorProps) {
  const score = providedScore ?? (factors ? calculateConfidenceScore(factors) : 50);
  const level = getConfidenceLevel(score);
  const Icon = level.icon;

  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const barHeight = {
    sm: 'h-1',
    md: 'h-1.5',
    lg: 'h-2',
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn("inline-flex items-center gap-1.5 cursor-help", className)}>
          <Icon className={cn(sizeClasses[size], level.color)} />
          
          {/* Confidence bar */}
          <div className={cn(
            "w-8 rounded-full overflow-hidden bg-muted",
            barHeight[size]
          )}>
            <div 
              className={cn("h-full rounded-full transition-all", level.bgColor)}
              style={{ width: `${score}%` }}
            />
          </div>

          {showLabel && (
            <span className={cn(
              "text-xs font-medium",
              level.color
            )}>
              {level.label}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <span className="font-medium">Confidence Score</span>
            <span className={cn("font-bold", level.color)}>{score}%</span>
          </div>
          
          {factors && (
            <div className="text-xs space-y-1 text-muted-foreground">
              <p>Based on:</p>
              <ul className="list-disc list-inside space-y-0.5">
                {factors.sourceCount !== undefined && (
                  <li>{factors.sourceCount} source{factors.sourceCount !== 1 ? 's' : ''} reporting</li>
                )}
                {factors.dataRecency && (
                  <li>Data is {factors.dataRecency}</li>
                )}
                {factors.crossSourceAgreement && (
                  <li>Cross-source agreement confirmed</li>
                )}
                {factors.entityMatchQuality && factors.entityMatchQuality !== 'none' && (
                  <li>{factors.entityMatchQuality} entity match</li>
                )}
              </ul>
            </div>
          )}

          <p className="text-xs text-muted-foreground pt-1 border-t">
            {level.label} confidence means this information is {
              score >= 80 ? 'highly reliable and verified across multiple sources.' :
              score >= 50 ? 'reasonably reliable with some verification.' :
              score >= 25 ? 'less certain and should be verified.' :
              'uncertain and requires additional verification.'
            }
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// Utility to calculate confidence from trend data
export function calculateTrendConfidence(trend: {
  source_count?: number;
  total_mentions_24h?: number;
  velocity?: number;
  matchesWatchlist?: boolean;
  cross_source_score?: number;
}): { score: number; factors: Partial<ConfidenceFactors> } {
  const factors: Partial<ConfidenceFactors> = {
    sourceCount: trend.source_count || 1,
    dataRecency: 'recent', // Trends are always recent by definition
    crossSourceAgreement: (trend.cross_source_score || 0) > 50,
    entityMatchQuality: trend.matchesWatchlist ? 'exact' : 'none',
    velocityConfidence: (trend.velocity || 0) > 0,
  };

  // Adjust recency based on mentions
  if ((trend.total_mentions_24h || 0) > 100) {
    factors.dataRecency = 'fresh';
  } else if ((trend.total_mentions_24h || 0) < 10) {
    factors.dataRecency = 'stale';
  }

  return {
    score: calculateConfidenceScore(factors),
    factors,
  };
}
