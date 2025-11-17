import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Filter, Search, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface NewsFiltersProps {
  categories: string[];
  sources: Array<{ id: string; name: string; category: string }>;
  onFilterChange: (filters: FilterState) => void;
}

export interface FilterState {
  search: string;
  category: string;
  sourceId: string;
  dateRange: string;
  tags: string[];
}

const COMMON_TAGS = [
  'arab american',
  'muslim american',
  'islamophobia',
  'palestine',
  'israel',
  'civil liberties',
  'discrimination'
];

export function NewsFilters({ categories, sources, onFilterChange }: NewsFiltersProps) {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    category: 'all',
    sourceId: 'all',
    dateRange: 'all',
    tags: []
  });

  const [showFilters, setShowFilters] = useState(false);

  const updateFilters = (updates: Partial<FilterState>) => {
    const newFilters = { ...filters, ...updates };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const toggleTag = (tag: string) => {
    const newTags = filters.tags.includes(tag)
      ? filters.tags.filter(t => t !== tag)
      : [...filters.tags, tag];
    updateFilters({ tags: newTags });
  };

  const clearFilters = () => {
    const cleared: FilterState = {
      search: '',
      category: 'all',
      sourceId: 'all',
      dateRange: 'all',
      tags: []
    };
    setFilters(cleared);
    onFilterChange(cleared);
  };

  const hasActiveFilters = 
    filters.search || 
    filters.category !== 'all' || 
    filters.sourceId !== 'all' || 
    filters.dateRange !== 'all' ||
    filters.tags.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search articles..."
            value={filters.search}
            onChange={(e) => updateFilters({ search: e.target.value })}
            className="pl-9"
          />
        </div>
        <Button
          variant={showFilters ? "default" : "outline"}
          size="icon"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="h-4 w-4" />
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" size="icon" onClick={clearFilters}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {showFilters && (
        <div className="space-y-4 p-4 border rounded-lg bg-card">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={filters.category} onValueChange={(value) => updateFilters({ category: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Source</Label>
              <Select value={filters.sourceId} onValueChange={(value) => updateFilters({ sourceId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="All sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  {sources.map((source) => (
                    <SelectItem key={source.id} value={source.id}>
                      {source.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date Range</Label>
              <Select value={filters.dateRange} onValueChange={(value) => updateFilters({ dateRange: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="All time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Past week</SelectItem>
                  <SelectItem value="month">Past month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Filter by tags</Label>
            <div className="flex flex-wrap gap-2">
              {COMMON_TAGS.map((tag) => (
                <Badge
                  key={tag}
                  variant={filters.tags.includes(tag) ? "default" : "outline"}
                  className="cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}

      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {filters.search && (
            <Badge variant="secondary">
              Search: {filters.search}
              <X 
                className="h-3 w-3 ml-1 cursor-pointer" 
                onClick={() => updateFilters({ search: '' })}
              />
            </Badge>
          )}
          {filters.category !== 'all' && (
            <Badge variant="secondary">
              {filters.category}
              <X 
                className="h-3 w-3 ml-1 cursor-pointer" 
                onClick={() => updateFilters({ category: 'all' })}
              />
            </Badge>
          )}
          {filters.tags.map(tag => (
            <Badge key={tag} variant="secondary">
              {tag}
              <X 
                className="h-3 w-3 ml-1 cursor-pointer" 
                onClick={() => toggleTag(tag)}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
