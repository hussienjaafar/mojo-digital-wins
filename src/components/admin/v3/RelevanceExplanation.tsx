import { useState } from 'react';
import { 
  Target, 
  MapPin, 
  Building2, 
  Tag, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Newspaper,
  Users,
  AlertTriangle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface Citation {
  title: string;
  source: string;
  url?: string;
  sourceType: 'news' | 'social' | 'government';
  publishedAt?: string;
}

interface RelevanceData {
  // Watchlist matches
  matchedEntities?: Array<{
    name: string;
    type: 'person' | 'organization' | 'topic' | 'keyword';
  }>;
  
  // Organization relevance
  orgTypes?: Array<'advocacy' | 'political' | 'human_rights' | 'nonprofit' | 'government'>;
  
  // Geography
  geographicScope?: Array<'federal' | 'state' | 'local' | 'international'>;
  affectedStates?: string[];
  
  // Issue areas
  issueAreas?: string[];
  
  // Top citations
  citations?: Citation[];
  
  // Threat/impact
  threatLevel?: 'critical' | 'high' | 'medium' | 'low';
  impactScore?: number;
}

interface RelevanceExplanationProps {
  data: RelevanceData;
  variant?: 'full' | 'compact' | 'inline';
  className?: string;
}

const ORG_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  advocacy: { label: 'Advocacy Orgs', color: 'bg-blue-500/10 text-blue-500 border-blue-500/30' },
  political: { label: 'Political', color: 'bg-purple-500/10 text-purple-500 border-purple-500/30' },
  human_rights: { label: 'Human Rights', color: 'bg-green-500/10 text-green-500 border-green-500/30' },
  nonprofit: { label: 'Nonprofits', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' },
  government: { label: 'Government', color: 'bg-slate-500/10 text-slate-500 border-slate-500/30' },
};

const GEOGRAPHY_LABELS: Record<string, string> = {
  federal: 'Federal',
  state: 'State-level',
  local: 'Local',
  international: 'International',
};

const SOURCE_ICONS = {
  news: Newspaper,
  social: Users,
  government: Building2,
};

function SourceLogo({ source, sourceType }: { source: string; sourceType: 'news' | 'social' | 'government' }) {
  const Icon = SOURCE_ICONS[sourceType];
  
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn(
        "w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold",
        sourceType === 'news' && "bg-blue-500/10 text-blue-500",
        sourceType === 'social' && "bg-sky-500/10 text-sky-500",
        sourceType === 'government' && "bg-slate-500/10 text-slate-500"
      )}>
        <Icon className="h-3 w-3" />
      </div>
      <span className="text-xs text-muted-foreground truncate max-w-[100px]">
        {source}
      </span>
    </div>
  );
}

export function RelevanceExplanation({ data, variant = 'full', className }: RelevanceExplanationProps) {
  const [isExpanded, setIsExpanded] = useState(variant === 'full');

  const hasWatchlistMatches = data.matchedEntities && data.matchedEntities.length > 0;
  const hasOrgTypes = data.orgTypes && data.orgTypes.length > 0;
  const hasGeography = data.geographicScope && data.geographicScope.length > 0;
  const hasIssueAreas = data.issueAreas && data.issueAreas.length > 0;
  const hasCitations = data.citations && data.citations.length > 0;

  // Inline variant - very compact, single line
  if (variant === 'inline') {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
        {hasWatchlistMatches && (
          <span className="inline-flex items-center gap-1 text-primary">
            <Target className="h-3 w-3" />
            {data.matchedEntities!.length} match{data.matchedEntities!.length > 1 ? 'es' : ''}
          </span>
        )}
        {data.threatLevel && data.threatLevel !== 'low' && (
          <span className={cn(
            "inline-flex items-center gap-1",
            data.threatLevel === 'critical' && "text-status-error",
            data.threatLevel === 'high' && "text-orange-500",
            data.threatLevel === 'medium' && "text-status-warning"
          )}>
            <AlertTriangle className="h-3 w-3" />
            {data.threatLevel}
          </span>
        )}
        {hasGeography && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {data.geographicScope!.join(', ')}
          </span>
        )}
      </div>
    );
  }

  // Compact variant - collapsible summary
  if (variant === 'compact') {
    return (
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className={className}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 px-2 gap-1 text-xs text-muted-foreground hover:text-foreground">
            <Target className="h-3 w-3" />
            Why this matters
            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <RelevanceContent data={data} />
        </CollapsibleContent>
      </Collapsible>
    );
  }

  // Full variant - always expanded
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <Target className="h-4 w-4 text-primary" />
        Why this matters to you
      </div>
      <RelevanceContent data={data} />
    </div>
  );
}

