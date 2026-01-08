import { useState, useEffect } from 'react';
import { 
  Search,
  Clock,
  Newspaper,
  MessageCircle,
  Target,
  MapPin,
  Tag,
  Zap,
  X,
  Check
} from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { FilterState } from './TrendsFilterRail';

interface CommandPaletteFilterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onSearch?: (query: string) => void;
  availableTopics?: string[];
}

const TIME_OPTIONS = [
  { value: '1h', label: 'Last Hour' },
  { value: '6h', label: 'Last 6 Hours' },
  { value: '24h', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
];

const QUICK_FILTERS = [
  { id: 'breaking', label: 'Breaking Only', icon: Zap },
  { id: 'highConfidence', label: 'High Confidence (70%+)', icon: Target },
  { id: 'newsOnly', label: 'News Sources Only', icon: Newspaper },
  { id: 'socialOnly', label: 'Social Sources Only', icon: MessageCircle },
];

const GEOGRAPHY_OPTIONS = [
  { value: 'all', label: 'All Regions' },
  { value: 'national', label: 'National' },
  { value: 'state', label: 'State Level' },
  { value: 'local', label: 'Local' },
];

export function CommandPaletteFilter({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
  onSearch,
  availableTopics = [],
}: CommandPaletteFilterProps) {
  const [searchValue, setSearchValue] = useState('');

  // Handle keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  const handleTimeChange = (value: string) => {
    onFiltersChange({ ...filters, timeWindow: value as FilterState['timeWindow'] });
  };

  const handleQuickFilter = (filterId: string) => {
    switch (filterId) {
      case 'highConfidence':
        onFiltersChange({ ...filters, highConfidenceOnly: !filters.highConfidenceOnly });
        break;
      case 'newsOnly':
        onFiltersChange({ 
          ...filters, 
          sources: { news: true, social: false } 
        });
        break;
      case 'socialOnly':
        onFiltersChange({ 
          ...filters, 
          sources: { news: false, social: true } 
        });
        break;
    }
  };

  const handleGeographyChange = (value: string) => {
    onFiltersChange({ ...filters, geography: value as FilterState['geography'] });
  };

  const handleTopicToggle = (topic: string) => {
    const newTopics = filters.topics.includes(topic)
      ? filters.topics.filter(t => t !== topic)
      : [...filters.topics, topic];
    onFiltersChange({ ...filters, topics: newTopics });
  };

  const handleSearch = () => {
    if (searchValue.trim() && onSearch) {
      onSearch(searchValue);
      onOpenChange(false);
    }
  };

  const clearAllFilters = () => {
    onFiltersChange({
      timeWindow: '24h',
      sources: { news: true, social: true },
      highConfidenceOnly: false,
      geography: 'all',
      topics: [],
    });
  };

  const hasActiveFilters = 
    filters.timeWindow !== '24h' ||
    !filters.sources.news ||
    !filters.sources.social ||
    filters.highConfidenceOnly ||
    filters.geography !== 'all' ||
    filters.topics.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput 
        placeholder="Search trends or filter..." 
        value={searchValue}
        onValueChange={setSearchValue}
      />
      <CommandList>
        <CommandEmpty>
          <div className="py-6 text-center">
            <p className="text-sm text-muted-foreground">No results found.</p>
            {searchValue && (
              <button
                onClick={handleSearch}
                className="mt-2 text-sm text-primary hover:underline"
              >
                Search for "{searchValue}"
              </button>
            )}
          </div>
        </CommandEmpty>

        {/* Quick Filters */}
        <CommandGroup heading="Quick Filters">
          {QUICK_FILTERS.map((filter) => (
            <CommandItem
              key={filter.id}
              onSelect={() => handleQuickFilter(filter.id)}
              className="gap-2"
            >
              <filter.icon className="h-4 w-4" />
              <span>{filter.label}</span>
              {filter.id === 'highConfidence' && filters.highConfidenceOnly && (
                <Check className="h-4 w-4 ml-auto text-primary" />
              )}
              {filter.id === 'newsOnly' && filters.sources.news && !filters.sources.social && (
                <Check className="h-4 w-4 ml-auto text-primary" />
              )}
              {filter.id === 'socialOnly' && filters.sources.social && !filters.sources.news && (
                <Check className="h-4 w-4 ml-auto text-primary" />
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Time Window */}
        <CommandGroup heading="Time Window">
          {TIME_OPTIONS.map((option) => (
            <CommandItem
              key={option.value}
              onSelect={() => handleTimeChange(option.value)}
              className="gap-2"
            >
              <Clock className="h-4 w-4" />
              <span>{option.label}</span>
              {filters.timeWindow === option.value && (
                <Check className="h-4 w-4 ml-auto text-primary" />
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Geography */}
        <CommandGroup heading="Geography">
          {GEOGRAPHY_OPTIONS.map((option) => (
            <CommandItem
              key={option.value}
              onSelect={() => handleGeographyChange(option.value)}
              className="gap-2"
            >
              <MapPin className="h-4 w-4" />
              <span>{option.label}</span>
              {filters.geography === option.value && (
                <Check className="h-4 w-4 ml-auto text-primary" />
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        {/* Topics */}
        {availableTopics.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Topics">
              {availableTopics.map((topic) => (
                <CommandItem
                  key={topic}
                  onSelect={() => handleTopicToggle(topic)}
                  className="gap-2"
                >
                  <Tag className="h-4 w-4" />
                  <span>{topic}</span>
                  {filters.topics.includes(topic) && (
                    <Check className="h-4 w-4 ml-auto text-primary" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Clear Filters */}
        {hasActiveFilters && (
          <>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                onSelect={clearAllFilters}
                className="gap-2 text-muted-foreground"
              >
                <X className="h-4 w-4" />
                <span>Clear all filters</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
