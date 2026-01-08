import { Target, MapPin, Users, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface RelevanceExplainerInlineProps {
  whyItMatters?: string;
  matchedTopics?: string[];
  matchedEntities?: string[];
  matchedGeographies?: string[];
  relevanceScore?: number;
  orgName?: string;
  compact?: boolean;
  className?: string;
}

export function RelevanceExplainerInline({
  whyItMatters,
  matchedTopics = [],
  matchedEntities = [],
  matchedGeographies = [],
  relevanceScore,
  orgName,
  compact = false,
  className,
}: RelevanceExplainerInlineProps) {
  const allMatches = [
    ...matchedTopics.map(t => ({ type: 'topic', value: t })),
    ...matchedEntities.map(e => ({ type: 'entity', value: e })),
    ...matchedGeographies.map(g => ({ type: 'geography', value: g })),
  ];

  const hasMatches = allMatches.length > 0 || whyItMatters;

  if (!hasMatches) return null;

  if (compact) {
    return (
      <div className={cn("flex items-center gap-1.5 flex-wrap", className)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 text-xs text-primary cursor-help">
              <Target className="h-3 w-3" />
              <span className="font-medium">
                {relevanceScore ? `${relevanceScore}% match` : 'Relevant'}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-sm">
            <p className="text-xs">{whyItMatters || 'Matches your organization preferences'}</p>
          </TooltipContent>
        </Tooltip>

        {allMatches.slice(0, 3).map((match, i) => (
          <Badge 
            key={`${match.type}-${i}`}
            variant="secondary" 
            className="text-[9px] py-0 px-1 h-4 bg-primary/10 text-primary border-0"
          >
            {match.value}
          </Badge>
        ))}

        {allMatches.length > 3 && (
          <span className="text-[10px] text-muted-foreground">
            +{allMatches.length - 3}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("p-3 rounded-lg bg-primary/5 border border-primary/10", className)}>
      {/* Why It Matters text */}
      {whyItMatters && (
        <div className="mb-2">
          <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">
            {orgName ? `Why This Matters to ${orgName}` : 'Why This Matters'}
          </p>
          <p className="text-sm text-foreground leading-relaxed">
            {whyItMatters}
          </p>
        </div>
      )}

      {/* Matched reasons as tags */}
      {allMatches.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mt-2">
          <Target className="h-3.5 w-3.5 text-primary shrink-0" />
          
          {matchedTopics.map((topic, i) => (
            <Tooltip key={`topic-${i}`}>
              <TooltipTrigger asChild>
                <Badge 
                  variant="secondary" 
                  className="text-[10px] py-0 px-1.5 bg-primary/10 text-primary border-0 gap-1 cursor-help"
                >
                  <Tag className="h-2.5 w-2.5" />
                  {topic}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Matches your priority topic</TooltipContent>
            </Tooltip>
          ))}
          
          {matchedEntities.map((entity, i) => (
            <Tooltip key={`entity-${i}`}>
              <TooltipTrigger asChild>
                <Badge 
                  variant="secondary" 
                  className="text-[10px] py-0 px-1.5 bg-[hsl(var(--portal-info))]/10 text-[hsl(var(--portal-info))] border-0 gap-1 cursor-help"
                >
                  <Users className="h-2.5 w-2.5" />
                  {entity}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Watched entity</TooltipContent>
            </Tooltip>
          ))}
          
          {matchedGeographies.map((geo, i) => (
            <Tooltip key={`geo-${i}`}>
              <TooltipTrigger asChild>
                <Badge 
                  variant="secondary" 
                  className="text-[10px] py-0 px-1.5 bg-[hsl(var(--portal-success))]/10 text-[hsl(var(--portal-success))] border-0 gap-1 cursor-help"
                >
                  <MapPin className="h-2.5 w-2.5" />
                  {geo}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>Target geography</TooltipContent>
            </Tooltip>
          ))}
        </div>
      )}

      {/* Relevance score indicator */}
      {relevanceScore !== undefined && relevanceScore > 0 && (
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-primary/10">
          <span className="text-[10px] text-muted-foreground">Relevance:</span>
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-24">
            <div 
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.min(relevanceScore, 100)}%` }}
            />
          </div>
          <span className="text-[10px] font-medium text-primary">{relevanceScore}%</span>
        </div>
      )}
    </div>
  );
}
