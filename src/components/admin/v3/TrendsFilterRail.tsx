import { useState } from 'react';
import { 
  Search, 
  Clock, 
  Radio, 
  Target, 
  MapPin, 
  Tag,
  ChevronDown,
  ChevronRight,
  X,
  SlidersHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export interface FilterState {
  timeWindow: '1h' | '6h' | '24h' | '7d';
  sources: { news: boolean; social: boolean };
  highConfidenceOnly: boolean;
  geography: 'all' | 'federal' | 'state' | 'global';
  topics: string[];
}

interface TrendsFilterRailProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  availableTopics?: string[];
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
}

const TIME_OPTIONS = [
  { value: '1h', label: '1 hour' },
  { value: '6h', label: '6 hours' },
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
] as const;

const GEO_OPTIONS = [
  { value: 'all', label: 'All locations' },
  { value: 'federal', label: 'Federal' },
  { value: 'state', label: 'State level' },
  { value: 'global', label: 'Global' },
] as const;

// Placeholder topics - in production these would come from org profile
const DEFAULT_TOPICS = [
  'Healthcare',
  'Climate Policy',
  'Education',
  'Immigration',
  'Civil Rights',
  'Economy',
  'Foreign Policy',
];

function FilterSection({ 
  title, 
  icon: Icon, 
  children, 
  defaultOpen = true 
}: { 
  title: string; 
  icon: React.ElementType; 
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between h-8 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <span className="flex items-center gap-2">
            <Icon className="h-3.5 w-3.5" />
            {title}
          </span>
          <ChevronDown className={cn(
            "h-3.5 w-3.5 transition-transform",
            isOpen && "rotate-180"
          )} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-2 pt-2 pb-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function TrendsFilterRail({
  filters,
  onFiltersChange,
  searchQuery,
  onSearchChange,
  availableTopics = DEFAULT_TOPICS,
  isCollapsed = false,
  onToggleCollapse,
  className,
}: TrendsFilterRailProps) {
  const updateFilters = (partial: Partial<FilterState>) => {
    onFiltersChange({ ...filters, ...partial });
  };

  const activeFilterCount = [
    filters.timeWindow !== '24h',
    !filters.sources.news || !filters.sources.social,
    filters.highConfidenceOnly,
    filters.geography !== 'all',
    filters.topics.length > 0,
  ].filter(Boolean).length;

  const handleTopicToggle = (topic: string) => {
    const newTopics = filters.topics.includes(topic)
      ? filters.topics.filter(t => t !== topic)
      : [...filters.topics, topic];
    updateFilters({ topics: newTopics });
  };

  const clearFilters = () => {
    onFiltersChange({
      timeWindow: '24h',
      sources: { news: true, social: true },
      highConfidenceOnly: false,
      geography: 'all',
      topics: [],
    });
    onSearchChange('');
  };

  // Collapsed state
  if (isCollapsed) {
    return (
      <div className={cn(
        "w-12 flex flex-col items-center py-3 border-r border-border bg-card/30",
        className
      )}>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 relative"
          onClick={onToggleCollapse}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 flex items-center justify-center text-[10px] font-bold bg-primary text-primary-foreground rounded-full">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className={cn(
      "w-64 flex flex-col border-r border-border bg-card/30",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filters</span>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {activeFilterCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-muted-foreground hover:text-foreground px-2"
              onClick={clearFilters}
            >
              Clear
            </Button>
          )}
          {onToggleCollapse && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onToggleCollapse}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search trends..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-8 pl-8 pr-8 text-sm"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                onClick={() => onSearchChange('')}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          <Separator className="mb-2" />

          {/* Time Window */}
          <FilterSection title="Time Window" icon={Clock}>
            <RadioGroup
              value={filters.timeWindow}
              onValueChange={(v) => updateFilters({ timeWindow: v as FilterState['timeWindow'] })}
              className="grid grid-cols-2 gap-1.5"
            >
              {TIME_OPTIONS.map(option => (
                <div key={option.value} className="flex items-center">
                  <RadioGroupItem
                    value={option.value}
                    id={`time-${option.value}`}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={`time-${option.value}`}
                    className={cn(
                      "flex-1 cursor-pointer rounded-md border py-1.5 px-2 text-center text-xs transition-colors",
                      "hover:bg-muted peer-data-[state=checked]:bg-primary/10 peer-data-[state=checked]:border-primary peer-data-[state=checked]:text-primary"
                    )}
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </FilterSection>

          {/* Sources */}
          <FilterSection title="Sources" icon={Radio}>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="source-news"
                  checked={filters.sources.news}
                  onCheckedChange={(checked) => 
                    updateFilters({ sources: { ...filters.sources, news: !!checked } })
                  }
                />
                <Label htmlFor="source-news" className="text-xs cursor-pointer">
                  News articles
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="source-social"
                  checked={filters.sources.social}
                  onCheckedChange={(checked) => 
                    updateFilters({ sources: { ...filters.sources, social: !!checked } })
                  }
                />
                <Label htmlFor="source-social" className="text-xs cursor-pointer">
                  Social media
                </Label>
              </div>
            </div>
          </FilterSection>

          {/* Confidence */}
          <FilterSection title="Confidence" icon={Target}>
            <div className="flex items-center gap-2">
              <Checkbox
                id="high-confidence"
                checked={filters.highConfidenceOnly}
                onCheckedChange={(checked) => 
                  updateFilters({ highConfidenceOnly: !!checked })
                }
              />
              <Label htmlFor="high-confidence" className="text-xs cursor-pointer">
                High confidence only (70%+)
              </Label>
            </div>
          </FilterSection>

          {/* Geography */}
          <FilterSection title="Geography" icon={MapPin}>
            <RadioGroup
              value={filters.geography}
              onValueChange={(v) => updateFilters({ geography: v as FilterState['geography'] })}
              className="space-y-1.5"
            >
              {GEO_OPTIONS.map(option => (
                <div key={option.value} className="flex items-center gap-2">
                  <RadioGroupItem value={option.value} id={`geo-${option.value}`} className="h-3.5 w-3.5" />
                  <Label htmlFor={`geo-${option.value}`} className="text-xs cursor-pointer">
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </FilterSection>

          {/* Topics */}
          <FilterSection title="Topics" icon={Tag} defaultOpen={false}>
            <div className="flex flex-wrap gap-1.5">
              {availableTopics.map(topic => (
                <Badge
                  key={topic}
                  variant={filters.topics.includes(topic) ? 'default' : 'outline'}
                  className={cn(
                    "text-xs cursor-pointer transition-colors",
                    filters.topics.includes(topic) 
                      ? "bg-primary text-primary-foreground" 
                      : "hover:bg-muted"
                  )}
                  onClick={() => handleTopicToggle(topic)}
                >
                  {topic}
                </Badge>
              ))}
            </div>
          </FilterSection>
        </div>
      </ScrollArea>
    </div>
  );
}
