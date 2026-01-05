import { useState } from 'react';
import { 
  FileText, 
  ExternalLink, 
  PieChart,
  ChevronDown,
  ChevronUp,
  Newspaper,
  Users,
  Building2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface SourceItem {
  title: string;
  source: string;
  sourceType: 'news' | 'social' | 'government';
  url?: string;
  publishedAt?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
}

interface SourceDistribution {
  rss: number;
  google_news: number;
  bluesky: number;
}

interface ProvenancePanelProps {
  distribution: SourceDistribution;
  topSources: SourceItem[];
  timeWindow: string;
  totalMentions: number;
  className?: string;
}

const SOURCE_TYPE_CONFIG = {
  news: { icon: Newspaper, color: 'bg-blue-500', label: 'News' },
  social: { icon: Users, color: 'bg-sky-500', label: 'Social' },
  government: { icon: Building2, color: 'bg-slate-500', label: 'Government' },
};

function SourcePieChart({ distribution }: { distribution: SourceDistribution }) {
  const total = distribution.rss + distribution.google_news + distribution.bluesky;
  if (total === 0) return null;

  const segments = [
    { key: 'rss', value: distribution.rss, color: 'hsl(var(--primary))', label: 'RSS' },
    { key: 'google_news', value: distribution.google_news, color: 'hsl(var(--chart-2))', label: 'Google News' },
    { key: 'bluesky', value: distribution.bluesky, color: 'hsl(var(--chart-3))', label: 'Bluesky' },
  ].filter(s => s.value > 0);

  // Simple bar visualization instead of pie chart for clarity
  return (
    <div className="space-y-1.5">
      {segments.map(segment => {
        const percentage = Math.round((segment.value / total) * 100);
        return (
          <div key={segment.key} className="flex items-center gap-2 text-xs">
            <div 
              className="w-2 h-2 rounded-full shrink-0" 
              style={{ backgroundColor: segment.color }}
            />
            <span className="text-muted-foreground w-20 truncate">{segment.label}</span>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all"
                style={{ 
                  width: `${percentage}%`,
                  backgroundColor: segment.color 
                }}
              />
            </div>
            <span className="text-muted-foreground w-10 text-right">{percentage}%</span>
          </div>
        );
      })}
    </div>
  );
}

function SourceCard({ item }: { item: SourceItem }) {
  const config = SOURCE_TYPE_CONFIG[item.sourceType];
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-2 p-2 rounded bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className={cn(
        "w-6 h-6 rounded flex items-center justify-center shrink-0",
        item.sourceType === 'news' && "bg-blue-500/10 text-blue-500",
        item.sourceType === 'social' && "bg-sky-500/10 text-sky-500",
        item.sourceType === 'government' && "bg-slate-500/10 text-slate-500"
      )}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs line-clamp-2 font-medium leading-tight">
          {item.title}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-muted-foreground truncate">
            {item.source}
          </span>
          {item.publishedAt && (
            <>
              <span className="text-[10px] text-muted-foreground">•</span>
              <span className="text-[10px] text-muted-foreground">
                {new Date(item.publishedAt).toLocaleDateString()}
              </span>
            </>
          )}
          {item.sentiment && (
            <Badge 
              variant="outline" 
              className={cn(
                "text-[8px] h-4 px-1",
                item.sentiment === 'positive' && "text-status-success border-status-success/30",
                item.sentiment === 'negative' && "text-status-error border-status-error/30",
                item.sentiment === 'neutral' && "text-muted-foreground"
              )}
            >
              {item.sentiment}
            </Badge>
          )}
        </div>
      </div>
      {item.url && (
        <a 
          href={item.url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="shrink-0 p-1 hover:bg-muted rounded"
          onClick={e => e.stopPropagation()}
        >
          <ExternalLink className="h-3 w-3 text-muted-foreground" />
        </a>
      )}
    </div>
  );
}

export function ProvenancePanel({ 
  distribution, 
  topSources, 
  timeWindow, 
  totalMentions,
  className 
}: ProvenancePanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className={className}>
      <CollapsibleTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 px-2 gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full justify-between"
        >
          <div className="flex items-center gap-1.5">
            <FileText className="h-3 w-3" />
            <span>Source Evidence</span>
            <Badge variant="secondary" className="text-[10px] h-4 px-1">
              {totalMentions}
            </Badge>
          </div>
          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="pt-3 space-y-4">
        {/* Time window indicator */}
        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
          <PieChart className="h-3 w-3" />
          Based on {timeWindow}
        </div>

        {/* Source distribution */}
        <div className="space-y-2">
          <p className="text-xs font-medium">Source Mix</p>
          <SourcePieChart distribution={distribution} />
        </div>

        {/* Top sources */}
        {topSources.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium">Top Sources ({topSources.length})</p>
            <div className="space-y-1.5">
              {topSources.slice(0, 3).map((item, i) => (
                <SourceCard key={i} item={item} />
              ))}
            </div>
            {topSources.length > 3 && (
              <Button variant="ghost" size="sm" className="h-6 w-full text-[10px]">
                View all {topSources.length} sources
              </Button>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

// Compact inline version
export function ProvenanceCompact({ 
  distribution 
}: { 
  distribution: SourceDistribution 
}) {
  const total = distribution.rss + distribution.google_news + distribution.bluesky;
  if (total === 0) return null;

  return (
    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
      {distribution.rss > 0 && (
        <span title={`${distribution.rss} RSS articles`}>📰{distribution.rss}</span>
      )}
      {distribution.google_news > 0 && (
        <span title={`${distribution.google_news} Google News`}>🔍{distribution.google_news}</span>
      )}
      {distribution.bluesky > 0 && (
        <span title={`${distribution.bluesky} Bluesky posts`}>🦋{distribution.bluesky}</span>
      )}
    </div>
  );
}
