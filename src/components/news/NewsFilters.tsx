import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Filter, Search, X } from "lucide-react";
import { TagInput } from "./TagInput";
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
  geographicScope: string;
  affectedGroup: string; // NEW: Filter by affected community
  relevanceCategory: string; // NEW: Filter by policy category
  politicalLeaning: string; // NEW: Filter by political spectrum
}

export function NewsFilters({ categories, sources, onFilterChange }: NewsFiltersProps) {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    category: 'all',
    sourceId: 'all',
    dateRange: 'all',
    tags: [],
    geographicScope: 'all',
    affectedGroup: 'all',
    relevanceCategory: 'all',
    politicalLeaning: 'all'
  });

  const [showFilters, setShowFilters] = useState(false);

  const updateFilters = (updates: Partial<FilterState>) => {
    const newFilters = { ...filters, ...updates };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleTagsChange = (newTags: string[]) => {
    updateFilters({ tags: newTags });
  };

  const clearFilters = () => {
    const cleared: FilterState = {
      search: '',
      category: 'all',
      sourceId: 'all',
      dateRange: 'all',
      tags: [],
      geographicScope: 'all',
      affectedGroup: 'all',
      relevanceCategory: 'all',
      politicalLeaning: 'all'
    };
    setFilters(cleared);
    onFilterChange(cleared);
  };

  const hasActiveFilters =
    filters.search ||
    filters.category !== 'all' ||
    filters.sourceId !== 'all' ||
    filters.dateRange !== 'all' ||
    filters.tags.length > 0 ||
    filters.geographicScope !== 'all' ||
    filters.affectedGroup !== 'all' ||
    filters.relevanceCategory !== 'all' ||
    filters.politicalLeaning !== 'all';

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Affected Community Filter */}
            <div className="space-y-2">
              <Label>Affected Community</Label>
              <Select value={filters.affectedGroup} onValueChange={(value) => updateFilters({ affectedGroup: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="All communities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All communities</SelectItem>
                  <SelectItem value="muslim_american">Muslim American</SelectItem>
                  <SelectItem value="arab_american">Arab American</SelectItem>
                  <SelectItem value="jewish_american">Jewish American</SelectItem>
                  <SelectItem value="lgbtq">LGBTQ+</SelectItem>
                  <SelectItem value="black_american">Black American</SelectItem>
                  <SelectItem value="latino">Latino/Hispanic</SelectItem>
                  <SelectItem value="asian_american">Asian American</SelectItem>
                  <SelectItem value="indigenous">Indigenous/Native</SelectItem>
                  <SelectItem value="immigrants">Immigrants/Refugees</SelectItem>
                  <SelectItem value="women">Women's Rights</SelectItem>
                  <SelectItem value="disability">Disability Rights</SelectItem>
                  <SelectItem value="veterans">Veterans</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Policy Category Filter */}
            <div className="space-y-2">
              <Label>Policy Category</Label>
              <Select value={filters.relevanceCategory} onValueChange={(value) => updateFilters({ relevanceCategory: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  <SelectItem value="civil_rights">Civil Rights</SelectItem>
                  <SelectItem value="immigration">Immigration</SelectItem>
                  <SelectItem value="healthcare">Healthcare</SelectItem>
                  <SelectItem value="education">Education</SelectItem>
                  <SelectItem value="climate">Climate & Environment</SelectItem>
                  <SelectItem value="economy">Economy & Labor</SelectItem>
                  <SelectItem value="national_security">National Security</SelectItem>
                  <SelectItem value="foreign_policy">Foreign Policy</SelectItem>
                  <SelectItem value="criminal_justice">Criminal Justice</SelectItem>
                  <SelectItem value="housing">Housing</SelectItem>
                </SelectContent>
              </Select>
            </div>

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

            <div className="space-y-2">
              <Label>Geographic Scope</Label>
              <Select value={filters.geographicScope} onValueChange={(value) => updateFilters({ geographicScope: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="All levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All levels</SelectItem>
                  <SelectItem value="national">National</SelectItem>
                  <SelectItem value="state">State</SelectItem>
                  <SelectItem value="local">Local</SelectItem>
                  <SelectItem value="international">International</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Political Spectrum Filter */}
            <div className="space-y-2">
              <Label>Political Perspective</Label>
              <Select value={filters.politicalLeaning} onValueChange={(value) => updateFilters({ politicalLeaning: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="All perspectives" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All perspectives</SelectItem>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="center-left">Center-Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="center-right">Center-Right</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                  <SelectItem value="nonpartisan">Nonpartisan</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Filter by tags</Label>
            <TagInput 
              selectedTags={filters.tags}
              onTagsChange={handleTagsChange}
              placeholder="Type to search or add tags..."
            />
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
          {filters.affectedGroup !== 'all' && (
            <Badge variant="secondary">
              {filters.affectedGroup.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              <X
                className="h-3 w-3 ml-1 cursor-pointer"
                onClick={() => updateFilters({ affectedGroup: 'all' })}
              />
            </Badge>
          )}
          {filters.relevanceCategory !== 'all' && (
            <Badge variant="secondary">
              {filters.relevanceCategory.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              <X
                className="h-3 w-3 ml-1 cursor-pointer"
                onClick={() => updateFilters({ relevanceCategory: 'all' })}
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
          {filters.geographicScope !== 'all' && (
            <Badge variant="secondary">
              {filters.geographicScope.charAt(0).toUpperCase() + filters.geographicScope.slice(1)}
              <X
                className="h-3 w-3 ml-1 cursor-pointer"
                onClick={() => updateFilters({ geographicScope: 'all' })}
              />
            </Badge>
          )}
          {filters.politicalLeaning !== 'all' && (
            <Badge variant="secondary">
              {filters.politicalLeaning.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              <X
                className="h-3 w-3 ml-1 cursor-pointer"
                onClick={() => updateFilters({ politicalLeaning: 'all' })}
              />
            </Badge>
          )}
          {filters.tags.map(tag => (
            <Badge key={tag} variant="secondary">
              {tag}
              <X 
                className="h-3 w-3 ml-1 cursor-pointer" 
                onClick={() => handleTagsChange(filters.tags.filter(t => t !== tag))}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