function RelevanceContent({ data }: { data: RelevanceData }) {
  const hasWatchlistMatches = data.matchedEntities && data.matchedEntities.length > 0;
  const hasOrgTypes = data.orgTypes && data.orgTypes.length > 0;
  const hasGeography = data.geographicScope && data.geographicScope.length > 0;
  const hasIssueAreas = data.issueAreas && data.issueAreas.length > 0;
  const hasCitations = data.citations && data.citations.length > 0;

  return (
    <div className="space-y-3 text-sm">
      {/* Watchlist Matches */}
      {hasWatchlistMatches && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Target className="h-3 w-3" />
            Watchlist Matches
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.matchedEntities!.map((entity, i) => (
              <Badge 
                key={i} 
                variant="outline" 
                className="text-[10px] bg-primary/10 text-primary border-primary/30"
              >
                {entity.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Organization Type Relevance */}
      {hasOrgTypes && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Building2 className="h-3 w-3" />
            Relevant for
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.orgTypes!.map(type => {
              const config = ORG_TYPE_LABELS[type];
              return (
                <Badge 
                  key={type} 
                  variant="outline" 
                  className={cn("text-[10px]", config?.color)}
                >
                  {config?.label || type}
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {/* Geographic Scope */}
      {hasGeography && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <MapPin className="h-3 w-3" />
            Geographic Scope
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.geographicScope!.map(scope => (
              <Badge 
                key={scope} 
                variant="outline" 
                className="text-[10px]"
              >
                {GEOGRAPHY_LABELS[scope] || scope}
              </Badge>
            ))}
            {data.affectedStates && data.affectedStates.length > 0 && (
              <Badge variant="outline" className="text-[10px]">
                {data.affectedStates.slice(0, 3).join(', ')}
                {data.affectedStates.length > 3 && ` +${data.affectedStates.length - 3}`}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Issue Areas */}
      {hasIssueAreas && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Tag className="h-3 w-3" />
            Issue Areas
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.issueAreas!.slice(0, 5).map(issue => (
              <Badge key={issue} variant="secondary" className="text-[10px]">
                {issue}
              </Badge>
            ))}
            {data.issueAreas!.length > 5 && (
              <Badge variant="secondary" className="text-[10px]">
                +{data.issueAreas!.length - 5} more
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Top Citations */}
      {hasCitations && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Newspaper className="h-3 w-3" />
            Top Sources ({data.citations!.length})
          </div>
          <div className="space-y-2">
            {data.citations!.slice(0, 3).map((citation, i) => (
              <div 
                key={i} 
                className="flex items-start gap-2 p-2 rounded bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <SourceLogo source={citation.source} sourceType={citation.sourceType} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs line-clamp-2 font-medium">
                    {citation.title}
                  </p>
                  {citation.publishedAt && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(citation.publishedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                {citation.url && (
                  <a 
                    href={citation.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="shrink-0 p-1 hover:bg-muted rounded"
                    onClick={e => e.stopPropagation()}
                  >
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Threat Level / Impact */}
      {data.threatLevel && data.threatLevel !== 'low' && (
        <div className="flex items-center gap-2 p-2 rounded bg-status-error/5 border border-status-error/20">
          <AlertTriangle className={cn(
            "h-4 w-4 shrink-0",
            data.threatLevel === 'critical' && "text-status-error",
            data.threatLevel === 'high' && "text-orange-500",
            data.threatLevel === 'medium' && "text-status-warning"
          )} />
          <span className="text-xs">
            <strong className="capitalize">{data.threatLevel}</strong> potential impact on your organization
          </span>
        </div>
      )}
    </div>
  );
}

// Compact badge for showing in trend cards
export function RelevanceBadge({ 
  matchCount, 
  threatLevel,
  className 
}: { 
  matchCount?: number; 
  threatLevel?: string;
  className?: string;
}) {
  if (!matchCount && !threatLevel) return null;

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {matchCount && matchCount > 0 && (
        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30 gap-1">
          <Target className="h-2.5 w-2.5" />
          {matchCount}
        </Badge>
      )}
      {threatLevel && threatLevel !== 'low' && (
        <Badge 
          variant="outline" 
          className={cn(
            "text-[10px] gap-1",
            threatLevel === 'critical' && "bg-status-error/10 text-status-error border-status-error/30",
            threatLevel === 'high' && "bg-orange-500/10 text-orange-500 border-orange-500/30",
            threatLevel === 'medium' && "bg-status-warning/10 text-status-warning border-status-warning/30"
          )}
        >
          <AlertTriangle className="h-2.5 w-2.5" />
          {threatLevel}
        </Badge>
      )}
    </div>
  );
}
