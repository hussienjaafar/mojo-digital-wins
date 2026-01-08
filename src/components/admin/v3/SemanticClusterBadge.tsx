import React from 'react';
import { Badge } from '@/components/ui/badge';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';
import { Layers, TrendingUp } from 'lucide-react';

interface SemanticClusterBadgeProps {
  clusterName: string;
  clusterDescription?: string;
  memberCount?: number;
  avgConfidence?: number;
  compact?: boolean;
}

export function SemanticClusterBadge({
  clusterName,
  clusterDescription,
  memberCount = 0,
  avgConfidence = 0,
  compact = false,
}: SemanticClusterBadgeProps) {
  const confidenceColor = avgConfidence >= 70 
    ? 'border-green-500/50 bg-green-500/10' 
    : avgConfidence >= 50 
    ? 'border-yellow-500/50 bg-yellow-500/10'
    : 'border-muted bg-muted/50';

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={`text-xs ${confidenceColor} cursor-help`}>
              <Layers className="w-3 h-3 mr-1" />
              {clusterName}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-medium">{clusterName}</p>
              {clusterDescription && (
                <p className="text-xs text-muted-foreground">{clusterDescription}</p>
              )}
              <div className="flex items-center gap-2 text-xs">
                <span>{memberCount} related trends</span>
                <span>•</span>
                <span>{avgConfidence}% confidence</span>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={`p-2 rounded-md border ${confidenceColor}`}>
      <div className="flex items-center gap-2">
        <Layers className="w-4 h-4 text-primary" />
        <span className="font-medium text-sm">{clusterName}</span>
      </div>
      {clusterDescription && (
        <p className="text-xs text-muted-foreground mt-1">{clusterDescription}</p>
      )}
      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Layers className="w-3 h-3" />
          {memberCount} trends
        </span>
        <span className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          {avgConfidence}% conf.
        </span>
      </div>
    </div>
  );
}
